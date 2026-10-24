import { describe, expect, it } from "vitest";
import { toStage } from "./toStage";

describe("toStage", () => {
  it("maps the four screen corners into the rotated stage", () => {
    const width = 390;
    expect(toStage(0, 0, true, width)).toEqual({ x: 0, y: width });
    expect(toStage(width, 0, true, width)).toEqual({ x: 0, y: 0 });
    expect(toStage(0, 844, true, width)).toEqual({ x: 844, y: width });
    expect(toStage(width, 844, true, width)).toEqual({ x: 844, y: 0 });
  });

  it("maps the center into the center", () => {
    expect(toStage(195, 422, true, 390)).toEqual({ x: 422, y: 195 });
  });

  it("preserves coordinates when rotation is off", () => {
    expect(toStage(123, 456, false, 390)).toEqual({ x: 123, y: 456 });
  });
});
