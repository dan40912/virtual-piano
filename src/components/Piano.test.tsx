// @vitest-environment happy-dom
import { it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Piano } from "./Piano";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("mounts with scroll effects, renders 88 keys and supports independent pointers", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const down = vi.fn(),
    up = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  await act(async () =>
    root.render(
      <Piano
        count={88}
        mapping={{ KeyA: 60 }}
        active={new Set()}
        expected={[60]}
        onDown={down}
        onUp={up}
        onSelect={vi.fn()}
        mappingMode={false}
        onScroll={vi.fn()}
        onBounds={vi.fn()}
        scrollPosition={0}
      />,
    ),
  );
  expect(container.querySelectorAll("[data-midi]")).toHaveLength(88);
  expect(container.querySelectorAll(".white")).toHaveLength(52);
  expect(container.querySelectorAll(".black")).toHaveLength(36);
  const c = container.querySelector('[data-midi="60"]')!,
    e = container.querySelector('[data-midi="64"]')!;
  c.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
  );
  e.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }),
  );
  expect(down.mock.calls).toEqual([
    ["pointer1", 60],
    ["pointer2", 64],
  ]);
  c.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
  );
  e.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerId: 2 }),
  );
  expect(up.mock.calls).toEqual([["pointer1"], ["pointer2"]]);
  await act(async () => root.unmount());
  container.remove();
});
