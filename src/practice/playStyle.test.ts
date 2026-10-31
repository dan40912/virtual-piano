import { expect, it } from "vitest";
import { accuracy, inPracticeHand, playStyleOf, styleModes, type PlayStyle } from "./playStyle";

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

it("reports accuracy against hits, wrong presses and misses", () => {
  expect(accuracy(0, 0, 0)).toBe(0);
  expect(accuracy(9, 1, 0)).toBe(90);
  expect(accuracy(3, 0, 1)).toBe(75);
});
