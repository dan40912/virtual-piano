import { describe, expect, it } from "vitest";
import { mobileToolHeight } from "./mobileToolHeight";

describe("mobileToolHeight", () => {
  it("leaves at least 100px for the tab panel and 110px for keys at the default split", () => {
    const toolHeight = mobileToolHeight(390, 0.55);
    const tabPanelHeight = toolHeight - 36 - 44;
    const keyHeight = 390 - 44 - toolHeight - 24;

    expect(tabPanelHeight).toBeGreaterThanOrEqual(100);
    expect(keyHeight).toBeGreaterThanOrEqual(110);
  });

  it("reserves room for the playback row inside the tool area", () => {
    const compact = mobileToolHeight(390, 0.25);
    const expanded = mobileToolHeight(390, 0.65);

    expect(compact).toBe(104);
    expect(expanded).toBe(212);
    expect(compact).not.toBe(expanded);
    expect(compact).toBeGreaterThanOrEqual(104);
    expect(compact).toBeLessThanOrEqual(214);
    expect(expanded).toBeGreaterThanOrEqual(104);
    expect(expanded).toBeLessThanOrEqual(214);
  });
});
