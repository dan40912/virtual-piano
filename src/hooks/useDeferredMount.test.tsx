// @vitest-environment happy-dom
import { act, useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useDeferredMount } from "./useDeferredMount";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

function Fixture() {
  const [open, setOpen] = useState(false);
  const loaded = useDeferredMount(open);
  return <div>
    <button onClick={() => setOpen(true)}>open</button>
    <button onClick={() => setOpen(false)}>close</button>
    <output data-loaded={loaded}>{loaded ? "mounted sound tools" : "not requested"}</output>
  </div>;
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

it("delays first mount until requested and keeps it mounted after switching away", async () => {
  const output = container.querySelector("output")!;
  expect(output.dataset.loaded).toBe("false");
  await click("button:first-child");
  expect(output.dataset.loaded).toBe("true");
  await click("button:nth-child(2)");
  expect(output.dataset.loaded).toBe("true");
});
