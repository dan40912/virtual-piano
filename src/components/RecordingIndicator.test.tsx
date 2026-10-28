// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { recorder } from "../audio/LiveRecorder";
import { RecordingIndicator } from "./RecordingIndicator";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("shows elapsed recording time, updates once per second, and clears its timer on unmount", async () => {
  vi.useFakeTimers();
  const elapsed = vi.spyOn(recorder, "elapsed").mockReturnValue(12);
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);

  await act(async () => root.render(<RecordingIndicator recording />));
  expect(container.querySelector(".recording-live-badge")?.textContent).toContain("錄製中 0:12");
  expect(vi.getTimerCount()).toBe(1);

  elapsed.mockReturnValue(13);
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(container.textContent).toContain("錄製中 0:13");
  const callsBeforeUnmount = elapsed.mock.calls.length;
  await act(async () => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => { vi.advanceTimersByTime(3000); });
  expect(elapsed).toHaveBeenCalledTimes(callsBeforeUnmount);
  container.remove();
});

it("renders no badge and creates no timer when recording is false", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => root.render(<RecordingIndicator recording={false} />));
  expect(container.querySelector(".recording-live-badge")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => root.unmount());
  container.remove();
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
