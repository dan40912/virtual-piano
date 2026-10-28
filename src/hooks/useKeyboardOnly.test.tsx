// @vitest-environment happy-dom
import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useFocusView } from "./useFocusView";
import { useKeyboardOnly } from "./useKeyboardOnly";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const stopPlayback = vi.fn();

function Fixture() {
  const [playing, setPlaying] = useState(true);
  const [visibleWhiteKeys, setVisibleWhiteKeys] = useState(18);
  const [lidOpen, setLidOpen] = useState(true);
  const [lidTab, setLidTab] = useState("sound");
  const [visualView, setVisualView] = useState("sheet");
  const keyboard = useKeyboardOnly();
  const focus = useFocusView({ lidOpen, lidTab, visualView, setLidOpen, setLidTab, setVisualView });
  return (
    <div data-keyboard-only={keyboard.active ? "true" : "false"} data-view={focus.active ? "focus" : "studio"} data-playing={playing} data-white-keys={visibleWhiteKeys} data-tab={lidTab} data-view-mode={visualView}>
      <button onClick={focus.enter}>focus</button>
      <button onClick={keyboard.enter}>pure keyboard</button>
      <button className="keyboard-only-exit" onClick={keyboard.exit}>exit</button>
      <button onClick={() => { stopPlayback(); setPlaying(false); }}>stop playback</button>
      <button onClick={() => setVisibleWhiteKeys(14)}>change key size</button>
    </div>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Fixture />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function click(selector: string) {
  await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
}

it("toggles a temporary view without changing playback, key size, or focus state", async () => {
  await click("button:first-child");
  await click("button:nth-child(2)");
  const app = container.firstElementChild as HTMLElement;
  expect(app.dataset.keyboardOnly).toBe("true");
  expect(app.dataset.view).toBe("focus");
  expect(app.dataset.playing).toBe("true");
  expect(app.dataset.whiteKeys).toBe("18");

  await click(".keyboard-only-exit");
  expect(app.dataset.keyboardOnly).toBe("false");
  expect(app.dataset.view).toBe("focus");
  expect(app.dataset.playing).toBe("true");
  expect(app.dataset.whiteKeys).toBe("18");
});

it("lets Escape exit pure keyboard mode before focus Escape, without calling playback controls", async () => {
  const focusExit = vi.fn();
  const onFocusEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") focusExit();
  };
  window.addEventListener("keydown", onFocusEscape, true);
  await click("button:nth-child(2)");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  const app = container.firstElementChild as HTMLElement;
  expect(app.dataset.keyboardOnly).toBe("false");
  expect(app.dataset.playing).toBe("true");
  expect(stopPlayback).not.toHaveBeenCalled();
  expect(focusExit).not.toHaveBeenCalled();
  window.removeEventListener("keydown", onFocusEscape, true);
});
