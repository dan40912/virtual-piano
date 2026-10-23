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
  });
  const saved = JSON.parse(localStorage.getItem("piano-studio-settings-v1")!);
  expect(saved.state.mapping).toEqual({ KeyZ: 60, KeyX: 62 });
  expect(saved.state.profiles.practice.KeyZ).toBe(60);
  vi.resetModules();
  const reloaded = await import("./store");
  expect(reloaded.useSettings.getState().mapping.KeyX).toBe(62);
  expect(reloaded.useSettings.getState().octave).toBe(1);
  vi.unstubAllGlobals();
});
