// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Midi } from "@tonejs/midi";
import { recorder } from "../audio/LiveRecorder";
import { engine } from "../audio/PianoEngine";
import type { Song } from "../music/model";
import { saveRecording } from "../library/recordingLibrary";
import { RecordingControls } from "./RecordingControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const onPlay = vi.fn();
const savedSong: Song = {
  title: "Take", source: "本機錄製 · test", tempo: 120, timeSignature: [4, 4], duration: 1,
  tracks: ["My performance"],
  notes: [
    { id: "n1", midi: 60, startTime: 0.25, duration: 0.5, velocity: 0.75, trackId: 0 },
    { id: "n2", midi: 67, startTime: 0.75, duration: 0.2, velocity: 0.5, trackId: 0 },
  ],
  pedals: [
    { time: 0.1, down: true, trackId: 0 },
    { time: 0.8, down: false, trackId: 0 },
  ],
  tempos: [{ time: 0, bpm: 120 }], signatures: [],
};

async function remountControls() {
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<RecordingControls onPlay={onPlay} />));
}

async function setTextInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

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

it("saves the edited name and restores the named recording after remount", async () => {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(".recording-start")!.click();
    for (let i = 0; i < 5 && !recorder.recording; i++) await Promise.resolve();
  });
  await act(async () => {
    recorder.attack("name-test", 65, 0.8);
    recorder.release("name-test");
    container.querySelector<HTMLButtonElement>(".recording-start")!.click();
  });
  await setTextInput(container.querySelector<HTMLInputElement>('[aria-label="作品名稱"]')!, "Moonlight étude");
  await act(async () => container.querySelector<HTMLButtonElement>(".recording-save-row button")!.click());
  const stored = JSON.parse(localStorage.getItem("virtual-piano-recordings-v1")!);
  expect(stored[0].name).toBe("Moonlight étude");

  await remountControls();
  expect(container.querySelector(".recording-library")?.textContent).toContain("Moonlight étude");
});

it("renames a saved row through the dialog and leaves it unchanged when the dialog is canceled", async () => {
  const saved = saveRecording("First take", savedSong);
  await remountControls();
  const renameButton = () => container.querySelector<HTMLButtonElement>(`[aria-label="重新命名 ${saved.name}"]`)!;
  vi.mocked(globalThis.prompt).mockReturnValueOnce(null);
  await act(async () => renameButton().click());
  expect(JSON.parse(localStorage.getItem("virtual-piano-recordings-v1")!)[0].name).toBe("First take");

  vi.mocked(globalThis.prompt).mockReturnValueOnce("Revised take");
  await act(async () => renameButton().click());
  expect(JSON.parse(localStorage.getItem("virtual-piano-recordings-v1")!)[0].name).toBe("Revised take");
  expect(container.querySelector(".recording-library")?.textContent).toContain("Revised take");
});

it("deletes only after confirmation and preserves the row when deletion is canceled", async () => {
  const saved = saveRecording("Keep me", savedSong);
  await remountControls();
  const deleteButton = () => container.querySelector<HTMLButtonElement>(`[aria-label="刪除 ${saved.name}"]`)!;
  vi.mocked(globalThis.confirm).mockReturnValueOnce(false);
  await act(async () => deleteButton().click());
  expect(JSON.parse(localStorage.getItem("virtual-piano-recordings-v1")!)[0].id).toBe(saved.id);
  expect(container.querySelector(".recording-library")?.textContent).toContain("Keep me");

  vi.mocked(globalThis.confirm).mockReturnValueOnce(true);
  await act(async () => deleteButton().click());
  expect(JSON.parse(localStorage.getItem("virtual-piano-recordings-v1")!)).toEqual([]);
  expect(container.querySelector(".recording-library")?.textContent).not.toContain("Keep me");
});

it("exports a saved MIDI file whose decoded notes and sustain CC match the saved take", async () => {
  saveRecording("Nocturne", savedSong);
  await remountControls();
  let downloaded: Blob | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
    downloaded = object as Blob;
    return "blob:recording-test";
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="匯出 Nocturne MIDI"]')!.click());
  expect(downloaded).toBeInstanceOf(Blob);
  const decoded = new Midi(new Uint8Array(await downloaded!.arrayBuffer()));
  expect(decoded.name).toBe("Nocturne");
  expect(decoded.tracks).toHaveLength(1);
  expect(decoded.tracks[0].notes.map((note) => note.midi)).toEqual([60, 67]);
  expect(decoded.tracks[0].notes[0].time).toBeCloseTo(0.25);
  expect(decoded.tracks[0].notes[0].duration).toBeCloseTo(0.5);
  expect(decoded.tracks[0].notes[1].time).toBeCloseTo(0.75);
  expect(decoded.tracks[0].notes[1].duration).toBeCloseTo(0.2);
  const pedal = decoded.tracks[0].controlChanges[64];
  expect(pedal.map((cc) => cc.value)).toEqual([1, 0]);
  expect(pedal[0].time).toBeCloseTo(0.1);
  expect(pedal[1].time).toBeCloseTo(0.8);
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
