export type StagePoint = { x: number; y: number };

/** Converts screen coordinates into the logical stage coordinates. */
export function toStage(
  clientX: number,
  clientY: number,
  rotate: boolean,
  viewportWidth: number,
): StagePoint {
  return rotate
    ? { x: clientY, y: viewportWidth - clientX }
    : { x: clientX, y: clientY };
}
