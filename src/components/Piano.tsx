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
import { keyLabel } from "../music/chords";
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
  swipeScrollEnabled = false,
  chordMapping = {},
  chordEnabled = false,
  rotate = false,
  keyboardPedal = "",
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
  rotate?: boolean;
  keyboardPedal?: string;
}) {
  const start = count === 88 ? 21 : 36;
  const nums = Array.from({ length: count }, (_, i) => start + i);
  const whites = nums.filter((n) => !isBlack(n));
  const pointers = useRef(new Map<number, number>());
  const keyElements = useRef(new Map<number, HTMLButtonElement>());
  const [requestedTabMidi, setRequestedTabMidi] = useState(60);
  const tabMidi = nums.includes(requestedTabMidi) ? requestedTabMidi : nums[0];
  const keyboardHeld = useRef(new Map<string, number>());
  const assistiveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
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
  const focusKey = (midi: number) => {
    setRequestedTabMidi(midi);
    keyElements.current.get(midi)?.focus();
  };
  const releaseKeyboardKeys = () => {
    for (const id of keyboardHeld.current.keys()) onUp(id);
    keyboardHeld.current.clear();
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, midi: number) => {
    const index = nums.indexOf(midi);
    const targetMidi = event.key === "ArrowLeft" ? nums[Math.max(0, index - 1)]
      : event.key === "ArrowRight" ? nums[Math.min(nums.length - 1, index + 1)]
        : event.key === "ArrowUp" ? nums[Math.min(nums.length - 1, index + 12)]
          : event.key === "ArrowDown" ? nums[Math.max(0, index - 12)]
            : event.key === "Home" ? nums[0]
              : event.key === "End" ? nums[nums.length - 1]
                : undefined;
    if (targetMidi !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      focusKey(targetMidi);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    // Space may already be the user's configured sustain shortcut. In that
    // case, leave it to App's existing global pedal handler; Enter remains
    // available to activate the focused piano key.
    if (event.key === " " && keyboardPedal && event.code === keyboardPedal) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (mappingMode) {
      onSelect(midi);
      return;
    }
    const id = `accessible:${midi}`;
    if (keyboardHeld.current.has(id)) return;
    keyboardHeld.current.set(id, midi);
    onDown(id, midi);
  };
  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>, midi: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.key === " " && keyboardPedal && event.code === keyboardPedal) return;
    event.preventDefault();
    event.stopPropagation();
    const id = `accessible:${midi}`;
    if (!keyboardHeld.current.has(id)) return;
    keyboardHeld.current.delete(id);
    onUp(id);
  };
  const handleAssistiveClick = (event: React.MouseEvent<HTMLButtonElement>, midi: number) => {
    // Pointer input already has press/release semantics in the parent. Only
    // zero-detail activation (for example, a screen reader's button action)
    // needs this fallback.
    if (event.detail !== 0) return;
    if (mappingMode) {
      onSelect(midi);
      return;
    }
    const oldTimer = assistiveTimers.current.get(midi);
    if (oldTimer) clearTimeout(oldTimer);
    const id = `assistive:${midi}`;
    if (!oldTimer) onDown(id, midi);
    assistiveTimers.current.set(midi, setTimeout(() => {
      onUp(id);
      assistiveTimers.current.delete(midi);
    }, 140));
  };
  useEffect(() => () => {
    releaseKeyboardKeys();
    for (const [midi, timer] of assistiveTimers.current) {
      clearTimeout(timer);
      onUp(`assistive:${midi}`);
    }
    assistiveTimers.current.clear();
    for (const pointerId of pointers.current.keys()) finishPointer(pointerId);
  }, []);
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
      const mobileLandscape = window.matchMedia(
        "(orientation: landscape) and (max-height: 500px)",
      ).matches || rotate;
      const compactLayout = window.matchMedia(
        "(max-width: 767px), (orientation: landscape) and (max-height: 500px)",
      ).matches;
      const touchDevice = window.matchMedia(
        "(hover: none) and (pointer: coarse)",
      ).matches;
      const logicalWidth = root.clientWidth;
      const nextWidth = mobileLandscape || touchDevice
        ? logicalWidth > 0
          ? Math.max(14, logicalWidth / visibleWhiteKeys)
          : 29
        : compactLayout
        ? logicalWidth > 0
          ? Math.max(32, Math.min(84, logicalWidth / 11))
          : 29
        : logicalWidth > 0
        ? Math.max(36, Math.min(52, logicalWidth / 36))
        : 40;
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
  }, [count, mapping, onBounds, onScroll, visibleWhiteKeys, rotate]);
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
              ref={(element) => {
                if (element) keyElements.current.set(n, element);
                else keyElements.current.delete(n);
              }}
              tabIndex={n === tabMidi ? 0 : -1}
              aria-label={chordOverride
                ? `${noteName(n)}；${keyLabel(chordOverride.key)} 鍵目前演奏 ${chordOverride.chord} 和弦`
                : binding ? `${noteName(n)}，電腦鍵 ${shortcutLabel(binding)}` : noteName(n)}
              title={chordOverride ? `${noteName(n)} · ${keyLabel(chordOverride.key)} 目前演奏 ${chordOverride.chord} 和弦` : `${noteName(n)} · ${shortcutLabel(binding || "未綁定")}`}
              key={n}
              data-midi={n}
              className={`piano-key ${black ? "black" : "white"} ${bindingByMidi.has(n) ? "mapped" : ""} ${visibleActive.has(n) ? "pressed" : ""} ${expected.includes(n) ? "expected" : ""}`}
              onFocus={() => setRequestedTabMidi(n)}
              onBlur={releaseKeyboardKeys}
              onKeyDown={(event) => handleKeyDown(event, n)}
              onKeyUp={(event) => handleKeyUp(event, n)}
              onClick={(event) => handleAssistiveClick(event, n)}
              onMouseDown={(event) => {
                // Keep desktop mouse playing from moving focus onto a key.
                // Touch and pen retain native focus behavior; Tab can still
                // enter the keyboard for accessible key activation.
                event.preventDefault();
              }}
              style={{
                left: `${(wi - (black ? 0.32 : 0)) * width}%`,
                width: `${width * (black ? 0.64 : 1)}%`,
                touchAction: swipeScrollEnabled ? "pan-x" : "none",
              }}
            >
              <span className="key-binding">
                {chordOverride ? `♬${keyLabel(chordOverride.key)}` : shortcutLabel(binding)}
              </span>
              <span className="note-label">{noteName(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
