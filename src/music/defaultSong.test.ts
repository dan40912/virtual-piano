import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultSong } from "./defaultSong";
import { parseMidi } from "./importers";
it("uses the supplied default MIDI with exact source notes, timing, tempo and meter", async () => {
  const bytes = readFileSync(
    new URL("../../public/music/e0637_i.mid", import.meta.url),
  );
  const song = await parseMidi(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    "e0637_i.mid",
  );
  expect(defaultSong.notes).toEqual(song.notes);
  expect(defaultSong.notes).toHaveLength(241);
  expect(defaultSong.tempos).toEqual(song.tempos);
  expect(defaultSong.timeSignature).toEqual([3, 4]);
  expect(defaultSong.tempo).toBeCloseTo(110);
  expect(defaultSong.duration).toBeCloseTo(38.77, 2);
  expect(defaultSong.title).toContain("e0637_i");
  expect(defaultSong.title).not.toContain("Stage");
  expect(defaultSong.tracks).toEqual(song.tracks);
});
