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
    lidHintSeen: true,
    mobileScoreSplit: 0.46,
    visibleWhiteKeys: 21,
    keyboardSwipeScroll: true,
    mobileOrientation: "landscape",
    mobileStageLayout: "performance",
    mobileScoreVisible: false,
    mobilePlaybackVisible: false,
    largeKeyLabels: true,
    highContrast: true,
    notePalette: "accessible",
  });
  const saved = JSON.parse(localStorage.getItem("piano-studio-settings-v1")!);
  expect(saved.state.mapping).toEqual({ KeyZ: 60, KeyX: 62 });
  expect(saved.state.profiles.practice.KeyZ).toBe(60);
  expect(saved.state.lidHintSeen).toBe(true);
  expect(saved.version).toBe(14);
  expect(saved.state.largeKeyLabels).toBe(true);
  expect(saved.state.highContrast).toBe(true);
  expect(saved.state.notePalette).toBe("accessible");
  expect(saved.state.mobileScoreSplit).toBe(0.46);
  expect(saved.state.visibleWhiteKeys).toBe(21);
  expect(saved.state.keyboardSwipeScroll).toBe(true);
  expect(saved.state.mobileOrientation).toBe("landscape");
  expect(saved.state.mobileStageLayout).toBe("performance");
  expect(saved.state.mobileScoreVisible).toBe(false);
  expect(saved.state.mobilePlaybackVisible).toBe(false);
  vi.resetModules();
  const reloaded = await import("./store");
  expect(reloaded.useSettings.getState().mapping.KeyX).toBe(62);
  expect(reloaded.useSettings.getState().octave).toBe(1);
  expect(reloaded.useSettings.getState().lidHintSeen).toBe(true);
  expect(reloaded.useSettings.getState().mobileScoreSplit).toBe(0.46);
  expect(reloaded.useSettings.getState().visibleWhiteKeys).toBe(21);
  expect(reloaded.useSettings.getState().keyboardSwipeScroll).toBe(true);
  expect(reloaded.useSettings.getState().mobileOrientation).toBe("landscape");
  expect(reloaded.useSettings.getState().mobileStageLayout).toBe("performance");
  expect(reloaded.useSettings.getState().mobileScoreVisible).toBe(false);
  expect(reloaded.useSettings.getState().mobilePlaybackVisible).toBe(false);
  expect(reloaded.useSettings.getState().largeKeyLabels).toBe(true);
  expect(reloaded.useSettings.getState().highContrast).toBe(true);
  expect(reloaded.useSettings.getState().notePalette).toBe("accessible");
  localStorage.setItem(
    "piano-studio-settings-v1",
    JSON.stringify({
      state: {
        mapping: { KeyA: 60, "Shift+KeyA": 48 },
        mobileLayout: "score",
      },
      version: 4,
    }),
  );
  vi.resetModules();
  const migrated = await import("./store");
  expect(migrated.useSettings.getState().lidHintSeen).toBe(false);
  expect(migrated.useSettings.getState().mapping.KeyA).toBe(60);
  expect(migrated.useSettings.getState().mapping.KeyJ).toBe(71);
  expect(migrated.useSettings.getState().mapping.KeyP).toBe(75);
  expect(migrated.useSettings.getState().visibleWhiteKeys).toBe(18);
  expect(migrated.useSettings.getState().keyboardSwipeScroll).toBe(false);
  expect(migrated.useSettings.getState().mobileOrientation).toBe("portrait");
  expect(migrated.useSettings.getState().mobileStageLayout).toBe("auto");
  expect(migrated.useSettings.getState().mobileScoreVisible).toBe(true);
  expect(migrated.useSettings.getState().mobilePlaybackVisible).toBe(true);
  expect(Object.keys(migrated.useSettings.getState().mapping)).not.toContain(
    "Shift+KeyA",
  );
  expect(migrated.useSettings.getState()).not.toHaveProperty("mobileLayout");
  expect(migrated.useSettings.getState().mobileScoreSplit).toBe(0.55);
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
