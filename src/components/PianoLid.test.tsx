// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { act, useState, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PianoLid } from "./PianoLid";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, container: HTMLDivElement;
const unmount = vi.fn();
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => () => unmount(), []);
  return (
    <button onClick={() => setCount((c) => c + 1)}>錄製狀態 {count}</button>
  );
}
function Fixture() {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("import");
  return (
    <PianoLid
      open={open}
      onToggle={() => setOpen((v) => !v)}
      activeTab={tab}
      onTabChange={setTab}
      tabs={[
        {
          id: "import",
          label: "匯入歌曲",
          content: <button>匯入 MIDI</button>,
        },
        { id: "record", label: "我的錄製", content: <Counter /> },
      ]}
    />
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
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
const click = async (selector: string) => {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(selector)!.click();
  });
};
it("starts closed and inert, opens to real import content, closes without removing controls", async () => {
  expect(
    container.querySelector(".lid-cover")?.getAttribute("aria-expanded"),
  ).toBe("false");
  expect(container.querySelector(".lid-tray")?.hasAttribute("inert")).toBe(
    true,
  );
  await click(".lid-cover");
  expect(
    container.querySelector(".lid-cover")?.getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    container.querySelector("#lid-panel-import")?.hasAttribute("hidden"),
  ).toBe(false);
  expect(container.textContent).toContain("匯入 MIDI");
  await click(".lid-cover");
  expect(container.querySelector(".lid-tray")?.hasAttribute("inert")).toBe(
    true,
  );
  expect(container.querySelector("#lid-panel-import")).not.toBeNull();
});
it("preserves a recording state across tab changes and repeated lid closure", async () => {
  await click(".lid-cover");
  await click("#lid-tab-record");
  await click("#lid-panel-record button");
  expect(container.textContent).toContain("錄製狀態 1");
  await click(".lid-cover");
  await click(".lid-cover");
  await click("#lid-tab-import");
  await click("#lid-tab-record");
  expect(container.textContent).toContain("錄製狀態 1");
  expect(unmount).not.toHaveBeenCalled();
});
it("supports arrow-key navigation between accessible tool tabs", async () => {
  await click(".lid-cover");
  await act(async () => {
    container
      .querySelector("#lid-tab-import")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
  });
  expect(
    container.querySelector("#lid-tab-record")?.getAttribute("aria-selected"),
  ).toBe("true");
  expect(document.activeElement?.id).toBe("lid-tab-record");
});
