// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { recorder } from "../audio/LiveRecorder";
import { engine } from "../audio/PianoEngine";
import { RecordingControls } from "./RecordingControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const onPlay = vi.fn();

beforeEach(async () => {
  localStorage.clear();
  recorder.stop();
  recorder.notes = [];
  recorder.pedals = [];
  recorder.duration = 0;
  vi.spyOn(engine, "ready").mockResolvedValue();
  onPlay.mockClear();
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<RecordingControls onPlay={onPlay} />));
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("waits for the piano source, records a take, then exposes immediate playback and save", async () => {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(".recording-start")!.click();
    for (let i = 0; i < 5 && !recorder.recording; i++) await Promise.resolve();
  });
  expect(engine.ready).toHaveBeenCalledTimes(1);
  expect(recorder.recording).toBe(true);
  await act(async () => {
    recorder.attack("manual-key", 60, 0.8);
    recorder.release("manual-key");
    container.querySelector<HTMLButtonElement>(".recording-start")!.click();
  });
  expect(recorder.recording).toBe(false);
  const play = container.querySelector<HTMLButtonElement>(".recording-play")!;
  expect(play.disabled).toBe(false);
  await act(async () => play.click());
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(onPlay.mock.calls[0][0].notes[0].midi).toBe(60);
  await act(async () => container.querySelector<HTMLButtonElement>(".recording-save-row button")!.click());
  expect(container.textContent).toContain("已儲存");
  expect(localStorage.getItem("virtual-piano-recordings-v1")).toContain("我的演奏");
});

it("does not discard an unsaved take when starting another recording is canceled", async () => {
  await act(async () => { recorder.start(); recorder.attack("key", 64, 0.7); recorder.stop(); });
  vi.mocked(globalThis.confirm).mockReturnValue(false);
  await act(async () => container.querySelector<HTMLButtonElement>(".recording-start")!.click());
  expect(recorder.recording).toBe(false);
  expect(recorder.notes).toHaveLength(1);
});

it("offers the app supplied original comparison action", async () => {
  const compare = vi.fn();
  await act(async () => root.render(<RecordingControls onPlay={onPlay} referenceSong={recorder.song()} onCompareOriginal={compare} />));
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.includes("返回原曲"))!;
  await act(async () => button.click());
  expect(compare).toHaveBeenCalledTimes(1);
});

it("does not begin MIDI when optional audio capture cannot start", async () => {
  class SupportedRecorder { static isTypeSupported = () => true; }
  vi.stubGlobal("MediaRecorder", SupportedRecorder);
  vi.spyOn(engine, "createRecordingStream").mockRejectedValue(new Error("音源失敗"));
  const checkbox = container.querySelector<HTMLInputElement>(".recording-audio-option input")!;
  await act(async () => { checkbox.click(); });
  await act(async () => {
    container.querySelector<HTMLButtonElement>(".recording-start")!.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  expect(recorder.recording).toBe(false);
  expect(container.querySelector(".recording-status")?.textContent).toContain("音源失敗");
});

it("coalesces rapid start clicks while the source is still loading", async () => {
  let resolveReady!: () => void;
  const pending = new Promise<void>((resolve) => { resolveReady = resolve; });
  vi.mocked(engine.ready).mockReturnValue(pending);
  const button = container.querySelector<HTMLButtonElement>(".recording-start")!;
  await act(async () => { button.click(); button.click(); await Promise.resolve(); });
  expect(engine.ready).toHaveBeenCalledTimes(1);
  expect(recorder.recording).toBe(false);
  await act(async () => { resolveReady(); await pending; await Promise.resolve(); });
  expect(recorder.recording).toBe(true);
});
