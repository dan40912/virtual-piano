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
  });
  const saved = JSON.parse(localStorage.getItem("piano-studio-settings-v1")!);
  expect(saved.state.mapping).toEqual({ KeyZ: 60, KeyX: 62 });
  expect(saved.state.profiles.practice.KeyZ).toBe(60);
  expect(saved.state.lidHintSeen).toBe(true);
  expect(saved.version).toBe(8);
  expect(saved.state.mobileScoreSplit).toBe(0.46);
  expect(saved.state.visibleWhiteKeys).toBe(21);
  vi.resetModules();
  const reloaded = await import("./store");
  expect(reloaded.useSettings.getState().mapping.KeyX).toBe(62);
  expect(reloaded.useSettings.getState().octave).toBe(1);
  expect(reloaded.useSettings.getState().lidHintSeen).toBe(true);
  expect(reloaded.useSettings.getState().mobileScoreSplit).toBe(0.46);
  expect(reloaded.useSettings.getState().visibleWhiteKeys).toBe(21);
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
