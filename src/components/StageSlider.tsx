import { useRef, type PointerEvent, type KeyboardEvent } from "react";
import { toStage } from "../stage/toStage";

export type StageSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  rotate?: boolean;
  "aria-label": string;
  className?: string;
  markers?: Array<{
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    onCommit?: (value: number) => void;
  }>;
};

export function stageSliderValueAt(
  clientX: number,
  clientY: number,
  rotate: boolean,
  viewportWidth: number,
  left: number,
  width: number,
  min: number,
  max: number,
  step = 1,
) {
  const x = toStage(clientX, clientY, rotate, viewportWidth).x;
  const ratio = Math.max(0, Math.min(1, (x - left) / Math.max(1, width)));
  const raw = min + ratio * (max - min);
  const stepped = min + Math.round((raw - min) / step) * step;
  const precision = `${step}`.split(".")[1]?.length ?? 0;
  return Number(Math.max(min, Math.min(max, stepped)).toFixed(precision));
}

function stageLeft(element: HTMLElement) {
  let left = 0;
  let current: HTMLElement | null = element;
  while (current && !current.classList.contains("stage")) {
    left += current.offsetLeft;
    current = current.offsetParent as HTMLElement | null;
  }
  return left;
}

export function StageSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  onCommit,
  rotate = false,
  className = "",
  markers = [],
  ...aria
}: StageSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const markerDrag = useRef<string | null>(null);
  const skipPointerClick = useRef(false);
  const commit = (next: number) => {
    onChange(next);
    onCommit?.(next);
  };
  const update = (event: PointerEvent<HTMLDivElement>, markerId = markerDrag.current) => {
    const element = ref.current;
    if (!element) return value;
    const stage = element.closest<HTMLElement>(".stage");
    const width = element.offsetWidth || element.clientWidth || 1;
    const left = stage ? stageLeft(element) : element.offsetLeft;
    const next = stageSliderValueAt(
      event.clientX,
      event.clientY,
      rotate,
      window.innerWidth,
      left,
      width,
      min,
      max,
      step,
    );
    if (markerId) markers.find((marker) => marker.id === markerId)?.onChange(next);
    else onChange(next);
    return next;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    markerDrag.current = (event.target as HTMLElement)
      .closest<HTMLElement>("[data-slider-marker]")?.dataset.sliderMarker ?? null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    update(event);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const markerId = markerDrag.current;
    const next = update(event, markerId);
    if (markerId) markers.find((marker) => marker.id === markerId)?.onCommit?.(next);
    else onCommit?.(next);
    markerDrag.current = null;
    skipPointerClick.current = true;
    window.setTimeout(() => { skipPointerClick.current = false; }, 0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? step
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step
      : event.key === "Home" ? min - value
      : event.key === "End" ? max - value
      : 0;
    if (!delta) return;
    event.preventDefault();
    commit(Number(Math.max(min, Math.min(max, value + delta)).toFixed(`${step}`.split(".")[1]?.length ?? 0)));
  };
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      className={`stage-slider ${className}`.trim()}
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={aria["aria-label"]}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => { if (event.buttons || event.pointerType === "touch") update(event); }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        const marker = markers.find((item) => item.id === markerDrag.current);
        if (marker) marker.onCommit?.(marker.value);
        else onCommit?.(value);
        markerDrag.current = null;
      }}
      onClick={(event) => {
        if (skipPointerClick.current) {
          skipPointerClick.current = false;
          return;
        }
        const element = ref.current;
        if (!element) return;
        const stage = element.closest<HTMLElement>(".stage");
        const width = element.offsetWidth || element.clientWidth || 1;
        const left = stage ? stageLeft(element) : element.offsetLeft;
        const next = stageSliderValueAt(
          event.clientX,
          event.clientY,
          rotate,
          window.innerWidth,
          left,
          width,
          min,
          max,
          step,
        );
        onChange(next);
        onCommit?.(next);
      }}
      onKeyDown={onKeyDown}
    >
      <span className="stage-slider-track"><span style={{ width: `${percent}%` }} /></span>
      <span className="stage-slider-thumb" style={{ left: `${percent}%` }} />
      {markers.map((marker) => {
        const markerPercent = max === min ? 0 : ((marker.value - min) / (max - min)) * 100;
        return <span
          key={marker.id}
          className={`stage-slider-marker stage-slider-marker-${marker.id.toLowerCase()}`}
          data-slider-marker={marker.id}
          role="slider"
          tabIndex={0}
          aria-label={marker.label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={marker.value}
          style={{ left: `${markerPercent}%` }}
          onKeyDown={(event) => {
            const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? step
              : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step
              : event.key === "Home" ? min - marker.value
              : event.key === "End" ? max - marker.value : 0;
            if (!delta) return;
            event.preventDefault();
            event.stopPropagation();
            const next = Number(Math.max(min, Math.min(max, marker.value + delta)).toFixed(`${step}`.split(".")[1]?.length ?? 0));
            marker.onChange(next);
            marker.onCommit?.(next);
          }}
        />;
      })}
    </div>
  );
}
