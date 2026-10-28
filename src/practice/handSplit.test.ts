import { describe, expect, it } from "vitest";
import { isAutomaticNote } from "./handSplit";

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
});
