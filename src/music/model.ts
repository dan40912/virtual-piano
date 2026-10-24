export interface Note {
  id: string;
  midi: number;
  startTime: number;
  duration: number;
  velocity: number;
  trackId: number;
}
export interface Song {
  title: string;
  source: string;
  tempo: number;
  timeSignature: [number, number];
  notes: Note[];
  duration: number;
  tracks: string[];
  pedals: { time: number; down: boolean; trackId: number }[];
  tempos: { time: number; bpm: number }[];
  signatures: { time: number; value: number[] }[];
  xml?: string;
}
export const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);
export const noteName = (n: number) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][n % 12] +
  (Math.floor(n / 12) - 1);
// One familiar chromatic octave; Page Up/Down moves it through the piano.
export const legacyMap: Record<string, number> = Object.fromEntries(
  ["KeyA", "KeyW", "KeyS", "KeyE", "KeyD", "KeyF", "KeyT", "KeyG", "KeyY", "KeyH", "KeyU", "KeyJ"]
    .map((code, index) => [code, 60 + index]),
);
// Home row plays the nine white keys; the upper row fills the seven black keys.
// C4–D♯5 covers the most useful central range without Shift combinations.
export const defaultMap: Record<string, number> = Object.fromEntries(
  [
    ["KeyA", 60], ["KeyW", 61], ["KeyS", 62], ["KeyE", 63],
    ["KeyD", 64], ["KeyF", 65], ["KeyT", 66], ["KeyG", 67],
    ["KeyY", 68], ["KeyH", 69], ["KeyU", 70], ["KeyJ", 71],
    ["KeyK", 72], ["KeyO", 73], ["KeyL", 74], ["KeyP", 75],
  ],
);
export const demo: Song = {
  title: "小星星 · Twinkle, Twinkle",
  source: "內建示範 · 公版旋律 / 本專案編曲",
  tempo: 100,
  timeSignature: [4, 4],
  duration: 29,
  tracks: ["旋律", "伴奏"],
  pedals: [],
  tempos: [{ time: 0, bpm: 100 }],
  signatures: [{ time: 0, value: [4, 4] }],
  notes: [],
};
const melody = [
  60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64,
  64, 62, 67, 67, 65, 65, 64, 64, 62, 60, 60, 67, 67, 69, 69, 67, 65, 65, 64,
  64, 62, 62, 60,
];
let time = 0;
melody.forEach((m, i) => {
  let d = [6, 13, 20, 27, 34, 41].includes(i) ? 1.2 : 0.6;
  demo.notes.push({
    id: "m" + i,
    midi: m,
    startTime: time,
    duration: d * 0.88,
    velocity: 0.78,
    trackId: 0,
  });
  if (i % 2 === 0)
    [48, 55].forEach((m, j) =>
      demo.notes.push({
        id: `b${i}-${j}`,
        midi: m,
        startTime: time,
        duration: d * 0.85,
        velocity: 0.36,
        trackId: 1,
      }),
    );
  time += d;
});
demo.duration = time;
export function groups(song: Song, muted: number[] = []) {
  const out: Note[][] = [];
  for (const n of song.notes
    .filter((n) => !muted.includes(n.trackId))
    .sort((a, b) => a.startTime - b.startTime)) {
    let last = out.at(-1);
    if (last && Math.abs(last[0].startTime - n.startTime) < 0.035) last.push(n);
    else out.push([n]);
  }
  return out;
}
