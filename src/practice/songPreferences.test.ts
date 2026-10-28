import { afterEach, describe, expect, it, vi } from "vitest";
import type { Song } from "../music/model";
import { advanceWaitStep, decodePracticeShare, encodePracticeShare, normalizeLoopRange, readSongPreferences, selectLoopNotes, songPreferenceId, writeSongPreferences, type SongPracticePreferences } from "./songPreferences";

const song: Song = {
  title: "練習曲",
  source: "https://example.com/song.mid",
  tempo: 100,
  timeSignature: [4, 4],
  notes: [
    { id: "a", midi: 60, startTime: 1, duration: 0.4, velocity: 0.7, trackId: 0 },
    { id: "b", midi: 62, startTime: 3, duration: 0.4, velocity: 0.7, trackId: 0 },
    { id: "c", midi: 64, startTime: 6, duration: 0.4, velocity: 0.7, trackId: 0 },
  ],
  duration: 8,
  tracks: ["旋律"],
  pedals: [],
  tempos: [{ time: 0, bpm: 100 }],
  signatures: [],
};
const prefs: SongPracticePreferences = {
  speed: 0.75, transpose: 2, loop: true, loopA: 2, loopB: 7,
  muted: [], autoPolicy: { 0: "manual" }, splitPitch: 66,
};

afterEach(() => vi.unstubAllGlobals());

describe("practice configuration", () => {
  it("selects only note groups inside the loop and wraps wait practice at B", () => {
    const groups = [[song.notes[0]], [song.notes[1]], [song.notes[2]]];
    expect(selectLoopNotes(groups, true, 2, 6).map((group) => group[0].id)).toEqual(["b"]);
    expect(advanceWaitStep(0, 1, true)).toEqual({ step: 0, complete: false, wrapped: true });
    expect(advanceWaitStep(0, 1, false)).toEqual({ step: 1, complete: true, wrapped: false });
    expect(advanceWaitStep(0, 0, true)).toEqual({ step: 0, complete: true, wrapped: false });
  });

  it("normalizes dragged loop ranges within the song duration", () => {
    expect(normalizeLoopRange(6, 2, song.duration)).toEqual({ a: 2, b: 6 });
    expect(normalizeLoopRange(-5, 40, song.duration)).toEqual({ a: 0, b: 8 });
  });

  it("shares config and a safe source reference, while rejecting another song or invalid bounds", () => {
    const encoded = encodePracticeShare(song, prefs);
    expect(decodePracticeShare(encoded, song)).toEqual(prefs);
    expect(decodePracticeShare(encoded, song)?.splitPitch).toBe(66);
    const other = { ...song, title: "另一首", notes: song.notes.map((note) => ({ ...note })) };
    expect(decodePracticeShare(encoded, other)).toBeNull();

    const malformed = encodePracticeShare(song, { ...prefs, speed: 20 });
    expect(decodePracticeShare(malformed, song)).toBeNull();
    expect(decodePracticeShare("javascript%3Aalert(1)", song)).toBeNull();
  });

  it("fingerprints full musical content without exposing source URLs and rejects revised-song shares", () => {
    const encoded = encodePracticeShare(song, prefs);
    const revisedSongs: Song[] = [
      { ...song, duration: song.duration + 0.1 },
      { ...song, notes: song.notes.map((note, index) => index === 0 ? { ...note, duration: note.duration + 0.1 } : note) },
      { ...song, notes: song.notes.map((note, index) => index === 0 ? { ...note, velocity: note.velocity + 0.1 } : note) },
      { ...song, tempo: song.tempo + 1 },
      { ...song, tempos: [{ ...song.tempos[0], bpm: song.tempos[0].bpm + 1 }] },
      { ...song, pedals: [{ time: 1, down: true, trackId: 0 }] },
      { ...song, signatures: [{ time: 2, value: [3, 4] }] },
    ];

    for (const revised of revisedSongs) {
      expect(songPreferenceId(revised)).not.toBe(songPreferenceId(song));
      expect(decodePracticeShare(encoded, revised)).toBeNull();
    }

    expect(songPreferenceId(song)).toMatch(/^song-v2-[a-z0-9]+$/);
    expect(songPreferenceId(song)).not.toContain("example.com");
    expect(songPreferenceId(song)).not.toContain(song.title);
    const reordered = { ...song, notes: [...song.notes].reverse() };
    expect(songPreferenceId(reordered)).toBe(songPreferenceId(song));
  });

  it("persists each song independently and restores settings across reloads", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const other: Song = { ...song, title: "副歌", source: "local.mid", notes: song.notes.map((note) => ({ ...note, midi: note.midi + 5 })) };
    const otherPrefs = { ...prefs, speed: 1.25, transpose: -3, loopA: 1, loopB: 4, autoPolicy: { 0: "all" as const } };
    writeSongPreferences(song, prefs);
    writeSongPreferences(other, otherPrefs);
    expect(readSongPreferences(song)).toEqual(prefs);
    expect(readSongPreferences(other)).toEqual(otherPrefs);
    expect(readSongPreferences(song)).toEqual(prefs);
  });

  it("defaults missing splitPitch to C4 in stored preferences and shared links", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const legacy = { ...prefs } as Partial<SongPracticePreferences>;
    delete legacy.splitPitch;
    values.set("piano-studio-song-practice-v1", JSON.stringify({ [songPreferenceId(song)]: legacy }));
    expect(readSongPreferences(song)?.splitPitch).toBe(60);

    const payload = { v: 2, s: songPreferenceId(song), t: song.title, u: song.source, p: legacy };
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodePracticeShare(encoded, song)?.splitPitch).toBe(60);
  });

  it("ignores malformed stored preferences instead of applying them to a song", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    writeSongPreferences(song, prefs);
    const raw = [...values.values()][0];
    values.set([...values.keys()][0], raw.replace('"speed":0.75', '"speed":99'));
    expect(readSongPreferences(song)).toBeNull();
  });
});
