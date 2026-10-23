import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("tone", () => ({
  Frequency: (n: number) => ({ toFrequency: () => n }),
  now: () => 0,
}));
import { PianoEngine } from "./PianoEngine";
describe("sample engine note ownership and sustain", () => {
  let engine: PianoEngine;
  let sampler: {
    loaded: boolean;
    triggerAttack: ReturnType<typeof vi.fn>;
    triggerRelease: ReturnType<typeof vi.fn>;
    releaseAll: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    engine = new PianoEngine();
    sampler = {
      loaded: true,
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
    };
    engine.sampler = sampler as never;
  });
  it("attacks exact MIDI pitch with velocity and audio timestamp", () => {
    engine.attack("a", 60, 0.6, 1.25);
    expect(sampler.triggerAttack).toHaveBeenCalledWith(60, 1.25, 0.6);
  });
  it("does not release a note still held by another input", () => {
    engine.attack("mouse", 60);
    engine.attack("KeyA", 60);
    engine.release("mouse");
    expect(sampler.triggerRelease).not.toHaveBeenCalled();
    engine.release("KeyA", 2);
    expect(sampler.triggerRelease).toHaveBeenCalledWith(60, 2);
  });
  it("sustain retains sound independently of physical key", () => {
    engine.sustain(true);
    engine.attack("a", 60);
    engine.release("a");
    expect(engine.held.size).toBe(0);
    expect(engine.sustained.has(60)).toBe(true);
    expect(sampler.triggerRelease).not.toHaveBeenCalled();
    engine.sustain(false);
    expect(sampler.triggerRelease).toHaveBeenCalledWith(60, undefined);
  });
  it("combines MIDI and manual pedals without dropping held notes", () => {
    engine.sustain(true, 0, "auto");
    engine.sustain(true);
    engine.attack("a", 60);
    engine.release("a");
    engine.sustain(false, 1, "auto");
    expect(sampler.triggerRelease).not.toHaveBeenCalled();
    engine.sustain(false, 2);
    expect(sampler.triggerRelease).toHaveBeenCalledWith(60, 2);
  });
  it("ignores out of range notes and unknown releases", () => {
    engine.attack("a", 20);
    engine.attack("b", 109);
    engine.release("unknown");
    expect(sampler.triggerAttack).not.toHaveBeenCalled();
    expect(sampler.triggerRelease).not.toHaveBeenCalled();
  });
  it("panic clears keys, pedals and sustained notes", () => {
    engine.sustain(true);
    engine.attack("a", 60);
    engine.panic();
    expect(engine.held.size).toBe(0);
    expect(engine.pedal).toBe(false);
    expect(engine.pedals.size).toBe(0);
    expect(sampler.releaseAll).toHaveBeenCalledOnce();
  });
  it("supports fast repeats", () => {
    for (let i = 0; i < 20; i++) {
      engine.attack("a", 60);
      engine.release("a");
    }
    expect(sampler.triggerAttack).toHaveBeenCalledTimes(20);
    expect(sampler.triggerRelease).toHaveBeenCalledTimes(20);
  });
  it("routes voice presets to actual filter, sampler envelope and velocity", () => {
    const ramp = vi.fn();
    engine.filter = { frequency: { rampTo: ramp } } as never;
    engine.settings(0.7, 0.3, "soft");
    expect(ramp).toHaveBeenCalledWith(2200, 0.08);
    expect(engine.sampler?.attack).toBe(0.018);
    expect(engine.sampler?.release).toBe(1.8);
    engine.attack("soft", 60, 0.7);
    const soft = sampler.triggerAttack.mock.calls.at(-1)![2];
    engine.settings(0.7, 0.1, "strong");
    engine.attack("strong", 64, 0.7);
    expect(sampler.triggerAttack.mock.calls.at(-1)![2]).toBeGreaterThan(soft);
  });
});
