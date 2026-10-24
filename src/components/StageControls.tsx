import type { KeyboardEvent } from "react";

export type StageOption<T extends string | number> = { value: T; label: string };
export function StageSegmented<T extends string | number>({
  value, options, onChange, label, className = "",
}: { value: T; options: StageOption<T>[]; onChange: (value: T) => void; label: string; className?: string }) {
  return <div className={`stage-segmented ${className}`.trim()} role="group" aria-label={label}>
    {options.map((option) => <button key={String(option.value)} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function StageStepper({
  value, min, max, step, onChange, label, format = String,
}: { value: number; min: number; max: number; step: number; onChange: (value: number) => void; label: string; format?: (value: number) => string }) {
  const move = (direction: number) => onChange(Math.max(min, Math.min(max, Number((value + direction * step).toFixed(3)))));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); move(-1); }
  };
  return <div className="stage-stepper" role="group" aria-label={label} onKeyDown={onKeyDown}>
    <button type="button" aria-label={`${label}減少`} disabled={value <= min} onClick={() => move(-1)}>−</button>
    <output aria-live="polite">{format(value)}</output>
    <button type="button" aria-label={`${label}增加`} disabled={value >= max} onClick={() => move(1)}>＋</button>
  </div>;
}
