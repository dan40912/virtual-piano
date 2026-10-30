import type { Note } from "../music/model";

export interface PracticeFeedbackRange {
  muted: number[];
  transpose: number;
  startAt: number;
  loop: boolean;
  loopA: number;
  loopB: number;
}

/** Notes eligible for rhythm score/miss feedback in the current exercise. */
export function selectPracticeFeedbackNotes(notes: Note[], range: PracticeFeedbackRange) {
  return notes.filter((note) => {
    const soundingPitch = note.midi + range.transpose;
    return !range.muted.includes(note.trackId) &&
      soundingPitch >= 21 && soundingPitch <= 108 &&
      note.startTime >= range.startAt &&
      (!range.loop || (note.startTime >= range.loopA && note.startTime < range.loopB));
  });
}

/** Return the most-missed sounding pitch, so the hint matches the transposed keyboard. */
export function mostMissedSoundingPitch(notes: Note[], transpose: number): [number, number] | undefined {
  const counts = new Map<number, number>();
  for (const note of notes) {
    const pitch = note.midi + transpose;
    counts.set(pitch, (counts.get(pitch) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
}

export function practiceRestartPosition(
  mode: string,
  practiceType: string,
  loop: boolean,
  loopA: number,
  currentPosition: number,
) {
  if (mode === "practice" && practiceType === "wait") return loop ? loopA : 0;
  return currentPosition;
}

/** Preserve the existing non-seeking reset semantics used by mode/track changes. */
export function practiceProgressResetPosition(
  mode: string,
  practiceType: string,
  loop: boolean,
  loopA: number,
  currentPosition: number,
) {
  return mode === "practice" && practiceType === "wait" && loop
    ? loopA
    : currentPosition;
}
