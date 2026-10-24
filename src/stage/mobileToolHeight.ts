export const SPLIT_RATIO_MIN = 0.25;
export const SPLIT_RATIO_MAX = 0.65;
export const MOBILE_TOOL_HEIGHT_MIN = 104;
export const MOBILE_TOOL_HEIGHT_MAX = 214;

/** Converts the saved split ratio into the tool area's usable stage height. */
export function mobileToolHeight(
  stageHeight: number,
  splitRatio: number,
  reservedHeight = 0,
): number {
  const availableMax = Math.max(
    0,
    stageHeight - 44 - 24 - 110 - reservedHeight,
  );
  const maxHeight = Math.min(MOBILE_TOOL_HEIGHT_MAX, availableMax);
  const minHeight = Math.min(MOBILE_TOOL_HEIGHT_MIN, maxHeight);
  const range = SPLIT_RATIO_MAX - SPLIT_RATIO_MIN;
  const progress = Math.max(
    0,
    Math.min(1, (splitRatio - SPLIT_RATIO_MIN) / range),
  );
  return Math.round(minHeight + (maxHeight - minHeight) * progress);
}
