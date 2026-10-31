import { expect, it } from "vitest";
import { barTimes } from "./bars";
import type { Song } from "../music/model";

const base: Song = {
  title: "t", source: "t", tempo: 120, timeSignature: [4, 4], notes: [], duration: 20,
  tracks: ["a"], pedals: [], tempos: [], signatures: [],
};

it("spaces 4/4 bars at 120 BPM two seconds apart and numbers them from 1", () => {
  expect(barTimes(base, 0, 6)).toEqual([
    { time: 0, index: 1 }, { time: 2, index: 2 }, { time: 4, index: 3 }, { time: 6, index: 4 },
  ]);
});

it("follows tempo and meter changes and only returns bars inside the window", () => {
  const song: Song = {
    ...base,
    tempos: [{ time: 0, bpm: 120 }, { time: 4, bpm: 60 }],
    signatures: [{ time: 0, value: [4, 4] }, { time: 4, value: [3, 4] }],
  };
  // Two 2 s bars, then 3/4 at 60 BPM = 3 s bars.
  expect(barTimes(song, 3, 11).map((bar) => bar.time)).toEqual([4, 7, 10]);
  expect(barTimes(song, 3, 11).map((bar) => bar.index)).toEqual([3, 4, 5]);
});
