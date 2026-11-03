import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  events: [] as { fn: (t: number) => void; time: number }[],
  now: 10,
  transport: {
    cancel: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    seconds: 0,
    schedule: vi.fn(),
  },
  engine: {
    panic: vi.fn(),
    attack: vi.fn(),
    release: vi.fn(),
    sustain: vi.fn(),
  },
}));
vi.mock("tone", () => ({
  now: () => mocks.now,
  immediate: () => mocks.now,
  getTransport: () => mocks.transport,
  getDraw: () => ({ schedule: (fn: () => void) => fn() }),
  MembraneSynth: class {
    toDestination() {
      return this;
    }
    triggerAttackRelease() {}
  },
}));
vi.mock("./PianoEngine", () => ({ engine: mocks.engine }));
import { PlaybackScheduler } from "./PlaybackScheduler";
import type { Song } from "../music/model";
import { shouldAutoPlayNote } from "../practice/handSplit";
const song: Song = {
  title: "test",
  source: "test",
  tempo: 120,
  timeSignature: [4, 4],
  tracks: ["a", "b"],
  duration: 5,
  tempos: [
    { time: 0, bpm: 120 },
    { time: 2, bpm: 60 },
  ],
  signatures: [],
  pedals: [
    { time: 0, down: true, trackId: 0 },
    { time: 2, down: false, trackId: 0 },
  ],
  notes: [
    { id: "a", midi: 60, startTime: 1, duration: 2, velocity: 0.6, trackId: 0 },
    { id: "b", midi: 64, startTime: 1, duration: 1, velocity: 0.8, trackId: 1 },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.events = [];
  mocks.transport.schedule.mockImplementation((fn, time) =>
    mocks.events.push({ fn, time }),
  );
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});
describe("audio clock scheduler", () => {
  it("publishes explicit seeks to narrowly subscribed progress views", () => {
    const p = new PlaybackScheduler();
    const listener = vi.fn();
    p.subscribePosition(listener);
    p.setPosition(1.5);
    expect(p.getPositionSnapshot()).toBe(1.5);
    expect(listener).toHaveBeenCalledOnce();
  });
  it("loops within A/B on the audio transport and excludes notes beyond B", () => {
    const p = new PlaybackScheduler();
    p.loop = true;
    p.a = 0;
    p.b = 2;
    p.start(song);
    expect(mocks.transport).toHaveProperty("loop", true);
    expect(mocks.transport).toHaveProperty("loopEnd", 2);
    expect(mocks.events.every((e) => e.time < 2)).toBe(true);
  });
  it("schedules chord attacks at identical audio times and applies transpose", () => {
    const p = new PlaybackScheduler();
    p.transpose = 2;
    p.start(song);
    const events = mocks.events.filter((e) => e.time === 1);
    expect(events).toHaveLength(2);
    events.forEach((e) => e.fn(11));
    expect(mocks.engine.attack).toHaveBeenCalledWith("autoa", 62, 0.6, 11);
    expect(mocks.engine.attack).toHaveBeenCalledWith("autob", 66, 0.8, 11);
    expect([...p.getActiveNotesSnapshot()].sort()).toEqual([62, 66]);
    mocks.events
      .filter((e) => e.time === 2 || e.time === 3)
      .forEach((e) => e.fn(12));
    expect(p.getActiveNotesSnapshot().size).toBe(0);
  });
  it("changes speed without changing pitch and respects track mute", () => {
    const p = new PlaybackScheduler();
    p.speed = 2;
    p.muted = [1];
    p.start(song);
    expect(mocks.events.find((e) => e.time === 0.5)).toBeDefined();
    mocks.events.find((e) => e.time === 0.5)!.fn(10.5);
    expect(mocks.engine.attack).toHaveBeenCalledWith("autoa", 60, 0.6, 10.5);
    expect(mocks.events.filter((e) => e.time === 0.5)).toHaveLength(1);
  });
  it("integrates accompaniment split, sounding transpose, mute, and A/B bounds", () => {
    const accompanimentSong: Song = {
      ...song,
      tracks: ["Bass", "Treble", "Muted"],
      duration: 5,
      pedals: [
        { time: 0.3, down: true, trackId: 2 },
        { time: 0.8, down: false, trackId: 2 },
      ],
      notes: [
        { id: "before-a-outside", midi: 58, startTime: 0.2, duration: 0.2, velocity: 0.5, trackId: 0 },
        { id: "overlap-a", midi: 58, startTime: 0.5, duration: 1, velocity: 0.5, trackId: 0 },
        { id: "bass-boundary", midi: 58, startTime: 1, duration: 1, velocity: 0.6, trackId: 0 },
        { id: "bass-above", midi: 59, startTime: 1.5, duration: 0.5, velocity: 0.6, trackId: 0 },
        { id: "treble-boundary", midi: 58, startTime: 2, duration: 0.5, velocity: 0.7, trackId: 1 },
        { id: "treble-above", midi: 59, startTime: 2.5, duration: 0.5, velocity: 0.7, trackId: 1 },
        { id: "muted-all", midi: 60, startTime: 3, duration: 0.5, velocity: 0.8, trackId: 2 },
        { id: "before-b", midi: 62, startTime: 3.9, duration: 0.5, velocity: 0.8, trackId: 1 },
        { id: "at-b", midi: 70, startTime: 4, duration: 0.5, velocity: 0.8, trackId: 1 },
      ],
    };
    const p = new PlaybackScheduler();
    p.loop = true;
    p.a = 1;
    p.b = 4;
    p.transpose = 2;
    p.muted = [2];
    p.noteFilter = (note) => shouldAutoPlayNote(
      note,
      true,
      { 0: "bass", 1: "treble", 2: "all" },
      p.transpose,
      60,
    );

    p.start(accompanimentSong);
    expect(mocks.transport).toHaveProperty("loopEnd", 3);
    expect(mocks.events.every((event) => event.time < 3)).toBe(true);
    mocks.events.forEach((event) => event.fn(10 + event.time));

    expect(mocks.engine.attack.mock.calls.map(([id, midi]) => [id, midi])).toEqual([
      ["autooverlap-a", 60],
      ["autobass-boundary", 60],
      ["autotreble-above", 61],
      ["autobefore-b", 64],
    ]);
    expect(mocks.engine.sustain.mock.calls.some(([down]) => down === true)).toBe(false);
  });
  it("seek resumes notes spanning the seek position", () => {
    const p = new PlaybackScheduler();
    p.position = 2;
    p.start(song);
    mocks.events.filter((e) => e.time === 0).forEach((e) => e.fn(10));
    expect(mocks.engine.attack).toHaveBeenCalledWith("autoa", 60, 0.6, 10);
    expect(mocks.engine.sustain).toHaveBeenCalledWith(true, undefined, "auto");
  });
  it("pause retains position, stop resets and clears scheduled events", () => {
    const p = new PlaybackScheduler();
    p.position = 1;
    p.start(song);
    p.stop(false);
    expect(p.position).toBe(1);
    expect(p.playing).toBe(false);
    p.stop();
    expect(p.position).toBe(0);
    expect(mocks.transport.cancel).toHaveBeenCalled();
    expect(mocks.engine.panic).toHaveBeenCalled();
  });
  it("rhythm practice advances silently", () => {
    const p = new PlaybackScheduler();
    p.silent = true;
    p.start(song);
    mocks.events.forEach((e) => e.fn(10 + e.time));
    expect(mocks.engine.attack).not.toHaveBeenCalled();
  });
});
