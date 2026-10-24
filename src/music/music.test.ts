import { describe, it, expect } from "vitest";
import { Midi } from "@tonejs/midi";
import { Window } from "happy-dom";
import {
  parseMidi,
  parseXml,
  validateHymnal,
  importedTitle,
} from "./importers";
import { defaultMap, demo, groups, isBlack, noteName } from "./model";
globalThis.DOMParser = new Window().DOMParser as unknown as typeof DOMParser;
describe("piano geometry and mapping", () => {
  it("covers exactly 88 notes, 52 white and 36 black keys", () => {
    const keys = Array.from({ length: 88 }, (_, i) => i + 21);
    expect(keys.filter(isBlack)).toHaveLength(36);
    expect(keys.filter((n) => !isBlack(n))).toHaveLength(52);
    expect(noteName(keys[0])).toBe("A0");
    expect(noteName(keys[87])).toBe("C8");
  });
  it("maps one unmodified QWERTY octave in semitone order", () => {
    expect(Object.values(defaultMap)).toEqual(
      Array.from({ length: 12 }, (_, i) => 60 + i),
    );
    expect(defaultMap.KeyA).toBe(60);
    expect(defaultMap.KeyJ).toBe(71);
  });
  it("groups actual simultaneous notes and respects track mute", () => {
    expect(groups(demo)[0]).toHaveLength(3);
    expect(groups(demo, [1])[0]).toHaveLength(1);
    expect(demo.duration).toBeGreaterThan(25);
  });
});
describe("MIDI import", () => {
  it("preserves polyphony, tempo changes, meter, tracks and CC64", async () => {
    const midi = new Midi();
    midi.header.tempos = [
      { ticks: 0, bpm: 120 },
      { ticks: 480, bpm: 60 },
    ];
    midi.header.timeSignatures = [
      { ticks: 0, timeSignature: [3, 4], measures: 0 },
    ];
    midi.header.update();
    const a = midi.addTrack();
    a.name = "Melody";
    a.addNote({ midi: 60, ticks: 0, durationTicks: 960, velocity: 0.8 });
    a.addNote({ midi: 64, ticks: 0, durationTicks: 240, velocity: 0.4 });
    a.addCC({ number: 64, ticks: 0, value: 1 });
    a.addCC({ number: 64, ticks: 960, value: 0 });
    midi.addTrack().addNote({ midi: 48, ticks: 480, durationTicks: 480 });
    const s = await parseMidi(midi.toArray().buffer as ArrayBuffer, "test");
    expect(s.notes).toHaveLength(3);
    expect(s.tracks).toHaveLength(2);
    expect(s.tempos).toHaveLength(2);
    expect(s.timeSignature).toEqual([3, 4]);
    expect(s.notes.find((n) => n.midi === 60)?.duration).toBeCloseTo(1.5);
    expect(s.pedals.map((p) => p.down)).toEqual([true, false]);
    expect(s.notes[0].velocity).toBeCloseTo(0.8, 1);
  });
  it("rejects malformed and empty MIDI", async () => {
    await expect(parseMidi(new ArrayBuffer(2), "bad")).rejects.toThrow();
    await expect(
      parseMidi(new Midi().toArray().buffer as ArrayBuffer, "empty"),
    ).rejects.toThrow();
  });
});
describe("hymnal validation", () => {
  it("accepts supplied URL", () =>
    expect(
      validateHymnal("https://www.hymnal.net/zh/hymn/ch/471").pathname,
    ).toBe("/zh/hymn/ch/471"));
  it.each([
    "javascript:alert(1)",
    "https://hymnal.net.evil.com/zh/hymn/ch/471",
    "https://user:password@hymnal.net/zh/hymn/ch/471",
    "https://hymnal.net/a",
    "ftp://hymnal.net/zh/hymn/ch/471",
  ])("rejects unsafe or unsupported URL %s", (url) =>
    expect(() => validateHymnal(url)).toThrow(),
  );
});
const xml = `<score-partwise><work><work-title>Test score</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes><direction><sound tempo="120"/></direction><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/></note><note><chord/><pitch><step>E</step><alter>-1</alter><octave>4</octave></pitch><duration>2</duration></note><direction><sound tempo="60"/></direction><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/></note><note><rest/><duration>2</duration></note></measure></part></score-partwise>`;
describe("MusicXML conversion", () => {
  it("preserves chords, accidentals, ties, rests and tempo changes", () => {
    const s = parseXml(xml, "x");
    expect(s.title).toBe("Test score");
    expect(s.notes).toHaveLength(2);
    expect(s.notes.map((n) => n.midi)).toEqual([60, 63]);
    expect(s.notes[0].duration).toBeCloseTo(1.5);
    expect(s.notes[1].duration).toBeCloseTo(0.5);
    expect(s.duration).toBeCloseTo(2.5);
    expect(s.timeSignature).toEqual([3, 4]);
    expect(s.xml).toBe(xml);
  });
  it("rejects unsupported repeats instead of silently misplaying", () =>
    expect(() =>
      parseXml(
        xml.replace(
          "<measure>",
          '<measure><barline><repeat direction="backward"/></barline>',
        ),
        "x",
      ),
    ).toThrow("反覆"));
  it("rejects compressed or malformed XML", () =>
    expect(() => parseXml("bad", "x")).toThrow());
});

it("uses a neutral or file title for the removed stage label in MIDI metadata", () => {
  expect(importedTitle("Steinway Piano Stage", "my-song.mid")).toBe("my-song");
  expect(
    importedTitle("Steinway Piano Stage", "Steinway Piano Stage.mid"),
  ).toBe("匯入的鋼琴曲");
  expect(importedTitle("小星星", "file.mid")).toBe("小星星");
});
