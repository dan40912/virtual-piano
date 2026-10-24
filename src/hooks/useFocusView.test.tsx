// @vitest-environment happy-dom
import { act, useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useFocusView } from "./useFocusView";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

function Fixture() {
  const [lidOpen, setLidOpen] = useState(true);
  const [lidTab, setLidTab] = useState("sound");
  const [visualView, setVisualView] = useState("sheet");
  const focus = useFocusView({ lidOpen, lidTab, visualView, setLidOpen, setLidTab, setVisualView });
  return (
    <div
      data-view={focus.active ? "focus" : "studio"}
      data-lid={lidOpen ? "open" : "closed"}
      data-lid-tab={lidTab}
      data-visual-view={visualView}
    >
      <button onClick={focus.enter}>enter</button>
      <button onClick={focus.exit}>leave</button>
      <button onClick={() => setLidOpen(false)}>close lid</button>
    </div>
  );
}

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Fixture />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function click(selector: string) {
  await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
}

it("switches data-view for focus and Escape restores lid tab and visual view", async () => {
  await click("button:first-child");
  const app = container.firstElementChild as HTMLElement;
  expect(app.dataset.view).toBe("focus");
  expect(app.dataset.lid).toBe("open");
  expect(app.dataset.lidTab).toBe("stand");
  expect(app.dataset.visualView).toBe("roll");

  await click("button:last-child");
  expect(app.dataset.lid).toBe("closed");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(app.dataset.view).toBe("studio");
  expect(app.dataset.lid).toBe("open");
  expect(app.dataset.lidTab).toBe("sound");
  expect(app.dataset.visualView).toBe("sheet");
});

it("restores the previous lid tab and visual view when leaving by button", async () => {
  await click("button:first-child");
  await click("button:nth-child(3)");
  await click("button:nth-child(2)");
  const app = container.firstElementChild as HTMLElement;
  expect(app.dataset.view).toBe("studio");
  expect(app.dataset.lid).toBe("open");
  expect(app.dataset.lidTab).toBe("sound");
  expect(app.dataset.visualView).toBe("sheet");
});
