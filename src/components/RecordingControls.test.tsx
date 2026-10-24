// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { recorder } from "../audio/LiveRecorder";
import { RecordingControls } from "./RecordingControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const onPlay = vi.fn();

beforeEach(async () => {
  recorder.stop();
  recorder.notes = [];
  recorder.pedals = [];
  recorder.duration = 0;
  onPlay.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<RecordingControls onPlay={onPlay} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("records a played note and hands that recording to the playback action", async () => {
  await act(async () => container.querySelector<HTMLButtonElement>(".recording-start")!.click());
  await act(async () => {
    recorder.attack("manual-key", 60, 0.8);
    recorder.release("manual-key");
    recorder.stop();
  });
  const play = container.querySelector<HTMLButtonElement>(".recording-play")!;
  expect(play.disabled).toBe(false);
  await act(async () => play.click());
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(onPlay.mock.calls[0][0].notes).toHaveLength(1);
  expect(onPlay.mock.calls[0][0].notes[0].midi).toBe(60);
});
