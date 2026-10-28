// @vitest-environment happy-dom
import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useStageOrientation } from "./useStageOrientation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let container: HTMLDivElement;
let portrait = true;

function Fixture() {
  const [pure, setPure] = useState(false);
  const preference = "landscape" as const;
  const { rotate } = useStageOrientation("playing", pure, preference);
  return (
    <div data-rotate={rotate} data-preference={preference}>
      <button onClick={() => setPure(true)}>pure keyboard</button>
      <button onClick={() => setPure(false)}>exit pure keyboard</button>
    </div>
  );
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  portrait = true;
  vi.restoreAllMocks();
});

it("suspends visual rotation in pure mode and restores the saved landscape preference on exit", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      if (query.includes("hover") || query.includes("pointer")) return true;
      if (query.includes("orientation")) return portrait;
      if (query.includes("max-width")) return true;
      return false;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Fixture />));

  const app = container.firstElementChild as HTMLElement;
  expect(app.dataset.rotate).toBe("true");
  expect(app.dataset.preference).toBe("landscape");

  await act(async () => container.querySelectorAll("button")[0].click());
  expect(app.dataset.rotate).toBe("false");
  expect(app.dataset.preference).toBe("landscape");

  await act(async () => container.querySelectorAll("button")[1].click());
  expect(app.dataset.rotate).toBe("true");
  expect(app.dataset.preference).toBe("landscape");

  portrait = false;
  await act(async () => window.dispatchEvent(new Event("orientationchange")));
  expect(app.dataset.rotate).toBe("false");
  expect(app.dataset.preference).toBe("landscape");
});
