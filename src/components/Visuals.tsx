import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Song } from "../music/model";
import { isBlack } from "../music/model";
import { shortcutLabel } from "../music/keyboard";
import { player } from "../audio/PlaybackScheduler";
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
  autoPolicy?: Record<number, "all" | "bass" | "manual">;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const w = rect.width,
        h = rect.height;
      const start = count === 88 ? 21 : 36;
      const whites = Array.from({ length: count }, (_, i) => start + i).filter(
        (n) => !isBlack(n),
      );
      const unit = Math.max(w, whites.length * 29) / whites.length;
      const chartBottom = h - 34;
      ctx.strokeStyle = "#ffffff08";
      for (let i = 0; i <= whites.length; i++) {
        ctx.beginPath();
        ctx.moveTo(i * unit - scroll, 0);
        ctx.lineTo(i * unit - scroll, h);
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
        const x =
          (whites.filter((v) => v < midi).length - (black ? 0.32 : 0)) * unit -
          scroll;
        const policy = autoPolicy?.[n.trackId];
        const automatic = policy === "all" || (policy === "bass" && midi <= 60);
        ctx.fillStyle = autoPolicy
          ? automatic
            ? "#c9b788"
            : "#85b5a7"
          : ["#c9b788", "#85b5a7", "#99a9cf", "#c594a5"][n.trackId % 4];
        ctx.globalAlpha = bottom >= chartBottom ? 0.95 : 0.72;
        ctx.beginPath();
        ctx.roundRect(x + 2, top, unit * (black ? 0.64 : 1) - 4, height - 2, 3);
        ctx.fill();
        const label = shortcuts.get(midi);
        const keyWidth = unit * (black ? 0.64 : 1) - 6;
        if (manual && label && height > 13 && keyWidth > 10) {
          ctx.globalAlpha = 0.94;
          ctx.fillStyle = "#161811";
          ctx.font = `${Math.min(9, Math.max(6, unit * 0.25))}px monospace`;
          ctx.fillText(label, x + 4, Math.max(10, top + 11), keyWidth);
        }
      }
      ctx.globalAlpha = 1;
      const mapTop = h - 34;
      ctx.fillStyle = "#0a0d0a";
      ctx.fillRect(0, mapTop, w, 34);
      ctx.strokeStyle = "#c9b78866";
      ctx.beginPath();
      ctx.moveTo(0, mapTop);
      ctx.lineTo(w, mapTop);
      ctx.stroke();
      for (let midi = start; midi < start + count; midi++) {
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
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [
    song,
    position,
    transpose,
    count,
    zoom,
    muted,
    scroll,
    mapping,
    octave,
    manual,
    autoPolicy,
    transpose,
  ]);
  return (
    <canvas
      ref={ref}
      className="roll"
      aria-label="Piano Roll：音符由上往下移動，底部琴鍵列顯示對應電腦按鍵"
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
    let target = 0;
    for (let i = 0; i < times.length && times[i] <= beat + 0.001; i++)
      target = i;
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
      const y =
        cursor.cursorElement.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      if (
        y < container.scrollTop ||
        y > container.scrollTop + container.clientHeight - 45
      )
        container.scrollTop = Math.max(0, y - 35);
    }
  }, [position, ready, song]);
  return <div className="sheet" ref={ref} />;
}
