import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import type { Song } from "../music/model";
import { isBlack } from "../music/model";
import { shortcutLabel } from "../music/keyboard";
import { player } from "../audio/PlaybackScheduler";
import { useSettings } from "../store";
import { rollTimeAtPointer } from "../stage/rollSelection";
import { upperBound } from "../stage/upperBound";
import { isAutomaticNote, type AutoPolicy } from "../practice/handSplit";

function offsetLeftDifference(from: HTMLElement, to: HTMLElement) {
  const offsets = new Map<HTMLElement, number>();
  let node: HTMLElement | null = from;
  let left = 0;
  while (node) {
    offsets.set(node, left);
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }

  node = to;
  left = 0;
  while (node) {
    const fromLeft = offsets.get(node);
    if (fromLeft !== undefined) return fromLeft - left;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return 0;
}

function offsetFromStage(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && !node.classList.contains("stage")) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top };
}

export function Roll({
  song,
  transpose,
  count,
  zoom,
  muted,
  scroll,
  mapping,
  octave,
  manual,
  autoPolicy,
  splitPitch = 60,
  focusMode = false,
  loopRange,
  onLoopSelect,
  loopSelectionArmed = false,
  rotate = false,
}: {
  song: Song | null;
  transpose: number;
  count: number;
  zoom: number;
  muted: number[];
  scroll: number;
  mapping: Record<string, number>;
  octave: number;
  manual: boolean;
  autoPolicy?: Record<number, AutoPolicy>;
  splitPitch?: number;
  focusMode?: boolean;
  loopRange?: { enabled: boolean; a: number; b: number };
  onLoopSelect?: (a: number, b: number) => void;
  loopSelectionArmed?: boolean;
  rotate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<number | null>(null);
  const [draftRange, setDraftRange] = useState<[number, number] | null>(null);
  const notePalette = useSettings((settings) => settings.notePalette);
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  const drawRef = useRef<() => void>(() => {});
  const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const focusApp = focusMode
        ? canvas.closest<HTMLElement>('.app[data-view="focus"]')
        : null;
      const pianoKeys = focusApp?.querySelector<HTMLElement>(
        ".piano-housing .keys",
      );
      const pianoScroller = pianoKeys?.parentElement as HTMLElement | null;
      if (focusMode && pianoScroller) {
        canvas.style.setProperty(
          "width",
          `${pianoScroller.clientWidth}px`,
          "important",
        );
      } else {
        canvas.style.removeProperty("width");
      }
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (width <= 0 || height <= 0) return;
      const pixelWidth = Math.round(width * devicePixelRatio);
      const pixelHeight = Math.round(height * devicePixelRatio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
      const w = width,
        h = height;
      const start = count === 88 ? 21 : 36;
      const whites = Array.from({ length: count }, (_, i) => start + i).filter(
        (n) => !isBlack(n),
      );
      const unit = Math.max(w, whites.length * 29) / whites.length;
      const keyGeometry = new Map<number, { left: number; width: number }>();
      if (pianoKeys) {
        const keysToCanvas = offsetLeftDifference(pianoKeys, canvas);
        pianoKeys.querySelectorAll<HTMLElement>(".piano-key[data-midi]").forEach((key) => {
          keyGeometry.set(Number(key.dataset.midi), {
            left:
              keysToCanvas + key.offsetLeft - (pianoScroller?.scrollLeft || 0),
            width: key.offsetWidth,
          });
        });
      }
      const aligned = focusMode && keyGeometry.size > 0;
      const chartBottom = h - (aligned ? 2 : 34);
      if (loopRange?.enabled) {
        const yForTime = (time: number) => chartBottom - (time - position) * zoom;
        const ay = yForTime(loopRange.a);
        const by = yForTime(loopRange.b);
        if (by >= 0 && ay <= chartBottom) {
          ctx.fillStyle = "#d6bd7720";
          ctx.fillRect(0, Math.max(0, by), w, Math.max(0, Math.min(chartBottom, ay) - Math.max(0, by)));
        }
        for (const [time, label] of [[loopRange.a, "A"], [loopRange.b, "B"]] as const) {
          const y = yForTime(time);
          if (y < 0 || y > chartBottom) continue;
          ctx.strokeStyle = "#e6c979";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.fillStyle = "#171710";
          ctx.fillRect(4, y - 9, 16, 16);
          ctx.fillStyle = "#f4dd9b";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText(label, 9, y + 3);
        }
      }
      if (draftRange) {
        const y1 = chartBottom - (draftRange[0] - position) * zoom;
        const y2 = chartBottom - (draftRange[1] - position) * zoom;
        const top = Math.max(0, Math.min(y1, y2));
        const bottom = Math.min(chartBottom, Math.max(y1, y2));
        if (bottom > top) {
          ctx.fillStyle = "#8db9e430";
          ctx.fillRect(0, top, w, bottom - top);
          ctx.strokeStyle = "#a9d4ff";
          ctx.lineWidth = 1.5;
          for (const y of [y1, y2]) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = "#ffffff08";
      for (let i = 0; i <= whites.length; i++) {
        ctx.beginPath();
        const x = aligned
          ? keyGeometry.get(whites[i])?.left ?? i * unit - scroll
          : i * unit - scroll;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chartBottom);
        ctx.stroke();
      }
      ctx.font = "10px monospace";
      for (let i = 0; i * 60 < chartBottom; i++) {
        const y = chartBottom - i * 60;
        ctx.fillStyle = "#929b91";
        ctx.fillText(`${(position + (i * 60) / zoom).toFixed(1)}s`, 8, y - 4);
        ctx.strokeStyle = "#ffffff0b";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const shortcuts = new Map(
        Object.entries(mapping).map(([key, midi]) => [
          midi + octave * 12,
          shortcutLabel(key),
        ]),
      );
      for (const n of song?.notes || []) {
        if (muted.includes(n.trackId)) continue;
        const midi = n.midi + transpose;
        if (midi < start || midi >= start + count) continue;
        const bottom = chartBottom - (n.startTime - position) * zoom;
        const height = Math.max(4, n.duration * zoom);
        const top = bottom - height;
        if (bottom < 0 || top > chartBottom) continue;
        const black = isBlack(midi);
        const geometry = keyGeometry.get(midi);
        const x = aligned
          ? (geometry?.left ?? 0)
          : (whites.filter((v) => v < midi).length - (black ? 0.32 : 0)) *
              unit -
            scroll;
        const noteWidth = aligned
          ? (geometry?.width ?? unit)
          : unit * (black ? 0.64 : 1);
        const policy = autoPolicy?.[n.trackId];
        const automatic = isAutomaticNote(policy, midi, splitPitch);
        const manualNote = manual && (autoPolicy ? !automatic : true);
        ctx.fillStyle = notePalette === "accessible"
          ? manualNote ? "#568fc4" : "#e0ad45"
          : autoPolicy
            ? automatic ? "#c9b788" : "#85b5a7"
            : ["#c9b788", "#85b5a7", "#99a9cf", "#c594a5"][n.trackId % 4];
        ctx.globalAlpha = bottom >= chartBottom ? 0.95 : 0.72;
        ctx.beginPath();
        const horizontalInset = aligned ? 1 : 2;
        ctx.roundRect(
          x + horizontalInset,
          top,
          Math.max(2, noteWidth - horizontalInset * 2),
          height - 2,
          3,
        );
        ctx.fill();
        if (notePalette === "accessible" && manualNote) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#e5f3ff";
          ctx.lineWidth = 1;
          ctx.stroke();
          if (height > 16 && noteWidth > 19) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 8px sans-serif";
            ctx.fillText("手", x + horizontalInset + 2, Math.max(9, top + 9));
          }
        }
        const label = shortcuts.get(midi);
        const keyWidth = noteWidth - 6;
        if (manual && label && height > 13 && keyWidth > 10) {
          ctx.globalAlpha = 0.94;
          ctx.fillStyle = "#161811";
          ctx.font = `${Math.min(9, Math.max(6, unit * 0.25))}px monospace`;
          ctx.fillText(label, x + 4, Math.max(10, top + 11), keyWidth);
        }
      }
      ctx.globalAlpha = 1;
      const mapTop = h - 34;
      ctx.fillStyle = aligned ? "#d7bb79" : "#0a0d0a";
      if (aligned) ctx.fillRect(0, h - 2, w, 2);
      else ctx.fillRect(0, mapTop, w, 34);
      ctx.strokeStyle = aligned ? "#ead39a" : "#c9b78866";
      ctx.beginPath();
      ctx.moveTo(0, aligned ? h - 2 : mapTop);
      ctx.lineTo(w, aligned ? h - 2 : mapTop);
      ctx.stroke();
      for (let midi = start; !aligned && midi < start + count; midi++) {
        const black = isBlack(midi);
        const x =
          whites.filter((v) => v < midi).length * unit -
          (black ? unit * 0.32 : 0) -
          scroll;
        const keyWidth = unit * (black ? 0.64 : 1);
        if (x + keyWidth < 0 || x > w) continue;
        ctx.fillStyle = black ? "#292a26" : "#ded9ca";
        ctx.fillRect(x + 1, mapTop + 2, Math.max(2, keyWidth - 2), 30);
        ctx.fillStyle = black ? "#e0c987" : "#272821";
        const shortcut = shortcuts.get(midi) || "·";
        ctx.font = `${Math.min(8, Math.max(5, unit * 0.24))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(shortcut, x + keyWidth / 2, mapTop + 20, keyWidth - 1);
        if (midi % 12 === 0) {
          ctx.font = "5px sans-serif";
          ctx.fillStyle = black ? "#e0c987" : "#796b49";
          ctx.fillText(
            `C${Math.floor(midi / 12) - 1}`,
            x + keyWidth / 2,
            mapTop + 29,
            keyWidth,
          );
        }
        ctx.textAlign = "start";
      }
  };
  drawRef.current = draw;

  // Redraw with current props without rebuilding observer/listener subscriptions.
  useEffect(() => {
    drawRef.current();
  }, [
    song, position, transpose, count, zoom, muted, scroll, mapping, octave,
    manual, autoPolicy, splitPitch, focusMode, loopRange, notePalette, draftRange,
  ]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const redraw = () => drawRef.current();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    let observedScroller: HTMLElement | null = null;
    if (focusMode) {
      const focusApp = canvas.closest<HTMLElement>('.app[data-view="focus"]');
      const keys = focusApp?.querySelector<HTMLElement>(
        ".piano-housing .keys",
      );
      const scroller = keys?.parentElement;
      if (keys) observer.observe(keys);
      if (scroller) {
        observedScroller = scroller;
        observer.observe(scroller);
        scroller.addEventListener("scroll", redraw, { passive: true });
      }
    }
    redraw();
    return () => {
      observer.disconnect();
      observedScroller?.removeEventListener("scroll", redraw);
    };
  }, [focusMode]);
  const pointTime = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return position;
    const offset = offsetFromStage(canvas);
    return rollTimeAtPointer({
      clientX: event.clientX,
      clientY: event.clientY,
      viewportWidth: window.innerWidth,
      rotate,
      canvasTop: offset.top,
      canvasHeight: canvas.clientHeight,
      aligned: focusMode,
      position,
      zoom,
    });
  };
  return (
    <canvas
      ref={ref}
      className="roll"
      aria-label="Piano Roll：音符由上往下移動，底部琴鍵列顯示對應電腦按鍵"
      style={{ touchAction: loopSelectionArmed ? "none" : "auto", cursor: loopSelectionArmed ? "crosshair" : undefined }}
      onPointerDown={(event) => {
        if (!loopSelectionArmed || !onLoopSelect || (event.button !== 0 && event.pointerType !== "touch")) return;
        event.preventDefault();
        dragStart.current = pointTime(event);
        setDraftRange([dragStart.current, dragStart.current]);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStart.current === null) return;
        const end = pointTime(event);
        setDraftRange([Math.min(dragStart.current, end), Math.max(dragStart.current, end)]);
      }}
      onPointerUp={(event) => {
        if (!onLoopSelect || dragStart.current === null) return;
        const end = pointTime(event);
        const a = Math.max(0, Math.min(dragStart.current, end));
        const b = Math.max(a, Math.max(dragStart.current, end));
        dragStart.current = null;
        setDraftRange(null);
        if (b - a >= 0.1) onLoopSelect(a, b);
      }}
      onPointerCancel={() => { dragStart.current = null; setDraftRange(null); }}
      onLostPointerCapture={() => { dragStart.current = null; setDraftRange(null); }}
    />
  );
}
export function Sheet({ song }: { song: Song }) {
  const ref = useRef<HTMLDivElement>(null);
  const display = useRef<
    import("opensheetmusicdisplay").OpenSheetMusicDisplay | null
  >(null);
  const timestamps = useRef<number[]>([]);
  const index = useRef(0);
  const [ready, setReady] = useState(false);
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  useEffect(() => {
    let cancel = false;
    setReady(false);
    import("opensheetmusicdisplay")
      .then(async ({ OpenSheetMusicDisplay }) => {
        if (cancel) return;
        const osmd = new OpenSheetMusicDisplay(ref.current!, {
          autoResize: true,
          drawTitle: true,
          followCursor: false,
        });
        display.current = osmd;
        await osmd.load(song.xml!);
        if (cancel) return;
        osmd.render();
        const times: number[] = [];
        osmd.cursor.reset();
        while (!osmd.cursor.Iterator.EndReached && times.length < 100000) {
          times.push(osmd.cursor.Iterator.CurrentSourceTimestamp.RealValue * 4);
          osmd.cursor.next();
        }
        timestamps.current = times;
        osmd.cursor.reset();
        osmd.cursor.show();
        index.current = 0;
        setReady(true);
      })
      .catch((error: Error) => {
        console.error("Sheet rendering failed", error);
        if (ref.current)
          ref.current.textContent =
            "樂譜排版失敗，請使用 Piano Roll。 " + error.message;
      });
    return () => {
      cancel = true;
      display.current?.clear();
      display.current = null;
    };
  }, [song]);
  useEffect(() => {
    if (!ready || !display.current) return;
    let beat = 0;
    const tempos = song.tempos.length
      ? song.tempos
      : [{ time: 0, bpm: song.tempo }];
    for (let i = 0; i < tempos.length; i++) {
      const t = tempos[i];
      if (position < t.time) break;
      beat +=
        ((Math.min(position, tempos[i + 1]?.time ?? position) - t.time) *
          t.bpm) /
        60;
    }
    const times = timestamps.current;
    const target = Math.max(0, upperBound(times, beat + 0.001) - 1);
    const cursor = display.current.cursor;
    if (target < index.current) {
      cursor.reset();
      index.current = 0;
    }
    while (index.current < target && !cursor.Iterator.EndReached) {
      cursor.next();
      index.current++;
    }
    const container = ref.current;
    if (container) {
      let y = 0;
      let node = cursor.cursorElement as HTMLElement | null;
      while (node && node !== container) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      if (node !== container) y -= container.offsetTop;
      y += container.scrollTop;
      if (
        y < container.scrollTop ||
        y > container.scrollTop + container.clientHeight - 45
      )
        container.scrollTop = Math.max(0, y - 35);
    }
  }, [position, ready, song]);
  return <div className="sheet" ref={ref} />;
}
