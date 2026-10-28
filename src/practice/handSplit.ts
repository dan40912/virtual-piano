export type AutoPolicy = "all" | "bass" | "treble" | "manual";

/** Bass owns the boundary note; treble starts strictly above it. */
export function isAutomaticNote(
  policy: AutoPolicy | undefined,
  midi: number,
  splitPitch = 60,
) {
  if (policy === "all") return true;
  if (policy === "bass") return midi <= splitPitch;
  if (policy === "treble") return midi > splitPitch;
  return false;
}
