// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useSettings } from "../store";
import { useVisualPreferences } from "./useVisualPreferences";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

function VisualPreferenceRuntime() {
  useVisualPreferences();
  return <div>visual runtime, no controls mounted</div>;
}

beforeEach(async () => {
  useSettings.getState().set({ largeKeyLabels: true, highContrast: true, notePalette: "accessible" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<VisualPreferenceRuntime />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useSettings.getState().set({ largeKeyLabels: false, highContrast: false, notePalette: "gold" });
});

it("applies stored visual settings without mounting the preference UI", () => {
  expect(document.documentElement.dataset.largeKeyLabels).toBe("true");
  expect(document.documentElement.dataset.highContrast).toBe("true");
  expect(document.documentElement.dataset.notePalette).toBe("accessible");
  expect(container.querySelector("details")).toBeNull();
});

it("updates root datasets as persisted settings change", async () => {
  await act(async () => useSettings.getState().set({ largeKeyLabels: false, highContrast: false, notePalette: "gold" }));
  expect(document.documentElement.dataset.largeKeyLabels).toBe("false");
  expect(document.documentElement.dataset.highContrast).toBe("false");
  expect(document.documentElement.dataset.notePalette).toBe("gold");
});
