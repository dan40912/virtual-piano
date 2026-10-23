import { shortcutLabel } from "../music/keyboard";
import { memo, useEffect, useRef } from "react";
import { isBlack, noteName } from "../music/model";
export const Piano = memo(function Piano({
  count,
  mapping,
  active,
  expected,
  onDown,
  onUp,
  onSelect,
  mappingMode,
  onScroll,
  scrollPosition,
  onBounds,
}: {
  count: number;
  mapping: Record<string, number>;
  active: Set<number>;
  expected: number[];
  onDown: (id: string, n: number) => void;
  onUp: (id: string) => void;
  onSelect: (n: number) => void;
  mappingMode: boolean;
  onScroll: (x: number) => void;
  scrollPosition: number;
  onBounds: (max: number) => void;
}) {
  const start = count === 88 ? 21 : 36;
  const nums = Array.from({ length: count }, (_, i) => start + i);
  const whites = nums.filter((n) => !isBlack(n));
  const pointers = useRef(new Map<number, number>());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!;
    const update = () => {
      onBounds(Math.max(0, root.scrollWidth - root.clientWidth));
      onScroll(root.scrollLeft);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [count, onBounds, onScroll]);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollLeft = scrollPosition;
      onScroll(ref.current.scrollLeft);
    }
  }, [scrollPosition, onScroll]);
  useEffect(() => {
    const root = ref.current;
    const key = root?.querySelector<HTMLElement>('[data-midi="60"]');
    if (root && key) {
      root.scrollLeft = key.offsetLeft - root.clientWidth / 2;
      onScroll(root.scrollLeft);
    }
  }, [count, onScroll]);
  return (
    <div
      className="keyboard-scroll"
      ref={ref}
      onScroll={(e) => onScroll(e.currentTarget.scrollLeft)}
    >
      <div
        className="keys"
        style={{ width: `max(100%, ${whites.length * 29}px)` }}
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
          e.currentTarget.setPointerCapture(e.pointerId);
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
          onUp("pointer" + e.pointerId);
          pointers.current.delete(e.pointerId);
        }}
        onPointerCancel={(e) => {
          onUp("pointer" + e.pointerId);
          pointers.current.delete(e.pointerId);
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
              title={`${noteName(n)} · ${shortcutLabel(Object.entries(mapping).find(([, v]) => v === n)?.[0] || "未綁定")}`}
              key={n}
              data-midi={n}
              className={`piano-key ${black ? "black" : "white"} ${active.has(n) ? "pressed" : ""} ${expected.includes(n) ? "expected" : ""}`}
              style={{
                left: `${(wi - (black ? 0.32 : 0)) * width}%`,
                width: `${width * (black ? 0.64 : 1)}%`,
              }}
            >
              <span className="key-binding">
                {shortcutLabel(
                  Object.entries(mapping).find(([, v]) => v === n)?.[0] || "",
                )}
              </span>
              <span className="note-label">{noteName(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
