import type { Song } from "../music/model";

/** Bar start times (seconds) between `from` and `to`, following tempo and meter changes. */
export function barTimes(song: Song, from: number, to: number, limit = 2000) {
  const tempos = song.tempos.length ? song.tempos : [{ time: 0, bpm: song.tempo }];
  const meters = song.signatures.length
    ? song.signatures
    : [{ time: 0, value: song.timeSignature }];
  const at = <T extends { time: number }>(list: T[], time: number) =>
    list.reduce((current, entry) => (entry.time <= time + 1e-6 ? entry : current), list[0]);
  const bars: { time: number; index: number }[] = [];
  let time = 0;
  for (let index = 1; time <= to && bars.length < limit; index++) {
    if (time >= from) bars.push({ time, index });
    const [beats, unit] = at(meters, time).value;
    const bpm = Math.max(1, at(tempos, time).bpm);
    const step = (beats * (60 / bpm) * 4) / Math.max(1, unit);
    if (!(step > 0.05)) break;
    time += step;
  }
  return bars;
}
