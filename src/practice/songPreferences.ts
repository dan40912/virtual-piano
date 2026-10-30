import type { Song } from "../music/model";
import type { Note } from "../music/model";
import { DEFAULT_SPLIT_PITCH, type AutoPolicy } from "./handSplit";

export interface SongPracticePreferences {
  speed: number;
  transpose: number;
  loop: boolean;
  loopA: number;
  loopB: number;
  muted: number[];
  autoPolicy: Record<number, AutoPolicy>;
  splitPitch: number;
}

const STORAGE_KEY = "piano-studio-song-practice-v1";

export function selectLoopNotes(groups: Note[][], enabled: boolean, a: number, b: number) {
  return enabled ? groups.filter((group) => group[0]?.startTime >= a && group[0].startTime < b) : groups;
}

export function normalizeLoopRange(a: number, b: number, duration: number) {
  const start = Math.max(0, Math.min(Math.min(a, b), Math.max(0, duration - 0.1)));
  return { a: start, b: Math.max(start + 0.1, Math.min(duration, Math.max(a, b))) };
}

export function advanceWaitStep(step: number, total: number, loop: boolean) {
  if (total <= 0) return { step: 0, complete: true, wrapped: false };
  if (step + 1 >= total) return loop
    ? { step: 0, complete: false, wrapped: true }
    : { step: total, complete: true, wrapped: false };
  return { step: step + 1, complete: false, wrapped: false };
}

/** A stable identity for preferences and shares; content is hashed and never exposed in the ID. */
export function songPreferenceId(song: Song) {
  const canonicalEvents = <T>(events: T[]) =>
    events.map((event) => JSON.stringify(event)).sort();
  const canonical = JSON.stringify({
    v: 2,
    title: song.title,
    source: song.source,
    tempo: song.tempo,
    timeSignature: song.timeSignature,
    duration: song.duration,
    tracks: song.tracks,
    notes: canonicalEvents(song.notes.map((note) => [
      note.trackId,
      note.midi,
      note.startTime,
      note.duration,
      note.velocity,
    ])),
    pedals: canonicalEvents(song.pedals.map((pedal) => [pedal.time, pedal.trackId, pedal.down])),
    tempos: canonicalEvents(song.tempos.map((tempo) => [tempo.time, tempo.bpm])),
    signatures: canonicalEvents(song.signatures.map((signature) => [signature.time, signature.value])),
    xml: song.xml ?? null,
  });
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= BigInt(canonical.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  // v1 omitted note duration/velocity and tempo/pedal data, so legacy keys are
  // intentionally not migrated: they cannot be matched without risking collisions.
  return `song-v2-${hash.toString(36)}`;
}

function validPreferences(value: unknown, duration: number, tracks: number) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SongPracticePreferences>;
  if (
    typeof candidate.speed !== "number" || !Number.isFinite(candidate.speed) || candidate.speed < 0.25 || candidate.speed > 2 ||
    typeof candidate.transpose !== "number" || !Number.isInteger(candidate.transpose) || candidate.transpose < -12 || candidate.transpose > 12 ||
    typeof candidate.loop !== "boolean" ||
    typeof candidate.loopA !== "number" || !Number.isFinite(candidate.loopA) || candidate.loopA < 0 || candidate.loopA > duration ||
    typeof candidate.loopB !== "number" || !Number.isFinite(candidate.loopB) || candidate.loopB < 0 || candidate.loopB > duration || candidate.loopB - candidate.loopA < 0.1 ||
    !Array.isArray(candidate.muted) || candidate.muted.some((track) => !Number.isInteger(track) || track < 0 || track >= tracks) ||
    !candidate.autoPolicy || typeof candidate.autoPolicy !== "object" ||
    (candidate.splitPitch !== undefined && (!Number.isInteger(candidate.splitPitch) || candidate.splitPitch < 36 || candidate.splitPitch > 84))
  ) return null;
  const autoPolicy: SongPracticePreferences["autoPolicy"] = {};
  for (const [track, policy] of Object.entries(candidate.autoPolicy)) {
    const index = Number(track);
    if (!Number.isInteger(index) || index < 0 || index >= tracks || !["all", "bass", "treble", "manual"].includes(policy as string)) return null;
    autoPolicy[index] = policy as AutoPolicy;
  }
  return {
    speed: candidate.speed,
    transpose: candidate.transpose,
    loop: candidate.loop,
    loopA: candidate.loopA,
    loopB: candidate.loopB,
    muted: [...new Set(candidate.muted)],
    autoPolicy,
    splitPitch: candidate.splitPitch ?? DEFAULT_SPLIT_PITCH,
  };
}

export function readSongPreferences(song: Song): SongPracticePreferences | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, unknown>;
    return validPreferences(all[songPreferenceId(song)], song.duration, song.tracks.length);
  } catch {
    return null;
  }
}

export function writeSongPreferences(song: Song, preferences: SongPracticePreferences) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, unknown>;
    const key = songPreferenceId(song);
    all[key] = preferences;
    const entries = Object.entries(all);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-40))));
  } catch {
    // Storage can be unavailable in private browsing or when quota is exhausted.
  }
}

export function encodePracticeShare(song: Song, preferences: SongPracticePreferences) {
  let sourceUrl: string | undefined;
  try {
    const url = new URL(song.source);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password)
      sourceUrl = url.href.slice(0, 500);
  } catch { /* Imported/local source labels are not URLs. */ }
  const payload = JSON.stringify({ v: 2, s: songPreferenceId(song), t: song.title.slice(0, 100), u: sourceUrl, p: preferences });
  return btoa(String.fromCharCode(...new TextEncoder().encode(payload)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function describePracticeShare(value: string) {
  if (!/^[A-Za-z0-9_-]{1,4096}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { v?: unknown; s?: unknown; t?: unknown; u?: unknown };
    if (parsed.v !== 2 || typeof parsed.s !== "string" || typeof parsed.t !== "string" || parsed.t.length > 100) return null;
    let sourceUrl: string | undefined;
    if (parsed.u !== undefined) {
      if (typeof parsed.u !== "string" || parsed.u.length > 500) return null;
      const url = new URL(parsed.u);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
      sourceUrl = url.href;
    }
    return { songId: parsed.s, title: parsed.t, sourceUrl };
  } catch {
    return null;
  }
}

export function decodePracticeShare(value: string, song: Song): SongPracticePreferences | null {
  const info = describePracticeShare(value);
  if (!info) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { v?: unknown; s?: unknown; p?: unknown };
    if (info.songId !== songPreferenceId(song)) return null;
    return validPreferences(parsed.p, song.duration, song.tracks.length);
  } catch {
    return null;
  }
}
