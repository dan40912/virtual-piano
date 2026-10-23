import { describe, it, expect } from "vitest";
import { defaultMap, legacyMap } from "../music/model";
import {
  completeMapping,
  keyboardBinding,
  shortcutLabel,
  validShortcut,
} from "../music/keyboard";
import { voiceStyles, styledVelocity } from "./styles";
import { LiveRecorder } from "./LiveRecorder";
describe("88-key shortcuts", () => {
  it("covers every note exactly once without browser shortcuts", () => {
    expect(Object.keys(defaultMap)).toHaveLength(88);
    expect([...Object.values(defaultMap)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 88 }, (_, i) => 21 + i),
    );
    expect(Object.keys(defaultMap).every(validShortcut)).toBe(true);
    for (const [code, note] of Object.entries(legacyMap))
      expect(defaultMap[code]).toBe(note);
  });
  it("supports Shift labels and physical modifier handling", () => {
    expect(keyboardBinding({ code: "KeyA", shiftKey: true })).toBe(
      "Shift+KeyA",
    );
    expect(shortcutLabel("Shift+KeyA")).toBe("⇧A");
    expect(shortcutLabel("Semicolon")).toBe(";");
    expect(validShortcut("Control+KeyA")).toBe(false);
  });
  it("fills legacy/custom layouts without overwriting assigned notes", () => {
    const m = completeMapping({ KeyQ: 60 });
    expect(m.KeyQ).toBe(60);
    expect(new Set(Object.values(m)).size).toBe(88);
    expect(Object.keys(m)).toHaveLength(88);
  });
});
describe("audible voice presets", () => {
  it("changes timbre, envelope and dynamics independently of pitch", () => {
    expect(voiceStyles.soft.cutoff).toBeLessThan(voiceStyles.strong.cutoff);
    expect(voiceStyles.bright.release).toBeLessThan(voiceStyles.soft.release);
    expect(voiceStyles.soft.attack).toBeGreaterThan(voiceStyles.strong.attack);
    expect(styledVelocity(0.7, "soft")).toBeLessThan(
      styledVelocity(0.7, "strong"),
    );
    expect(styledVelocity(1, "strong")).toBe(1);
    expect(styledVelocity(0.6, "natural")).toBe(0.6);
  });
});
describe("live performance recording", () => {
  it("records real note timing, chords, velocity, sustain and safe note-off at stop", () => {
    let time = 10;
    const r = new LiveRecorder(() => time);
    r.start();
    time = 11;
    r.attack("a", 60, 0.6);
    r.attack("b", 64, 0.7);
    r.pedal(true);
    time = 12;
    r.release("a");
    time = 13;
    r.stop();
    const song = r.song();
    expect(song.notes.map((n) => n.midi)).toEqual([60, 64]);
    expect(song.notes[0]).toMatchObject({
      startTime: 1,
      duration: 1,
      velocity: 0.6,
    });
    expect(song.notes[1].duration).toBe(2);
    expect(song.pedals.map((p) => p.down)).toEqual([true, false]);
    expect(song.duration).toBe(3);
    expect(r.held.size).toBe(0);
  });
  it("ignores events outside a recording and clears previous take on new recording", () => {
    let time = 0;
    const r = new LiveRecorder(() => time);
    r.attack("a", 60, 0.7);
    r.release("a");
    expect(r.notes).toHaveLength(0);
    r.start();
    r.attack("a", 60, 0.7);
    time = 1;
    r.stop();
    expect(r.notes).toHaveLength(1);
    r.start();
    expect(r.notes).toHaveLength(0);
    expect(r.pedals).toHaveLength(0);
  });
});
