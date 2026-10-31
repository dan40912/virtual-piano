import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import type { Song } from "../music/model";
import { isBlack } from "../music/model";
import { shortcutLabel } from "../music/keyboard";
import { player } from "../audio/PlaybackScheduler";
import { useSettings } from "../store";
import { rollTimeAtPointer } from "../stage/rollSelection";
import { upperBound } from "../stage/upperBound";
import { barTimes } from "../stage/bars";
import { isAutomaticNote, type AutoPolicy } from "../practice/handSplit";
import { inPracticeHand, type PracticeHand } from "../practice/playStyle";

/** Height of the glowing strike line at the bottom of the waterfall. */
const STRIKE = 3;
const RIGHT_HAND = { fill: "#e3c27a", glow: "#ffd98a" };
const LEFT_HAND = { fill: "#6cc1b2", glow: "#8ff0dc" };
const ACCESSIBLE_MANUAL = { fill: "#5aa2e6", glow: "#a9d4ff" };
const ACCESSIBLE_AUTO = { fill: "#e0ad45", glow: "#ffd27a" };

export type RollJudge = {
  /** Note ids the player already hit in the current exercise. */
  hits: Set<string>;
  /** Manual notes that started before this time without a hit are drawn as missed. */
  missBefore: number;
  /** Whether a note counts toward the exercise (hand, track, loop filters). */
  counts: (noteId: string) => boolean;
};

