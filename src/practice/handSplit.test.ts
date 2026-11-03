import { describe, expect, it } from "vitest";
import { isAutomaticNote, shouldAutoPlayNote, shouldMarkRollManual } from "./handSplit";

describe("automatic hand split", () => {
  it("assigns the boundary to bass and starts treble strictly above it", () => {
    expect(isAutomaticNote("bass", 60, 60)).toBe(true);
    expect(isAutomaticNote("bass", 61, 60)).toBe(false);
    expect(isAutomaticNote("treble", 60, 60)).toBe(false);
    expect(isAutomaticNote("treble", 61, 60)).toBe(true);
    expect(isAutomaticNote("all", 36, 60)).toBe(true);
    expect(isAutomaticNote("manual", 84, 60)).toBe(false);
  });

  it("uses the transposed sounding pitch consistently across policies", () => {
    const sourceMidi = 59;
    const transpose = 2;
    const soundingMidi = sourceMidi + transpose;
    expect(isAutomaticNote("bass", soundingMidi, 60)).toBe(false);
    expect(isAutomaticNote("treble", soundingMidi, 60)).toBe(true);
    expect(isAutomaticNote("bass", sourceMidi, 60)).toBe(true);
  });

  it("keeps all notes in non-accompaniment modes and applies the same split by track in accompaniment", () => {
    const note = { id: "c", midi: 59, startTime: 1, duration: 1, velocity: 0.7, trackId: 0 };
    expect(shouldAutoPlayNote(note, false, { 0: "manual" }, 2, 60)).toBe(true);
    expect(shouldAutoPlayNote(note, true, { 0: "bass" }, 2, 60)).toBe(false);
    expect(shouldAutoPlayNote(note, true, { 0: "treble" }, 2, 60)).toBe(true);
  });

  it("marks wait-practice Roll notes as manual without changing existing modes", () => {
    expect(shouldMarkRollManual(false, "practice", "wait")).toBe(true);
    expect(shouldMarkRollManual(true, "practice", "rhythm")).toBe(true);
    expect(shouldMarkRollManual(true, "accompaniment", "rhythm")).toBe(true);
    expect(shouldMarkRollManual(false, "auto", "rhythm")).toBe(false);
  });
});
