import { shortcutLabel } from "../music/keyboard";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isBlack, noteName } from "../music/model";
import { player } from "../audio/PlaybackScheduler";
export const Piano = memo(function Piano({
  count,
  mapping,
  active,
  expected,
  onDown,
  onUp,
  onSelect,
  mappingMode,
  autoEnabled = false,
  onScroll,
  scrollPosition,
  onBounds,
  visibleWhiteKeys = 18,
  rotate = false,
}: {
  count: number;
  mapping: Record<string, number>;
  active: Set<number>;
  expected: number[];
  onDown: (id: string, n: number) => void;
  onUp: (id: string) => void;
  onSelect: (n: number) => void;
  mappingMode: boolean;
  autoEnabled?: boolean;
  onScroll: (x: number) => void;
  scrollPosition: number;
  onBounds: (max: number) => void;
  visibleWhiteKeys?: number;
  rotate?: boolean;
}) {
  const start = count === 88 ? 21 : 36;
  const nums = Array.from({ length: count }, (_, i) => start + i);
  const whites = nums.filter((n) => !isBlack(n));
  const pointers = useRef(new Map<number, number>());
  const ref = useRef<HTMLDivElement>(null);
  const centeredRef = useRef(false);
  const [whiteKeyWidth, setWhiteKeyWidth] = useState(29);
  const bindingByMidi = useMemo(() => {
    const reverse = new Map<number, string>();
    for (const [key, midi] of Object.entries(mapping)) reverse.set(midi, key);
    return reverse;
  }, [mapping]);
  const scheduledActive = useSyncExternalStore(
    player.subscribeActiveNotes,
    player.getActiveNotesSnapshot,
    player.getActiveNotesSnapshot,
  );
  const visibleActive = useMemo(() => {
    if (!autoEnabled || scheduledActive.size === 0) return active;
    const merged = new Set(active);
    scheduledActive.forEach((midi) => merged.add(midi));
    return merged;
  }, [active, autoEnabled, scheduledActive]);
  const finishPointer = (pointerId: number) => {
    if (!pointers.current.has(pointerId)) return;
    onUp("pointer" + pointerId);
    pointers.current.delete(pointerId);
  };
  useEffect(() => {
    const root = ref.current!;
    const centerMiddleC = () => {
      const key = root.querySelector<HTMLElement>('[data-midi="60"]');
      if (!key || root.clientWidth <= 0 || root.scrollWidth <= root.clientWidth)
        return;
      const max = root.scrollWidth - root.clientWidth;
      const target = Math.max(
        0,
        Math.min(
          max,
          key.offsetLeft + key.offsetWidth / 2 - root.clientWidth / 2,
        ),
      );
      centeredRef.current = true;
      root.scrollLeft = target;
      onScroll(target);
    };
    const update = () => {
      onBounds(Math.max(0, root.scrollWidth - root.clientWidth));
      const mobileLandscape = window.matchMedia(
        "(orientation: landscape) and (max-height: 500px)",
      ).matches || rotate;
      const compactLayout = window.matchMedia(
        "(max-width: 767px), (orientation: landscape) and (max-height: 500px)",
      ).matches;
      const logicalWidth = root.clientWidth;
      const nextWidth = mobileLandscape
        ? logicalWidth > 0
          ? Math.max(14, logicalWidth / visibleWhiteKeys)
          : 29
        : compactLayout
        ? logicalWidth > 0
          ? Math.max(32, Math.min(84, logicalWidth / 11))
          : 29
        : 29;
      setWhiteKeyWidth((current) =>
        Math.abs(current - nextWidth) < 0.5 ? current : nextWidth,
      );
      centerMiddleC();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    const keys = root.firstElementChild;
    if (keys) observer.observe(keys);
    window.addEventListener("resize", centerMiddleC);
    window.addEventListener("orientationchange", centerMiddleC);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", centerMiddleC);
      window.removeEventListener("orientationchange", centerMiddleC);
    };
  }, [count, onBounds, onScroll, whiteKeyWidth, visibleWhiteKeys, rotate]);
  useEffect(() => {
    if (ref.current && centeredRef.current) {
      ref.current.scrollLeft = scrollPosition;
      onScroll(ref.current.scrollLeft);
    }
  }, [scrollPosition, onScroll]);
  return (
    <div
      className="keyboard-scroll"
      ref={ref}
      onScroll={(e) => onScroll(e.currentTarget.scrollLeft)}
    >
      <div
        className="keys"
        style={{ width: `max(100%, ${whites.length * whiteKeyWidth}px)` }}
        onPointerDown={(e) => {
          const key = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-midi]",
          );
          if (!key) return;
          const n = Number(key.dataset.midi);
          if (mappingMode) {
            onSelect(n);
            return;
          }
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture races while the keyboard is being reflowed.
          }
          pointers.current.set(e.pointerId, n);
          onDown("pointer" + e.pointerId, n);
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const key = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-midi]");
          const n = key ? Number(key.dataset.midi) : -1;
          if (n !== pointers.current.get(e.pointerId)) {
            onUp("pointer" + e.pointerId);
            pointers.current.set(e.pointerId, n);
            if (n >= 21) onDown("pointer" + e.pointerId, n);
          }
        }}
        onPointerUp={(e) => {
          finishPointer(e.pointerId);
        }}
        onPointerCancel={(e) => {
          finishPointer(e.pointerId);
        }}
        onLostPointerCapture={(e) => {
          finishPointer(e.pointerId);
        }}
      >
        {nums.map((n) => {
          const black = isBlack(n);
          const wi = whites.filter((w) => w < n).length;
          const width = 100 / whites.length;
          return (
            <button
              type="button"
              tabIndex={-1}
              aria-label={noteName(n)}
              title={`${noteName(n)} · ${shortcutLabel(bindingByMidi.get(n) || "未綁定")}`}
              key={n}
              data-midi={n}
              className={`piano-key ${black ? "black" : "white"} ${visibleActive.has(n) ? "pressed" : ""} ${expected.includes(n) ? "expected" : ""}`}
              style={{
                left: `${(wi - (black ? 0.32 : 0)) * width}%`,
                width: `${width * (black ? 0.64 : 1)}%`,
              }}
            >
              <span className="key-binding">
                {shortcutLabel(bindingByMidi.get(n) || "")}
              </span>
              <span className="note-label">{noteName(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
