export type AutoPolicy = "all" | "bass" | "treble" | "manual";
export const DEFAULT_SPLIT_PITCH = 60;

/** Bass owns the boundary note; treble starts strictly above it. */
export function isAutomaticNote(
  policy: AutoPolicy | undefined,
  midi: number,
  splitPitch = DEFAULT_SPLIT_PITCH,
) {
  if (policy === "all") return true;
  if (policy === "bass") return midi <= splitPitch;
  if (policy === "treble") return midi > splitPitch;
  return false;
}

export function shouldMarkRollManual(
  manualFollow: boolean,
  mode: string,
  practiceType: string,
) {
  return manualFollow || (mode === "practice" && practiceType === "wait");
}
