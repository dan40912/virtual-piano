import type { Song } from "../music/model";
import { songPreferenceId } from "../practice/songPreferences";
import { isSong } from "./recordingLibrary";

export interface RecentSong {
  id: string;
  song: Song;
  position: number;
  updatedAt: number;
}
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const KEY = "piano-studio-recent-songs-v1";
const LIMIT = 8;
const MAX_CHARS = 1_500_000;
function storage(): Storage { return window.localStorage; }
export function recentSongs(target?: Storage): RecentSong[] {
  try {
    const value: unknown = JSON.parse((target || storage()).getItem(KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is RecentSong =>
      !!entry && typeof entry === "object" && typeof entry.id === "string" &&
      isSong(entry.song) && Number.isFinite(entry.position) && entry.position >= 0 &&
      entry.position <= entry.song.duration && Number.isFinite(entry.updatedAt),
    ).slice(0, LIMIT);
  } catch { return []; }
}
export function readLastSong(target?: Storage) { return recentSongs(target)[0] || null; }
export function rememberSong(song: Song, position = 0, target: Storage = storage()): RecentSong[] {
  if (!isSong(song)) throw Error("這首曲目較大或資料不完整；仍可演奏，但不會存入最近練習。");
  const id = songPreferenceId(song);
  const entries = [{ id, song, position: Math.max(0, Math.min(song.duration, Number.isFinite(position) ? position : 0)), updatedAt: Date.now() },
    ...recentSongs(target).filter((item) => item.id !== id)].slice(0, LIMIT);
  while (JSON.stringify(entries).length > MAX_CHARS && entries.length > 1) entries.pop();
  const data = JSON.stringify(entries);
  if (data.length > MAX_CHARS) throw Error("這首曲目超過本機收藏容量；仍可演奏與匯出。");
  try { target.setItem(KEY, data); }
  catch { throw Error("無法儲存最近練習，請確認瀏覽器儲存空間；目前演奏仍可繼續。"); }
  return entries;
}
export function rememberPosition(song: Song, position: number, target?: Storage) {
  const entries = recentSongs(target);
  const id = songPreferenceId(song);
  const current = entries.find((entry) => entry.id === id);
  if (!current || !Number.isFinite(position)) return;
  current.position = Math.max(0, Math.min(song.duration, position));
  current.updatedAt = Date.now();
  try { (target || storage()).setItem(KEY, JSON.stringify([current, ...entries.filter((entry) => entry !== current)])); }
  catch { /* Preserve playback even if this optional position checkpoint fails. */ }
}
