import { describe, expect, it } from "vitest";
import { LiveRecorder } from "./LiveRecorder";

describe("live recorder lifecycle", () => {
  it("reports elapsed time while active and freezes the duration on stop", () => {
    let now = 4;
    const recorder = new LiveRecorder(() => now);
    recorder.start();
    now = 6.25;
    expect(recorder.elapsed()).toBe(2.25);
    recorder.stop();
    now = 9;
    expect(recorder.elapsed()).toBe(2.25);
  });

  it("closes held notes when stopping and resets the clock for the next take", () => {
    let now = 10;
    const recorder = new LiveRecorder(() => now);
    recorder.start();
    now = 11;
    recorder.attack("key", 60, 0.75);
    now = 12;
    recorder.stop();
    expect(recorder.recording).toBe(false);
    expect(recorder.notes).toMatchObject([{ midi: 60, duration: 1 }]);
    now = 20;
    recorder.start();
    expect(recorder.elapsed()).toBe(0);
    now = 20.5;
    recorder.stop();
    expect(recorder.duration).toBe(0.5);
  });
});
