import { describe, expect, it } from "vitest";
import type { Note } from "../music/model";
import { mostMissedSoundingPitch, practiceProgressResetPosition, practiceRestartPosition, selectPracticeFeedbackNotes } from "./feedback";

const notes: Note[] = [
  { id: "before", midi: 60, startTime: 1, duration: 0.25, velocity: 0.7, trackId: 0 },
  { id: "a", midi: 60, startTime: 2, duration: 0.25, velocity: 0.7, trackId: 0 },
  { id: "inside", midi: 62, startTime: 3, duration: 0.25, velocity: 0.7, trackId: 0 },
  { id: "at-b", midi: 64, startTime: 4, duration: 0.25, velocity: 0.7, trackId: 0 },
  { id: "after", midi: 60, startTime: 5, duration: 0.25, velocity: 0.7, trackId: 0 },
];

describe("rhythm practice feedback", () => {
  it("limits a loop's score and missed-note denominator to A inclusive and B exclusive", () => {
    expect(selectPracticeFeedbackNotes(notes, {
      muted: [], transpose: 0, startAt: 0, loop: true, loopA: 2, loopB: 4,
    }).map((note) => note.id)).toEqual(["a", "inside"]);
  });

  it("reports the sounding pitch after transpose", () => {
    expect(mostMissedSoundingPitch([notes[0], notes[4]], 2)).toEqual([62, 2]);
  });

  it("restarts wait practice from the song start or loop A", () => {
    expect(practiceRestartPosition("practice", "wait", false, 3, 7)).toBe(0);
    expect(practiceRestartPosition("practice", "wait", true, 3, 7)).toBe(3);
    expect(practiceRestartPosition("practice", "rhythm", true, 3, 7)).toBe(7);
  });

  it("keeps mode/track resets at the current position except for the old wait-loop step reset", () => {
    expect(practiceProgressResetPosition("practice", "wait", false, 3, 7)).toBe(7);
    expect(practiceProgressResetPosition("practice", "wait", true, 3, 7)).toBe(3);
    expect(practiceProgressResetPosition("practice", "rhythm", true, 3, 7)).toBe(7);
    expect(practiceProgressResetPosition("accompaniment", "wait", true, 3, 7)).toBe(7);
  });
});
