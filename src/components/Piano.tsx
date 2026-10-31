import { shortcutLabel } from "../music/keyboard";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { isBlack, noteName } from "../music/model";
import { keyLabel } from "../music/chords";
import { player } from "../audio/PlaybackScheduler";
import type { KeyLabelMode } from "../store";
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
  swipeScrollEnabled = false,
  chordMapping = {},
  chordEnabled = false,
  labels = "both",
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
  swipeScrollEnabled?: boolean;
  chordMapping?: Record<string, string>;
  chordEnabled?: boolean;
  labels?: KeyLabelMode;
}) {
  const start = count === 88 ? 21 : 36;
  const showLetters = labels === "both" || labels === "letters";
  const showNotes = labels === "both" || labels === "notes";
  const nums = Array.from({ length: count }, (_, i) => start + i);
  const whites = nums.filter((n) => !isBlack(n));
  const pointers = useRef(new Map<number, number>());
  const ref = useRef<HTMLDivElement>(null);
  const centeredRef = useRef(false);
  const whiteKeyWidth = useRef(29);
  const bindingByMidi = useMemo(() => {
    const reverse = new Map<number, string>();
    for (const [key, midi] of Object.entries(mapping)) reverse.set(midi, key);
    return reverse;
  }, [mapping]);
  const chordOverrideByMidi = useMemo(() => {
    const overrides = new Map<number, { key: string; chord: string }>();
    if (!chordEnabled) return overrides;
    for (const [key, chord] of Object.entries(chordMapping)) {
      if (mapping[key] !== undefined)
        overrides.set(mapping[key], { key, chord });
    }
    return overrides;
  }, [chordEnabled, chordMapping, mapping]);
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
    const centerMappedRange = () => {
      const mapped = Object.values(mapping);
      const centerMidi = mapped.length
        ? Math.round((Math.min(...mapped) + Math.max(...mapped)) / 2)
        : 60;
      const key = root.querySelector<HTMLElement>(`[data-midi="${centerMidi}"]`);
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
      const logicalWidth = root.clientWidth;
      const touchDevice = window.matchMedia(
        "(hover: none) and (pointer: coarse)",
      ).matches;
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      // Touch: show a fixed number of white keys (two octaves at most in portrait)
      // so each key stays playable. Pointer: fit the whole range when keys stay
      // at least 22px wide, otherwise scroll horizontally.
      const visible = portrait ? Math.min(visibleWhiteKeys, 14) : visibleWhiteKeys;
      const nextWidth = logicalWidth <= 0
        ? 40
        : touchDevice
          ? Math.max(22, logicalWidth / visible)
          : Math.max(22, Math.min(64, logicalWidth / whites.length));
      if (Math.abs(whiteKeyWidth.current - nextWidth) >= 0.5) {
        whiteKeyWidth.current = nextWidth;
        const keyRow = root.firstElementChild as HTMLElement | null;
        if (keyRow) keyRow.style.width = `max(100%, ${whites.length * nextWidth}px)`;
      }
      centerMappedRange();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    const keys = root.firstElementChild;
    if (keys) observer.observe(keys);
    window.addEventListener("resize", centerMappedRange);
    window.addEventListener("orientationchange", centerMappedRange);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", centerMappedRange);
      window.removeEventListener("orientationchange", centerMappedRange);
    };
  }, [count, mapping, onBounds, onScroll, visibleWhiteKeys, whites.length]);
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
        style={{
          width: `max(100%, ${whites.length * whiteKeyWidth.current}px)`,
          touchAction: swipeScrollEnabled ? "pan-x" : "none",
        }}
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
          if (swipeScrollEnabled) return;
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
          const chordOverride = chordOverrideByMidi.get(n);
          const binding = bindingByMidi.get(n) || "";
          return (
            <button
              type="button"
              tabIndex={-1}
              aria-label={chordOverride ? `${noteName(n)}；${keyLabel(chordOverride.key)} 鍵目前演奏 ${chordOverride.chord} 和弦` : noteName(n)}
              title={chordOverride ? `${noteName(n)} · ${keyLabel(chordOverride.key)} 目前演奏 ${chordOverride.chord} 和弦` : `${noteName(n)} · ${shortcutLabel(binding || "未綁定")}`}
              key={n}
              data-midi={n}
              className={`piano-key ${black ? "black" : "white"} ${bindingByMidi.has(n) ? "mapped" : ""} ${visibleActive.has(n) ? "pressed" : ""} ${expected.includes(n) ? "expected" : ""}`}
              style={{
                left: `${(wi - (black ? 0.32 : 0)) * width}%`,
                width: `${width * (black ? 0.64 : 1)}%`,
                touchAction: swipeScrollEnabled ? "pan-x" : "none",
              }}
            >
              {showLetters && (chordOverride || binding) && (
                <span className="key-binding">
                  {chordOverride ? `♬${keyLabel(chordOverride.key)}` : shortcutLabel(binding)}
                </span>
              )}
              {showNotes && !black && (labels === "notes" || n % 12 === 0) && (
                <span className={`note-label ${n % 12 === 0 ? "is-c" : ""}`}>{noteName(n)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
