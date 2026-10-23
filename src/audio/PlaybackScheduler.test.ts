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
