// @vitest-environment happy-dom
import { it, expect, vi } from "vitest";
import { act, Profiler, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Piano } from "./Piano";
import { player } from "../audio/PlaybackScheduler";
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
    e = container.querySelector('[data-midi="64"]')!,
    g = container.querySelector('[data-midi="67"]')!;
  c.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
  );
  e.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }),
  );
  g.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 10 }),
  );
  expect(down.mock.calls).toEqual([
    ["pointer1", 60],
    ["pointer2", 64],
    ["pointer10", 67],
  ]);
  c.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
  );
  e.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerId: 2 }),
  );
  g.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 10 }),
  );
  expect(up.mock.calls).toEqual([["pointer1"], ["pointer2"], ["pointer10"]]);
  c.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 3 }),
  );
  c.dispatchEvent(
    new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 3 }),
  );
  c.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 3 }),
  );
  expect(up.mock.calls).toEqual([["pointer1"], ["pointer2"], ["pointer10"], ["pointer3"]]);
  await act(async () => root.unmount());
  container.remove();
});
it("does not render on playback position ticks", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let commits = 0;
  await act(async () =>
    root.render(
      <Profiler id="piano" onRender={() => commits++}>
        <Piano
          count={61}
          mapping={{ KeyA: 60 }}
          active={new Set()}
          expected={[]}
          onDown={vi.fn()}
          onUp={vi.fn()}
          onSelect={vi.fn()}
          mappingMode={false}
          onScroll={vi.fn()}
          onBounds={vi.fn()}
          scrollPosition={0}
        />
      </Profiler>,
    ),
  );
  const mountedCommits = commits;
  await act(async () => player.setPosition(player.position + 0.02));
  expect(mountedCommits).toBe(1);
  expect(commits).toBe(mountedCommits);
  await act(async () => root.unmount());
  container.remove();
});
it("keeps Piano memoized when feedback state updates outside wait practice", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const memoizedPiano = Piano as unknown as {
    type: (props: ComponentProps<typeof Piano>) => ReactNode;
  };
  const pianoRender = vi.spyOn(memoizedPiano, "type");
  const mapping = { KeyA: 60 };
  const active = new Set<number>();
  const waitGroups: number[][] = [];
  const onDown = vi.fn();
  const onUp = vi.fn();
  const onSelect = vi.fn();
  const onScroll = vi.fn();
  const onBounds = vi.fn();
  function Harness() {
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [mode] = useState<string>("practice");
    const [practiceType] = useState<string>("rhythm");
    const step = 0;
    const transpose = 0;
    const expected = useMemo(
      () =>
        mode === "practice" && practiceType === "wait"
          ? (waitGroups[step] || []).map((midi) => midi + transpose)
          : [],
      [mode, practiceType, waitGroups, step, transpose],
    );
    return (
      <>
        <button onClick={() => setFeedbackCount((count) => count + 1)}>
          {feedbackCount}
        </button>
        <Piano
          count={61}
          mapping={mapping}
          active={active}
          expected={expected}
          onDown={onDown}
          onUp={onUp}
          onSelect={onSelect}
          mappingMode={false}
          onScroll={onScroll}
          onBounds={onBounds}
          scrollPosition={0}
        />
      </>
    );
  }
  await act(async () => root.render(<Harness />));
  expect(pianoRender).toHaveBeenCalledTimes(1);
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("button")!.textContent).toBe("1");
  expect(pianoRender).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  pianoRender.mockRestore();
  container.remove();
});
it("keeps swipe browsing silent until the user returns to playing mode", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const down = vi.fn();
  const up = vi.fn();
  await act(async () =>
    root.render(
      <Piano
        count={61}
        mapping={{ KeyA: 60 }}
        active={new Set()}
        expected={[]}
        onDown={down}
        onUp={up}
        onSelect={vi.fn()}
        mappingMode={false}
        onScroll={vi.fn()}
        onBounds={vi.fn()}
        scrollPosition={0}
        swipeScrollEnabled
      />,
    ),
  );
  container.querySelector('[data-midi="60"]')!.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 8 }),
  );
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  container.remove();
});
it("sends a piano key selection to the mapping flow without sounding it", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const down = vi.fn();
  const select = vi.fn();
  await act(async () =>
    root.render(
      <Piano
        count={61}
        mapping={{ KeyA: 60 }}
        active={new Set()}
        expected={[]}
        onDown={down}
        onUp={vi.fn()}
        onSelect={select}
        mappingMode
        onScroll={vi.fn()}
        onBounds={vi.fn()}
        scrollPosition={0}
      />,
    ),
  );
  container.querySelector('[data-midi="62"]')!.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 9 }),
  );
  expect(select).toHaveBeenCalledWith(62);
  const mappedKey = container.querySelector<HTMLButtonElement>('[data-midi="62"]')!;
  await act(async () => {
    mappedKey.focus();
    mappedKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenLastCalledWith(62);
  expect(down).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  container.remove();
});

