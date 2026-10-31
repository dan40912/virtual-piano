import { it, expect, vi } from "vitest";
import { Window } from "happy-dom";
it("persists custom mappings and multiple profiles and restores after reload", async () => {
  const win = new Window();
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", win.localStorage);
  const { useSettings } = await import("./store");
  useSettings.getState().set({
    mapping: { KeyZ: 60, KeyX: 62 },
    profiles: { practice: { KeyZ: 60 } },
    octave: 1,
    visibleWhiteKeys: 21,
    keyboardSwipeScroll: true,
    keyLabels: "letters",
    largeKeyLabels: true,
    highContrast: true,
    notePalette: "accessible",
  });
  const saved = JSON.parse(localStorage.getItem("piano-studio-settings-v1")!);
  expect(saved.state.mapping).toEqual({ KeyZ: 60, KeyX: 62 });
  expect(saved.state.profiles.practice.KeyZ).toBe(60);
  expect(saved.version).toBe(15);
  expect(saved.state.largeKeyLabels).toBe(true);
  expect(saved.state.highContrast).toBe(true);
  expect(saved.state.notePalette).toBe("accessible");
  expect(saved.state.visibleWhiteKeys).toBe(21);
  expect(saved.state.keyboardSwipeScroll).toBe(true);
  expect(saved.state.keyLabels).toBe("letters");
  vi.resetModules();
  const reloaded = await import("./store");
  expect(reloaded.useSettings.getState().mapping.KeyX).toBe(62);
  expect(reloaded.useSettings.getState().octave).toBe(1);
  expect(reloaded.useSettings.getState().visibleWhiteKeys).toBe(21);
  expect(reloaded.useSettings.getState().keyboardSwipeScroll).toBe(true);
  expect(reloaded.useSettings.getState().keyLabels).toBe("letters");
  expect(reloaded.useSettings.getState().largeKeyLabels).toBe(true);
  expect(reloaded.useSettings.getState().highContrast).toBe(true);
  expect(reloaded.useSettings.getState().notePalette).toBe("accessible");
  localStorage.setItem(
    "piano-studio-settings-v1",
    JSON.stringify({
      state: {
        mapping: { KeyA: 60, "Shift+KeyA": 48 },
        mobileLayout: "score",
        mobileOrientation: "landscape",
        lidHintSeen: true,
        mobileScoreSplit: 0.4,
        keyLabels: "bogus",
      },
      version: 4,
    }),
  );
  vi.resetModules();
  const migrated = await import("./store");
  const state = migrated.useSettings.getState();
  expect(state.mapping.KeyA).toBe(60);
  expect(state.mapping.KeyJ).toBe(71);
  expect(state.mapping.KeyP).toBe(75);
  expect(state.visibleWhiteKeys).toBe(18);
  expect(state.keyboardSwipeScroll).toBe(false);
  expect(state.keyLabels).toBe("both");
  expect(Object.keys(state.mapping)).not.toContain("Shift+KeyA");
  for (const retired of ["mobileLayout", "mobileOrientation", "lidHintSeen", "mobileScoreSplit"])
    expect(state).not.toHaveProperty(retired);
  localStorage.setItem(
    "piano-studio-settings-v1",
    JSON.stringify({
      state: {
        mapping: Object.fromEntries(
          ["KeyA", "KeyW", "KeyS", "KeyE", "KeyD", "KeyF", "KeyT", "KeyG", "KeyY", "KeyH", "KeyU", "KeyJ"]
            .map((code, index) => [code, 60 + index]),
        ),
      },
      version: 7,
    }),
  );
  vi.resetModules();
  const expandedDefaults = await import("./store");
  expect(Object.keys(expandedDefaults.useSettings.getState().mapping)).toHaveLength(16);
  expect(expandedDefaults.useSettings.getState().mapping.KeyP).toBe(75);
  vi.unstubAllGlobals();
});
