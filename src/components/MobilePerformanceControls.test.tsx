// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { MobilePerformanceControls } from "./MobilePerformanceControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const onOpenTracks = vi.fn();
const onTogglePlayback = vi.fn();
const onEnterKeyboardOnly = vi.fn();
const onKeyboardSwipeScrollChange = vi.fn();
const onOctaveChange = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(
    <MobilePerformanceControls
      playing={false}
      hasSong
      visibleWhiteKeys={18}
      keyboardSwipeScroll={false}
      octave={0}
      rotate={false}
      onOpenTracks={onOpenTracks}
      onTogglePlayback={onTogglePlayback}
      onEnterKeyboardOnly={onEnterKeyboardOnly}
      onVisibleWhiteKeysChange={vi.fn()}
      onKeyboardSwipeScrollChange={onKeyboardSwipeScrollChange}
      onOctaveChange={onOctaveChange}
    />,
  ));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function click(selector: string) {
  await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
}

it("offers the compact track, playback, and pure keyboard actions", async () => {
  await click("button:nth-of-type(1)");
  await click("button:nth-of-type(2)");
  await click(".mobile-performance-pure");
  expect(onOpenTracks).toHaveBeenCalledOnce();
  expect(onTogglePlayback).toHaveBeenCalledOnce();
  expect(onEnterKeyboardOnly).toHaveBeenCalledOnce();
});

it("keeps settings keyboard-accessible, applies controls, and restores focus on Escape", async () => {
  const settingsButton = container.querySelector<HTMLButtonElement>(".mobile-performance-settings-toggle")!;
  await act(async () => settingsButton.click());
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('button[aria-label="關閉鍵盤設定"]')!;
  expect(document.activeElement).toBe(closeButton);
  expect(dialog.querySelector('[role="slider"]')?.getAttribute("aria-valuenow")).toBe("18");

  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-pressed="false"]')!.click());
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="提高八度"]')!.click());
  expect(onKeyboardSwipeScrollChange).toHaveBeenCalledWith(true);
  expect(onOctaveChange).toHaveBeenCalledWith(1);

  const laterKeydown = vi.fn();
  window.addEventListener("keydown", laterKeydown);
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  window.removeEventListener("keydown", laterKeydown);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(settingsButton);
  expect(laterKeydown).not.toHaveBeenCalled();
});

it("wraps Tab focus within the settings dialog", async () => {
  const settingsButton = container.querySelector<HTMLButtonElement>(".mobile-performance-settings-toggle")!;
  await act(async () => settingsButton.click());
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [role="slider"][tabindex="0"]'));
  const last = focusable[focusable.length - 1];
  last.focus();
  await act(async () => last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(focusable[0]);
});
