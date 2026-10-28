import type { Song } from "../music/model";

export interface SavedRecording {
  id: string;
  name: string;
  createdAt: number;
  song: Song;
}

export interface RecordingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "virtual-piano-recordings-v1";
const MAX_RECORDINGS = 25;
const MAX_NOTES_PER_RECORDING = 5000;
const MAX_STORAGE_CHARS = 1_200_000;
const MAX_NAME_LENGTH = 80;

function storageOrThrow(): RecordingStorage {
  try {
    return window.localStorage;
  } catch {
    throw new Error("瀏覽器未允許本機儲存");
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  if (typeof song.title !== "string" || typeof song.source !== "string" ||
      !isFiniteNumber(song.tempo) || song.tempo <= 0 || !isFiniteNumber(song.duration) || song.duration < 0 ||
      !Array.isArray(song.timeSignature) || song.timeSignature.length !== 2 ||
      !song.timeSignature.every((v) => Number.isInteger(v) && v > 0) ||
      !Array.isArray(song.tracks) || song.tracks.length === 0 || !song.tracks.every((track) => typeof track === "string") ||
      !Array.isArray(song.notes) || song.notes.length > MAX_NOTES_PER_RECORDING ||
      !Array.isArray(song.pedals) || !Array.isArray(song.tempos) || !Array.isArray(song.signatures)) return false;
  const validTrack = (trackId: unknown) => Number.isInteger(trackId) && Number(trackId) >= 0 && Number(trackId) < song.tracks!.length;
  return song.notes.every((note) => !!note && typeof note.id === "string" &&
      Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127 &&
      isFiniteNumber(note.startTime) && note.startTime >= 0 &&
      isFiniteNumber(note.duration) && note.duration > 0 &&
      isFiniteNumber(note.velocity) && note.velocity >= 0 && note.velocity <= 1 && validTrack(note.trackId)) &&
    song.pedals.every((pedal) => !!pedal && isFiniteNumber(pedal.time) && pedal.time >= 0 &&
      typeof pedal.down === "boolean" && validTrack(pedal.trackId)) &&
    song.tempos.every((tempo) => !!tempo && isFiniteNumber(tempo.time) && tempo.time >= 0 &&
      isFiniteNumber(tempo.bpm) && tempo.bpm > 0) &&
    song.signatures.every((signature) => !!signature && isFiniteNumber(signature.time) && signature.time >= 0 &&
      Array.isArray(signature.value) && signature.value.length === 2 &&
      signature.value.every((v) => Number.isInteger(v) && v > 0));
}

function isSavedRecording(value: unknown): value is SavedRecording {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedRecording>;
  return typeof item.id === "string" && item.id.length > 0 &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    isFiniteNumber(item.createdAt) && isSong(item.song);
}

export function listRecordings(storage = storageOrThrow()): SavedRecording[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_RECORDINGS || !parsed.every(isSavedRecording)) throw new Error("invalid library");
    return parsed.slice(0, MAX_RECORDINGS);
  } catch {
    throw new Error("錄音庫資料格式損毀，原始資料已保留；請先勿儲存或覆寫。");
  }
}

function write(items: SavedRecording[], storage: RecordingStorage) {
  const data = JSON.stringify(items);
  if (data.length > MAX_STORAGE_CHARS) throw new Error("錄音庫容量已滿，請刪除部分作品");
  try {
    storage.setItem(STORAGE_KEY, data);
  } catch {
    throw new Error("瀏覽器儲存空間不足，請刪除部分作品後重試");
  }
}

export function saveRecording(name: string, song: Song, storage = storageOrThrow(), now = Date.now()): SavedRecording {
  const cleanName = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!cleanName) throw new Error("請先輸入作品名稱");
  if (!isSong(song)) throw new Error("錄音資料無法儲存");
  const items = listRecordings(storage);
  if (items.length >= MAX_RECORDINGS) throw new Error("錄音庫最多儲存 25 段，請先刪除作品");
  const item: SavedRecording = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    name: cleanName,
    createdAt: now,
    song: structuredClone(song),
  };
  write([item, ...items], storage);
  return item;
}

export function renameRecording(id: string, name: string, storage = storageOrThrow()): SavedRecording[] {
  const cleanName = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!cleanName) throw new Error("請先輸入作品名稱");
  const items = listRecordings(storage);
  if (!items.some((item) => item.id === id)) throw new Error("找不到這段錄音");
  const updated = items.map((item) => item.id === id ? { ...item, name: cleanName } : item);
  write(updated, storage);
  return updated;
}

export function deleteRecording(id: string, storage = storageOrThrow()): SavedRecording[] {
  const items = listRecordings(storage).filter((item) => item.id !== id);
  write(items, storage);
  return items;
}

