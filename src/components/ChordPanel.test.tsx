// @vitest-environment happy-dom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChordPanel, parseChordPerformancePrefs } from "./ChordPanel";
import { useSettings } from "../store";
import {
  aChordMap,
  chordCatalog,
  functionChordMap,
  keyChordMaps,
  triadChordCatalog,
  triadKeyChordMaps,
  validateChordBinding,
} from "../music/chords";
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
const openSettings = async () => {
  const settings = container.querySelector<HTMLButtonElement>(
    '[aria-controls="chord-settings"]',
  )!;
  await act(async () => settings.click());
  await act(async () => {
    await import("./ChordSettings");
  });
  expect(container.querySelector('[aria-label="和弦快速配置"]')).not.toBeNull();
  return settings;
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
  await act(async () =>
    useSettings.getState().set({ chordMapping: { ...functionChordMap } }),
  );
  await key("keydown", "F1");
  expect(down.mock.calls.map((c) => c[1])).toEqual(chordCatalog.C);
  await key("keyup", "F1");
  expect(up).toHaveBeenCalledTimes(4);
  expect(Object.keys(functionChordMap)).toEqual([
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
  ]);
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
  await openSettings();
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
  expect(
    validateChordBinding("F9", aChordMap, "KeyZ", "Space", defaultMap),
  ).toBe("");
  expect(
    validateChordBinding("F10", aChordMap, "KeyZ", "Space", defaultMap),
  ).not.toBe("");
});

it("keeps chord pads visible and tucks advanced chord options behind settings", async () => {
  const settings = container.querySelector<HTMLButtonElement>(
    '[aria-controls="chord-settings"]',
  )!;
  expect(settings.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelectorAll(".chord-pad").length).toBeGreaterThan(0);
  expect(container.querySelector("#chord-settings")).toBeNull();
  expect(container.textContent).toContain("Z、X、C、V、B、N、M");
  expect(container.textContent).toContain("和弦快捷鍵優先於同名單音鍵");
  expect(container.querySelector('[aria-label="和弦快速配置"]')).toBeNull();

  await openSettings();
  expect(settings.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector('[aria-label="和弦快速配置"]')).not.toBeNull();
  await act(async () =>
    useSettings.getState().set({ chordMapping: { ...functionChordMap } }),
  );
  expect(container.textContent).toContain("F1、F2、F3、F4、F5、F6、F7、F8、F9");

  await act(async () => settings.click());
  const settingsRegion = container.querySelector<HTMLDivElement>("#chord-settings")!;
  expect(settingsRegion.hidden).toBe(true);
  expect(container.querySelector('[aria-label="和弦快速配置"]')).not.toBeNull();
  await openSettings();
  expect(container.textContent).toContain("F1、F2、F3、F4、F5、F6、F7、F8、F9");
});

it("shows a seven-card preview while disabled and provides a clear enable switch", async () => {
  await act(async () => useSettings.getState().set({ chordEnabled: false }));

  const preview = container.querySelector<HTMLDivElement>(
    ".chord-panel-grid.is-preview",
  )!;
  expect(preview.getAttribute("aria-label")).toBe("和弦預覽，啟用後可演奏");
  expect(preview.querySelectorAll(".chord-pad")).toHaveLength(7);
  expect(
    Array.from(preview.querySelectorAll(".chord-pad strong")).map(
      (item) => item.textContent,
    ),
  ).toEqual(Object.values(aChordMap));
  expect(
    Array.from(preview.querySelectorAll<HTMLButtonElement>(".chord-pad")).every(
      (pad) => pad.disabled,
    ),
  ).toBe(true);
  expect(container.textContent).toContain(
    "下方可先預覽目前配置；開啟後即可演奏和使用快捷鍵。",
  );
  expect(down).not.toHaveBeenCalled();

  const toggle = container.querySelector<HTMLButtonElement>(
    ".chord-toggle",
  )!;
  expect(toggle.textContent).toBe("開啟一鍵和弦");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await act(async () => toggle.click());

  expect(useSettings.getState().chordEnabled).toBe(true);
  expect(container.querySelector(".chord-panel-grid.is-preview")).toBeNull();
  expect(toggle.textContent).toBe("一鍵和弦已開啟");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
});

it("selects Bb seventh-chord bindings and exposes the current voicing and feel", async () => {
  await openSettings();
  const key = container.querySelector<HTMLSelectElement>(
    '[aria-label="和弦調性"]',
  )!;
  await act(async () => {
    key.value = "Bb";
    key.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(useSettings.getState().chordMapping.KeyZ).toBe("Bb");
  expect(useSettings.getState().chordMapping.KeyB).toBe("F");
  expect(container.textContent).toContain("目前：Bb 調三和弦");
  expect(container.textContent).toContain("柱式，按住延音");
});

it("rejects corrupt saved performance preferences and validates chord roots and qualities for six keys", () => {
  expect(
    parseChordPerformancePrefs(
      JSON.stringify({
        voicing: "loud",
        feel: "wild",
        key: "H",
        chordType: "major",
      }),
    ),
  ).toEqual({
    voicing: undefined,
    feel: undefined,
    key: undefined,
    chordType: undefined,
  });
  expect(parseChordPerformancePrefs("not-json")).toEqual({});
  const rootPitch = { C: 0, G: 7, D: 2, A: 9, F: 5, Bb: 10 };
  const scaleDegrees = [0, 2, 4, 5, 7, 9, 11];
  for (const key of Object.keys(rootPitch)) {
    for (const [index, chord] of Object.values(
      triadKeyChordMaps[key],
    ).entries()) {
      const notes = triadChordCatalog[chord];
      expect(notes.every(Number.isFinite)).toBe(true);
      expect(Math.min(...notes) % 12).toBe(
        (rootPitch[key as keyof typeof rootPitch] + scaleDegrees[index]) % 12,
      );
      const triadOffsets = notes
        .map((note) => (note - Math.min(...notes)) % 12)
        .sort((a, b) => a - b);
      const triadQuality = chord.endsWith("dim")
        ? [0, 0, 3, 6]
        : chord.endsWith("m")
          ? [0, 0, 3, 7]
          : [0, 0, 4, 7];
      expect(triadOffsets).toEqual(triadQuality);
    }
    for (const [index, chord] of Object.values(keyChordMaps[key]).entries()) {
      const notes = chordCatalog[chord];
      expect(notes).toHaveLength(4);
      expect(notes.every(Number.isFinite)).toBe(true);
      expect(Math.min(...notes) % 12).toBe(
        (rootPitch[key as keyof typeof rootPitch] + scaleDegrees[index]) % 12,
      );
      const offsets = notes
        .map((note) => (note - Math.min(...notes)) % 12)
        .sort((a, b) => a - b);
      const quality = chord.includes("maj7")
        ? [0, 4, 7, 11]
        : chord.includes("m7b5")
          ? [0, 3, 6, 10]
          : chord.includes("m7")
            ? [0, 3, 7, 10]
            : [0, 4, 7, 10];
      expect(offsets).toEqual(quality);
    }
  }
  expect(Object.values(triadKeyChordMaps.C)).toEqual([
    "C",
    "Dm",
    "Em",
    "F",
    "G",
    "Am",
    "Bdim",
  ]);
});
