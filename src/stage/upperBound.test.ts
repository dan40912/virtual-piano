import { describe, expect, it } from "vitest";
import { upperBound } from "./upperBound";

describe("upperBound", () => {
  it("returns the first value strictly after the target", () => {
    const values = [0, 1, 1, 2, 4];
    expect(upperBound(values, -1)).toBe(0);
    expect(upperBound(values, 1)).toBe(3);
    expect(upperBound(values, 3)).toBe(4);
    expect(upperBound(values, 4)).toBe(values.length);
    expect(upperBound([], 0)).toBe(0);
  });

  it("keeps the Sheet cursor at its first timestamp before playback begins", () => {
    const timestamps = [0, 0.5, 1];
    expect(Math.max(0, upperBound(timestamps, -0.001 + 0.001) - 1)).toBe(0);
    expect(Math.max(0, upperBound(timestamps, 0.499 + 0.001) - 1)).toBe(1);
  });
});
