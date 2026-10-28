import fs from "node:fs";
import midiPackage from "@tonejs/midi";
const { Midi } = midiPackage;
const midi = new Midi(
  fs.readFileSync(new URL("../public/music/e0637_i.mid", import.meta.url)),
);
const song = {
  title: "預設練習曲",
  source: "使用者指定 · e0637_i.mid",
  tempo: midi.header.tempos[0]?.bpm || 120,
  timeSignature: midi.header.timeSignatures[0]?.timeSignature || [4, 4],
  notes: midi.tracks
    .flatMap((t, i) =>
      t.notes.map((n, j) => ({
        id: `${i}-${j}`,
        midi: n.midi,
        startTime: n.time,
        duration: n.duration,
        velocity: n.velocity,
        trackId: i,
      })),
    )
    .sort((a, b) => a.startTime - b.startTime),
  duration: midi.duration,
  tracks: midi.tracks.map((t, i) =>
    /steinway\s+piano\s+stage/i.test(t.name)
      ? "鋼琴"
      : t.name || `音軌 ${i + 1}`,
  ),
  pedals: midi.tracks.flatMap((t, i) =>
    (t.controlChanges[64] || []).map((c) => ({
      time: c.time,
      down: c.value >= 0.5,
      trackId: i,
    })),
  ),
  tempos: midi.header.tempos.map((t) => ({
    time: midi.header.ticksToSeconds(t.ticks),
    bpm: t.bpm,
  })),
  signatures: midi.header.timeSignatures.map((t) => ({
    time: midi.header.ticksToSeconds(t.ticks),
    value: t.timeSignature,
  })),
};
if (!song.notes.length) throw Error("Default MIDI contains no notes");
fs.writeFileSync(
  new URL("../src/music/default-song.json", import.meta.url),
  JSON.stringify(song),
);
console.log(
  `Prepared user default: ${song.notes.length} notes, ${song.tracks.length} tracks, ${song.tempo} BPM, ${song.timeSignature.join("/")}, ${song.duration.toFixed(2)}s`,
);