type KeyGeometry = Map<number, { left: number; width: number }>;

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
  loopRange,
  onLoopSelect,
  loopSelectionArmed = false,
  judge,
  practiceHand,
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
  loopRange?: { enabled: boolean; a: number; b: number };
  onLoopSelect?: (a: number, b: number) => void;
  loopSelectionArmed?: boolean;
  judge?: RollJudge;
  /** In practice modes, notes for the other hand are drawn dimmed like accompaniment. */
  practiceHand?: PracticeHand;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<number | null>(null);
  const geometry = useRef<{ keys: KeyGeometry; dirty: boolean }>({ keys: new Map(), dirty: true });
  const [draftRange, setDraftRange] = useState<[number, number] | null>(null);
  const notePalette = useSettings((settings) => settings.notePalette);
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  const drawRef = useRef<() => void>(() => {});
  const keyRow = () =>
    ref.current?.closest<HTMLElement>(".vp")?.querySelector<HTMLElement>(".keys") ?? null;
  /** Key positions relative to the canvas, re-measured only after resize or scroll. */
  const measureKeys = (canvas: HTMLCanvasElement) => {
    if (!geometry.current.dirty) return geometry.current.keys;
    const keys: KeyGeometry = new Map();
    const row = keyRow();
    if (row) {
      const origin = canvas.getBoundingClientRect().left;
      row.querySelectorAll<HTMLElement>(".piano-key[data-midi]").forEach((key) => {
        const rect = key.getBoundingClientRect();
        keys.set(Number(key.dataset.midi), { left: rect.left - origin, width: rect.width });
      });
    }
    geometry.current = { keys, dirty: keys.size === 0 };
    return keys;
  };
  const draw = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (width <= 0 || height <= 0) return;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    const start = count === 88 ? 21 : 36;
    const whites = Array.from({ length: count }, (_, i) => start + i).filter((n) => !isBlack(n));
    const unit = Math.max(width, whites.length * 22) / whites.length;
    const keys = measureKeys(canvas);
    const keyAt = (midi: number) => {
      const measured = keys.get(midi);
      if (measured) return measured;
      const black = isBlack(midi);
      return {
        left: (whites.filter((v) => v < midi).length - (black ? 0.32 : 0)) * unit - scroll,
        width: unit * (black ? 0.64 : 1),
      };
    };
    const bottom = height - STRIKE;
    const yAt = (time: number) => bottom - (time - position) * zoom;
    const visibleUntil = position + bottom / zoom;

    // Lanes: a faint column behind every black key helps the eye track pitch.
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let midi = start; midi < start + count; midi++) {
      if (!isBlack(midi)) continue;
      const key = keyAt(midi);
      if (key.left + key.width < 0 || key.left > width) continue;
      ctx.fillRect(key.left, 0, key.width, bottom);
    }
    // Octave guides at every C.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let midi = start; midi < start + count; midi++) {
      if (midi % 12 !== 0) continue;
      const x = Math.round(keyAt(midi).left) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    if (song) {
      ctx.font = "600 11px Manrope, 'Noto Sans TC', sans-serif";
      for (const bar of barTimes(song, Math.max(0, position - 1), visibleUntil)) {
        const y = Math.round(yAt(bar.time)) + 0.5;
        if (y < 0 || y > bottom + 1) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(236,228,206,0.42)";
        ctx.fillText(String(bar.index), 10, y - 6);
      }
    }

    if (loopRange?.enabled) {
      const ay = yAt(loopRange.a);
      const by = yAt(loopRange.b);
      if (by <= bottom && ay >= 0) {
        ctx.fillStyle = "rgba(227,194,122,0.08)";
        ctx.fillRect(0, Math.max(0, by), width, Math.min(bottom, ay) - Math.max(0, by));
      }
      for (const [time, label] of [[loopRange.a, "A"], [loopRange.b, "B"]] as const) {
        const y = yAt(time);
        if (y < 0 || y > bottom) continue;
        ctx.strokeStyle = "#e3c27a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#e3c27a";
        ctx.beginPath();
        ctx.roundRect(width - 30, y - 10, 22, 20, 6);
        ctx.fill();
        ctx.fillStyle = "#17140c";
        ctx.font = "700 12px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, width - 19, y + 4);
        ctx.textAlign = "start";
      }
    }
    if (draftRange) {
      const y1 = yAt(draftRange[0]);
      const y2 = yAt(draftRange[1]);
      const top = Math.max(0, Math.min(y1, y2));
      const end = Math.min(bottom, Math.max(y1, y2));
      if (end > top) {
        ctx.fillStyle = "rgba(141,185,228,0.18)";
        ctx.fillRect(0, top, width, end - top);
      }
    }

    const shortcuts = new Map(
      Object.entries(mapping).map(([key, midi]) => [midi + octave * 12, shortcutLabel(key)]),
    );
    const sounding: { x: number; w: number; glow: string }[] = [];
    for (const n of song?.notes || []) {
      if (muted.includes(n.trackId)) continue;
      const midi = n.midi + transpose;
      if (midi < start || midi >= start + count) continue;
      const noteBottom = yAt(n.startTime);
      const noteHeight = Math.max(6, n.duration * zoom);
      const top = noteBottom - noteHeight;
      if (noteBottom < 0 || top > bottom) continue;
      const key = keyAt(midi);
      if (key.left + key.width < 0 || key.left > width) continue;
      const automatic = autoPolicy
        ? isAutomaticNote(autoPolicy[n.trackId], midi, splitPitch)
        : practiceHand ? !inPracticeHand(practiceHand, midi, splitPitch) : false;
      const manualNote = manual && !automatic;
      const palette = notePalette === "accessible"
        ? manualNote ? ACCESSIBLE_MANUAL : ACCESSIBLE_AUTO
        : midi > splitPitch ? RIGHT_HAND : LEFT_HAND;
      const counted = judge?.counts(n.id) ?? false;
      const hit = counted && judge!.hits.has(n.id);
      const missed = counted && !hit && n.startTime < judge!.missBefore;
      const striking = noteBottom >= bottom && top <= bottom;
      const inset = Math.min(2, key.width * 0.08);
      const x = key.left + inset;
      const w = Math.max(3, key.width - inset * 2);
      const h = Math.max(4, Math.min(noteBottom, bottom) - Math.max(top, -8) - 1);
      const y = Math.max(top, -8);
      ctx.globalAlpha = missed ? 0.32 : automatic ? 0.42 : striking || hit ? 1 : 0.86;
      ctx.fillStyle = missed ? "#6b6a66" : palette.fill;
      if ((striking || hit) && !missed) {
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(5, w / 3));
      ctx.fill();
      ctx.shadowBlur = 0;
      if (automatic) {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = palette.fill;
        ctx.stroke();
      }
      if (notePalette === "accessible" && manualNote && !missed) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#e5f3ff";
        ctx.stroke();
      }
      const label = shortcuts.get(midi);
      if (manualNote && label && h >= 18 && w >= 16) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#15130d";
        ctx.font = "700 11px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, x + w / 2, Math.min(noteBottom, bottom) - 6, w - 2);
        ctx.textAlign = "start";
      }
      if (striking && !missed && !automatic) sounding.push({ x, w, glow: palette.glow });
    }
    ctx.globalAlpha = 1;

    // Strike line: a warm rail where notes meet the keys, flaring above struck keys.
    const rail = ctx.createLinearGradient(0, bottom - 18, 0, height);
    rail.addColorStop(0, "rgba(227,194,122,0)");
    rail.addColorStop(1, "rgba(227,194,122,0.22)");
    ctx.fillStyle = rail;
    ctx.fillRect(0, bottom - 18, width, 18 + STRIKE);
    ctx.fillStyle = "#e3c27a";
    ctx.fillRect(0, bottom, width, STRIKE);
    for (const flare of sounding) {
      const glow = ctx.createRadialGradient(flare.x + flare.w / 2, bottom, 0, flare.x + flare.w / 2, bottom, 36);
      glow.addColorStop(0, flare.glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = glow;
      ctx.fillRect(flare.x - 30, bottom - 36, flare.w + 60, 36 + STRIKE);
    }
    ctx.globalAlpha = 1;
  };
  drawRef.current = draw;

  // Redraw with current props without rebuilding observer/listener subscriptions.
  useEffect(() => {
    drawRef.current();
  }, [
    song, position, transpose, count, zoom, muted, scroll, mapping, octave,
    manual, autoPolicy, splitPitch, loopRange, notePalette, draftRange, judge, practiceHand,
  ]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const remeasure = () => {
      geometry.current.dirty = true;
      drawRef.current();
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(canvas);
    const keys = keyRow();
    const scroller = keys?.parentElement ?? null;
    if (keys) observer.observe(keys);
    if (scroller) {
      observer.observe(scroller);
      scroller.addEventListener("scroll", remeasure, { passive: true });
    }
    remeasure();
    return () => {
      observer.disconnect();
      scroller?.removeEventListener("scroll", remeasure);
    };
  }, [count]);
  const pointTime = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return position;
    const rect = canvas.getBoundingClientRect();
    return rollTimeAtPointer({
      clientX: event.clientX,
      clientY: event.clientY,
      viewportWidth: window.innerWidth,
      rotate: false,
      canvasTop: rect.top,
      canvasHeight: canvas.clientHeight,
      aligned: true,
      position,
      zoom,
    });
  };
  return (
    <canvas
      ref={ref}
      className="roll"
      aria-label="音符瀑布：音符由上往下落，碰到金色線時彈奏對應琴鍵"
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
