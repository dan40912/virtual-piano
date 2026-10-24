// @vitest-environment happy-dom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChordPanel } from "./ChordPanel";
import { useSettings } from "../store";
import { aChordMap, chordCatalog, functionChordMap, validateChordBinding } from "../music/chords";
import { defaultMap } from "../music/model";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, container: HTMLDivElement;
const down = vi.fn(),
  up = vi.fn();
beforeEach(async () => {
  vi.clearAllMocks();
  useSettings.getState().set({
    chordEnabled: true,
    chordMapping: { ...aChordMap },
    chordLatch: false,
    mapping: defaultMap,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ChordPanel onDown={down} onUp={up} blocked={false} resetKey={0} />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const key = async (
  type: string,
  code: string,
  repeat = false,
  target: HTMLElement = document.body,
) => {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent(type, { code, bubbles: true, repeat }),
    );
  });
};
it("one Z key plays the complete A chord, ignores repeat, and releases every voice", async () => {
  await key("keydown", "KeyZ");
  expect(down.mock.calls.map((c) => c[1])).toEqual(chordCatalog.A);
  await key("keydown", "KeyZ", true);
  expect(down).toHaveBeenCalledTimes(4);
  await key("keyup", "KeyZ");
  expect(up).toHaveBeenCalledTimes(4);
});
it("plays the mapped chord from F1 and offers the nine-key shortcut preset", async () => {
  await act(async () => useSettings.getState().set({ chordMapping: { ...functionChordMap } }));
  await key("keydown", "F1");
  expect(down.mock.calls.map((c) => c[1])).toEqual(chordCatalog.C);
  await key("keyup", "F1");
  expect(up).toHaveBeenCalledTimes(4);
  expect(Object.keys(functionChordMap)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"]);
});
it("does not play while typing and releases chord on blur", async () => {
  const input = document.createElement("input");
  container.append(input);
  await key("keydown", "KeyZ", false, input);
  expect(down).not.toHaveBeenCalled();
  await key("keydown", "KeyZ");
  await act(async () => window.dispatchEvent(new Event("blur")));
  expect(up).toHaveBeenCalledTimes(4);
});
it("latch keeps chord after keyup, releases previous chord when switching, and toggles off", async () => {
  await act(async () => useSettings.getState().set({ chordLatch: true }));
  await key("keydown", "KeyZ");
  await key("keyup", "KeyZ");
  expect(up).not.toHaveBeenCalled();
  await key("keydown", "KeyX");
  expect(up).toHaveBeenCalledTimes(4);
  expect(down.mock.calls.slice(4).map((c) => c[1])).toEqual(chordCatalog.D);
  await key("keyup", "KeyX");
  await key("keydown", "KeyX");
  expect(up).toHaveBeenCalledTimes(8);
});
it("binding mode captures a physical key and persists the chord assignment", async () => {
  const buttons = () => Array.from(container.querySelectorAll("button"));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-controls="chord-settings"]')!
      .click(),
  );
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "綁定模式")!
      .click(),
  );
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "改綁按鍵")!
      .click(),
  );
  await key("keydown", "KeyQ");
  expect(useSettings.getState().chordMapping.KeyQ).toBe("A");
  expect(useSettings.getState().chordMapping.KeyZ).toBeUndefined();
  expect(down).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Q → A 已儲存");
});
it("rejects chord conflicts and reserved keys while keeping single-note mappings separate", () => {
  expect(
    validateChordBinding("KeyX", aChordMap, "KeyZ", "Space", defaultMap),
  ).toContain("已綁定");
  expect(
    validateChordBinding("KeyA", aChordMap, "KeyZ", "Space", defaultMap),
  ).toBe("");
  expect(
    validateChordBinding("Space", aChordMap, "KeyZ", "Space", defaultMap),
  ).not.toBe("");
  expect(
    validateChordBinding("KeyQ", aChordMap, "KeyZ", "Space", defaultMap),
  ).toBe("");
  expect(validateChordBinding("F9", aChordMap, "KeyZ", "Space", defaultMap)).toBe("");
  expect(validateChordBinding("F10", aChordMap, "KeyZ", "Space", defaultMap)).not.toBe("");
});

it("keeps chord pads visible and tucks advanced chord options behind settings", async () => {
  const settings = container.querySelector<HTMLButtonElement>(
    '[aria-controls="chord-settings"]',
  )!;
  expect(settings.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelectorAll(".chord-pad").length).toBeGreaterThan(0);
  expect(container.querySelector('[aria-label="和弦快速配置"]')).toBeNull();

  await act(async () => settings.click());
  expect(settings.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector('[aria-label="和弦快速配置"]')).not.toBeNull();
});