it("provides roving keyboard focus, press/release keys, and supports assistive clicks without duplicating pointer input", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const down = vi.fn();
  const up = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  await act(async () => root.render(
    <Piano
      count={61}
      mapping={{ KeyA: 60 }}
      active={new Set()}
      expected={[]}
      onDown={down}
      onUp={up}
      onSelect={vi.fn()}
      mappingMode={false}
      onScroll={vi.fn()}
      onBounds={vi.fn()}
      scrollPosition={0}
    />,
  ));

  expect(container.querySelectorAll('.piano-key[tabindex="0"]')).toHaveLength(1);
  const c = container.querySelector<HTMLButtonElement>('[data-midi="60"]')!;
  const cSharp = container.querySelector<HTMLButtonElement>('[data-midi="61"]')!;
  await act(async () => {
    c.focus();
    c.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  });
  expect(document.activeElement).toBe(cSharp);
  expect(cSharp.tabIndex).toBe(0);
  expect(down).not.toHaveBeenCalled();

  await act(async () => {
    const enterDown = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const enterUp = new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true });
    cSharp.dispatchEvent(enterDown);
    cSharp.dispatchEvent(enterUp);
    expect(enterDown.defaultPrevented).toBe(true);
    expect(enterUp.defaultPrevented).toBe(true);
  });
  expect(down).toHaveBeenLastCalledWith("accessible:61", 61);
  expect(up).toHaveBeenLastCalledWith("accessible:61");

  await act(async () => {
    const spaceDown = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    const spaceUp = new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true });
    cSharp.dispatchEvent(spaceDown);
    cSharp.dispatchEvent(spaceUp);
    expect(spaceDown.defaultPrevented).toBe(true);
    expect(spaceUp.defaultPrevented).toBe(true);
  });
  expect(down).toHaveBeenLastCalledWith("accessible:61", 61);
  expect(up).toHaveBeenLastCalledWith("accessible:61");

  await act(async () => {
    cSharp.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  });
  expect(down).toHaveBeenLastCalledWith("assistive:61", 61);
  await act(async () => { await vi.advanceTimersByTimeAsync(140); });
  expect(up).toHaveBeenLastCalledWith("assistive:61");

  await act(async () => {
    cSharp.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 6 }));
    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 });
    cSharp.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
    cSharp.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 6 }));
    cSharp.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  expect(down.mock.calls.filter(([id]) => id === "pointer6")).toHaveLength(1);
  expect(down.mock.calls.filter(([id]) => id === "assistive:61")).toHaveLength(1);

  await act(async () => {
    const touchDown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 7 });
    cSharp.dispatchEvent(touchDown);
    expect(touchDown.defaultPrevented).toBe(false);
    cSharp.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }));
  });

  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

it("leaves a configured Space sustain shortcut to the existing global handler", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const down = vi.fn();
  const up = vi.fn();
  const globalDown = vi.fn();
  const globalUp = vi.fn();
  window.addEventListener("keydown", globalDown);
  window.addEventListener("keyup", globalUp);
  await act(async () => root.render(
    <Piano
      count={61}
      mapping={{}}
      active={new Set()}
      expected={[]}
      onDown={down}
      onUp={up}
      onSelect={vi.fn()}
      mappingMode={false}
      onScroll={vi.fn()}
      onBounds={vi.fn()}
      scrollPosition={0}
      keyboardPedal="Space"
    />,
  ));
  const key = container.querySelector<HTMLButtonElement>('[data-midi="60"]')!;
  key.focus();
  await act(async () => {
    key.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
    key.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true, cancelable: true }));
  });
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
  expect(globalDown).toHaveBeenCalledTimes(1);
  expect(globalUp).toHaveBeenCalledTimes(1);

  await act(async () => {
    key.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    key.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  });
  expect(down).toHaveBeenCalledWith("accessible:60", 60);
  expect(up).toHaveBeenCalledWith("accessible:60");
  expect(globalDown).toHaveBeenCalledTimes(1);
  expect(globalUp).toHaveBeenCalledTimes(1);

  await act(async () => root.unmount());
  window.removeEventListener("keydown", globalDown);
  window.removeEventListener("keyup", globalUp);
  container.remove();
});
