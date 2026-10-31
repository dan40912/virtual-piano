import { describe, expect, it } from "vitest";
import { rollTimeAtPointer } from "./rollSelection";

describe("Piano Roll loop pointer time", () => {
  it("maps portrait pointer coordinates from screen to the canvas chart", () => {
    expect(rollTimeAtPointer({
      clientX: 40, clientY: 230, viewportWidth: 390, rotate: false,
      canvasTop: 100, canvasHeight: 300, aligned: false, position: 3, zoom: 68,
    })).toBe(5);
  });

  it("measures from the strike line when the waterfall is aligned to the keys", () => {
    // The strike line sits 3px above the canvas bottom: 300 - 3 = 297.
    expect(rollTimeAtPointer({
      clientX: 100, clientY: 297 - 104 * 2, viewportWidth: 390, rotate: false,
      canvasTop: 0, canvasHeight: 300, aligned: true, position: 1, zoom: 104,
    })).toBe(3);
  });

  it("clamps dragging above the visible timeline to song time zero", () => {
    expect(rollTimeAtPointer({
      clientX: 40, clientY: 120, viewportWidth: 390, rotate: false,
      canvasTop: 0, canvasHeight: 100, aligned: false, position: 0, zoom: 65,
    })).toBe(0);
  });
});
