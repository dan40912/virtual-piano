import { describe, expect, it } from "vitest";
import { rollTimeAtPointer } from "./rollSelection";

describe("Piano Roll loop pointer time", () => {
  it("maps portrait pointer coordinates from screen to the canvas chart", () => {
    expect(rollTimeAtPointer({
      clientX: 40, clientY: 230, viewportWidth: 390, rotate: false,
      canvasTop: 100, canvasHeight: 300, aligned: false, position: 3, zoom: 68,
    })).toBe(5);
  });

  it("uses rotated stage coordinates and the aligned keyboard chart baseline", () => {
    expect(rollTimeAtPointer({
      clientX: 100, clientY: 140, viewportWidth: 390, rotate: true,
      canvasTop: 200, canvasHeight: 300, aligned: true, position: 1, zoom: 104,
    })).toBe(3);
  });

  it("clamps dragging above the visible timeline to song time zero", () => {
    expect(rollTimeAtPointer({
      clientX: 40, clientY: 120, viewportWidth: 390, rotate: false,
      canvasTop: 0, canvasHeight: 100, aligned: false, position: 0, zoom: 65,
    })).toBe(0);
  });
});
