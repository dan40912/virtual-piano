import { expect, it } from "vitest";
import { accuracy, defaultHand, inPracticeHand, noteInHand, playStyleOf, styleModes, type PlayStyle } from "./playStyle";

it("round-trips every play style through the engine's mode and practice type", () => {
  for (const style of ["listen", "follow", "wait", "rhythm"] as PlayStyle[]) {
    const { mode, practiceType } = styleModes(style);
    expect(playStyleOf(mode, practiceType)).toBe(style);
  }
});

it("splits hands at the split pitch with the split note in the left hand", () => {
  expect(inPracticeHand("left", 60, 60)).toBe(true);
  expect(inPracticeHand("right", 60, 60)).toBe(false);
  expect(inPracticeHand("right", 61, 60)).toBe(true);
  expect(inPracticeHand("both", 20, 60)).toBe(true);
});

it("defaults to the right hand only when both hands carry real parts", () => {
  const melody = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60].map((midi) => ({ midi }));
  expect(defaultHand(melody, 60)).toBe("both");
  const twoHands = [48, 52, 55, 64, 67, 72].map((midi) => ({ midi }));
  expect(defaultHand(twoHands, 60)).toBe("right");
  expect(defaultHand([], 60)).toBe("both");
});

it("splits multi-track songs by track and single-track songs by pitch", () => {
  const melodyC4 = { midi: 60, trackId: 0 };
  expect(noteInHand("right", melodyC4, 60, 0, true)).toBe(true);
  expect(noteInHand("right", melodyC4, 60, 0, false)).toBe(false);
  expect(noteInHand("left", { midi: 72, trackId: 1 }, 60, 0, true)).toBe(true);
  expect(defaultHand([{ midi: 60, trackId: 0 }, { midi: 48, trackId: 1 }], 60)).toBe("right");
});

it("reports accuracy against hits, wrong presses and misses", () => {
  expect(accuracy(0, 0, 0)).toBe(0);
  expect(accuracy(9, 1, 0)).toBe(90);
  expect(accuracy(3, 0, 1)).toBe(75);
});
