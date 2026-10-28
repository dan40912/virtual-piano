// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import type { Song } from "../music/model";
import { deleteRecording, listRecordings, renameRecording, saveRecording, type RecordingStorage } from "./recordingLibrary";

const song: Song = {
  title: "Take", source: "local", tempo: 120, timeSignature: [4, 4], duration: 1,
  tracks: ["My performance"],
  notes: [{ id: "n1", midi: 60, startTime: 0, duration: 0.5, velocity: 0.8, trackId: 0 }],
  pedals: [], tempos: [{ time: 0, bpm: 120 }], signatures: [],
};

beforeEach(() => localStorage.clear());

describe("recording library persistence", () => {
  it("restores saved pieces after a fresh library read and supports rename and delete", () => {
    const saved = saveRecording("First take", song, localStorage, 1000);
    expect(listRecordings()).toHaveLength(1);
    expect(listRecordings()[0].song.notes[0].midi).toBe(60);
    expect(renameRecording(saved.id, "Polished", localStorage)[0].name).toBe("Polished");
    expect(deleteRecording(saved.id, localStorage)).toEqual([]);
    expect(listRecordings()).toEqual([]);
  });

  it("reports malformed storage and preserves the raw data for recovery", () => {
    localStorage.setItem("virtual-piano-recordings-v1", "{bad json");
    expect(() => listRecordings()).toThrow(/資料格式損毀/);
    expect(localStorage.getItem("virtual-piano-recordings-v1")).toBe("{bad json");
    localStorage.setItem("virtual-piano-recordings-v1", JSON.stringify([
      { id: "bad", name: "broken", createdAt: 1, song: { ...song, notes: [{ midi: "C4" }] } },
    ]));
    const raw = localStorage.getItem("virtual-piano-recordings-v1");
    expect(() => listRecordings()).toThrow(/資料格式損毀/);
    expect(localStorage.getItem("virtual-piano-recordings-v1")).toBe(raw);
  });

  it("rejects note and track values that cannot represent valid MIDI events", () => {
    expect(() => saveRecording("bad", { ...song, notes: [{ ...song.notes[0], midi: 60.5 }] })).toThrow(/無法儲存/);
    expect(() => saveRecording("bad", { ...song, notes: [{ ...song.notes[0], trackId: 2 }] })).toThrow(/無法儲存/);
    expect(() => saveRecording("bad", { ...song, duration: -1 })).toThrow(/無法儲存/);
  });

  it("rejects a write when browser storage reports quota exhaustion", () => {
    const quotaStorage: RecordingStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
      removeItem: () => {},
    };
    expect(() => saveRecording("Take", song, quotaStorage)).toThrow(/空間不足/);
  });
});
