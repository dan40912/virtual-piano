import { describe, expect, it } from "vitest";
import { stageSliderValueAt } from "./StageSlider";

describe("StageSlider coordinate mapping", () => {
  it("maps horizontal stage movement equally in native and rotated layouts", () => {
    const nativeStart = stageSliderValueAt(20, 4, false, 390, 20, 100, 0, 100, 1);
    const nativeEnd = stageSliderValueAt(70, 4, false, 390, 20, 100, 0, 100, 1);
    const rotatedStart = stageSliderValueAt(4, 20, true, 390, 20, 100, 0, 100, 1);
    const rotatedEnd = stageSliderValueAt(4, 70, true, 390, 20, 100, 0, 100, 1);
    expect(nativeEnd - nativeStart).toBe(50);
    expect(rotatedEnd - rotatedStart).toBe(50);
    expect(rotatedEnd - rotatedStart).toBe(nativeEnd - nativeStart);
  });
});
