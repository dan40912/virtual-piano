import { afterEach, describe, expect, it, vi } from "vitest";
import { ChordPerformance } from "./ChordPerformance";
import { chordCatalog, keyChordMaps } from "../music/chords";

afterEach(() => vi.useRealTimers());

describe("ChordPerformance", () => {
  it("releases every held block note immediately and leaves no scheduled work", () => {
    vi.useFakeTimers();
    const attack = vi.fn(),
      release = vi.fn();
    const player = new ChordPerformance(attack, release);
    player.start("held", chordCatalog.C, "block", "bold");
    expect(attack).toHaveBeenCalledTimes(4);
    expect(attack.mock.calls[0][2]).toBeGreaterThan(0.9);
    player.release("held");
    expect(release).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(5000);
    expect(attack).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops a repeating arpeggio without leaving note releases or another tick behind", () => {
    vi.useFakeTimers();
    const attack = vi.fn(),
      release = vi.fn();
    const player = new ChordPerformance(attack, release);
    player.start("held", chordCatalog.C, "arpeggio", "bright");
    vi.advanceTimersByTime(250);
    expect(attack.mock.calls.length).toBeGreaterThan(1);
    player.release("held");
    const count = attack.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(attack).toHaveBeenCalledTimes(count);
    expect(release).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues arpeggio and accompaniment ticks through intentional silent gaps", () => {
    vi.useFakeTimers();
    const arpAttack = vi.fn(),
      arpRelease = vi.fn();
    const arp = new ChordPerformance(arpAttack, arpRelease);
    arp.start("arp", chordCatalog.C, "arpeggio", "bold");
    vi.advanceTimersByTime(700);
    expect(arpAttack.mock.calls.length).toBeGreaterThan(3);
    arp.release("arp");

    const rhythmAttack = vi.fn(),
      rhythmRelease = vi.fn();
    const rhythm = new ChordPerformance(rhythmAttack, rhythmRelease);
    rhythm.start("rhythm", chordCatalog.C, "accompaniment", "bold");
    vi.advanceTimersByTime(1200);
    expect(rhythmAttack.mock.calls.length).toBeGreaterThan(4);
    rhythm.stop();
    const count = rhythmAttack.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(rhythmAttack).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays later progression chords across release gaps and cancels them on stop", () => {
    vi.useFakeTimers();
    const attack = vi.fn(),
      release = vi.fn();
    const player = new ChordPerformance(attack, release);
    const progression = ["Cmaj7", "G7", "Am7", "Fmaj7"].map(
      (name) => chordCatalog[name],
    );
    player.playProgression("song", progression, "bold");
    vi.advanceTimersByTime(2200);
    expect(attack.mock.calls.length).toBe(16);
    player.stop();
    vi.advanceTimersByTime(5000);
    expect(attack.mock.calls.length).toBe(16);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarting the same owner prevents stale timers from affecting the new performance", () => {
    vi.useFakeTimers();
    const attack = vi.fn(),
      release = vi.fn();
    const player = new ChordPerformance(attack, release);
    player.start("same", chordCatalog.C, "arpeggio", "bold");
    vi.advanceTimersByTime(100);
    player.start("same", chordCatalog.C, "block", "gentle");
    const count = attack.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(attack).toHaveBeenCalledTimes(count);
    expect(release).toHaveBeenCalledTimes(1);
    player.stop();
  });

  it("resolves a I–V–vi–IV progression in each supported key with real notes", () => {
    for (const key of ["C", "G", "D", "A", "F", "Bb"]) {
      const map = keyChordMaps[key];
      const progression = [map.KeyZ, map.KeyB, map.KeyN, map.KeyV];
      expect(
        progression.every((name) => chordCatalog[name]?.length === 4),
      ).toBe(true);
      expect(
        progression
          .flatMap((name) => chordCatalog[name])
          .every(Number.isFinite),
      ).toBe(true);
    }
  });
});
