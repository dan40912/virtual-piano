export const chordCatalog: Record<string, number[]> = {
  C: [48, 60, 64, 67],
  Dm: [50, 62, 65, 69],
  Em: [52, 64, 67, 71],
  F: [53, 60, 65, 69],
  G: [43, 59, 62, 67],
  G7: [43, 59, 62, 65],
  Am: [45, 60, 64, 69],
  A: [45, 61, 64, 69],
  D: [50, 62, 66, 69],
  E: [40, 59, 64, 68],
  E7: [40, 59, 62, 68],
  "F#m": [42, 61, 66, 69],
  B: [47, 59, 63, 66],
  B7: [47, 57, 63, 66],
};

const keyData: Record<string, { root: number; names: string[] }> = {
  C: { root: 0, names: ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5"] },
  G: {
    root: 7,
    names: ["Gmaj7", "Am7", "Bm7", "Cmaj7", "D7", "Em7", "F#m7b5"],
  },
  D: {
    root: 2,
    names: ["Dmaj7", "Em7", "F#m7", "Gmaj7", "A7", "Bm7", "C#m7b5"],
  },
  A: {
    root: 9,
    names: ["Amaj7", "Bm7", "C#m7", "Dmaj7", "E7", "F#m7", "G#m7b5"],
  },
  F: {
    root: 5,
    names: ["Fmaj7", "Gm7", "Am7", "Bbmaj7", "C7", "Dm7", "Em7b5"],
  },
  Bb: {
    root: 10,
    names: ["Bbmaj7", "Cm7", "Dm7", "Ebmaj7", "F7", "Gm7", "Am7b5"],
  },
};
const keyNotes: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  Bb: 10,
  B: 11,
};
const intervals: Record<string, number[]> = {
  C: [0, 4, 7, 11],
  Dm: [0, 3, 7, 10],
  Em: [0, 3, 7, 10],
  F: [0, 4, 7, 11],
  G: [0, 4, 7, 10],
  Am: [0, 3, 7, 10],
  Bdim: [0, 3, 6, 10],
  Bm: [0, 3, 7, 10],
  "F#m": [0, 3, 7, 10],
  A: [0, 4, 7, 10],
  D: [0, 4, 7, 10],
  E: [0, 4, 7, 10],
  Gm: [0, 3, 7, 10],
  Bb: [0, 4, 7, 10],
  Cm: [0, 3, 7, 10],
  Eb: [0, 4, 7, 10],
  "C#m": [0, 3, 7, 10],
  "C#dim": [0, 3, 6, 10],
  "G#dim": [0, 3, 6, 10],
  Edim: [0, 3, 6, 10],
  Adim: [0, 3, 6, 10],
  Cmaj7: [0, 4, 7, 11],
  Dm7: [0, 3, 7, 10],
  Em7: [0, 3, 7, 10],
  Am7: [0, 3, 7, 10],
  Bm7: [0, 3, 7, 10],
  Gmaj7: [0, 4, 7, 11],
  D7: [0, 4, 7, 10],
  Fmaj7: [0, 4, 7, 11],
  A7: [0, 4, 7, 10],
  Dmaj7: [0, 4, 7, 11],
  Amaj7: [0, 4, 7, 11],
  E7: [0, 4, 7, 10],
  Bbmaj7: [0, 4, 7, 11],
  C7: [0, 4, 7, 10],
  Ebmaj7: [0, 4, 7, 11],
  F7: [0, 4, 7, 10],
  Bm7b5: [0, 3, 6, 10],
  "F#m7b5": [0, 3, 6, 10],
  "C#m7b5": [0, 3, 6, 10],
  "G#m7b5": [0, 3, 6, 10],
  Em7b5: [0, 3, 6, 10],
  Am7b5: [0, 3, 6, 10],
};
for (const { names } of Object.values(keyData)) {
  for (const name of names) {
    if (chordCatalog[name]) continue;
    const root = keyNotes[name.replace(/(maj7|m7b5|m7|7|m|dim|m7b5)$/, "")];
    const base = root;
    chordCatalog[name] = (intervals[name] || [0, 3, 7, 10]).map(
      (i, idx) => (idx === 0 ? 48 : 60) + base + i,
    );
  }
}
export const keyChordMaps: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(keyData).map(([key, { names }]) => [
    key,
    Object.fromEntries(names.map((chord, i) => [`Key${"ZXCVBNM"[i]}`, chord])),
  ]),
);
const triadData: Record<string, string[]> = {
  C: ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
  G: ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
  D: ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
  A: ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
  F: ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
  Bb: ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "Adim"],
};
const triadIntervals: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
};
export const triadChordCatalog: Record<string, number[]> = {};
export const triadKeyChordMaps: Record<string, Record<string, string>> = {};
for (const [key, names] of Object.entries(triadData)) {
  triadKeyChordMaps[key] = Object.fromEntries(
    names.map((name, i) => [`Key${"ZXCVBNM"[i]}`, name]),
  );
  for (const name of names) {
    const chordRootName = name.replace(/(m|dim)$/, "");
    const chordRoot = keyNotes[chordRootName];
    const quality = name.endsWith("dim")
      ? "diminished"
      : name.endsWith("m")
        ? "minor"
        : "major";
    const degrees = triadIntervals[quality];
    triadChordCatalog[name] = [
      48 + chordRoot,
      ...degrees.map((interval) => 60 + chordRoot + interval),
    ];
  }
}

export const aChordMap: Record<string, string> = {
  KeyZ: "A",
  KeyX: "D",
  KeyC: "E",
  KeyV: "E7",
  KeyB: "F#m",
  KeyN: "B",
  KeyM: "B7",
};
export const cChordMap: Record<string, string> = {
  KeyZ: "C",
  KeyX: "Dm",
  KeyC: "Em",
  KeyV: "F",
  KeyB: "G",
  KeyN: "Am",
  KeyM: "G7",
};
export const functionChordMap: Record<string, string> = {
  F1: "C",
  F2: "Dm",
  F3: "Em",
  F4: "F",
  F5: "G",
  F6: "Am",
  F7: "G7",
  F8: "E7",
  F9: "A",
};
export const keyLabel = (code: string) =>
  code.replace("Key", "").replace("Digit", "");
export function validateChordBinding(
  code: string,
  current: Record<string, string>,
  target: string,
  pedal: string,
  _single: Record<string, number>,
) {
  if (!/^(Key[A-Z]|Digit[0-9]|F[1-9])$/.test(code))
    return "請選英文字母、數字或 F1–F9。";
  if (code === pedal) return "此鍵已綁定延音踏板。";
  if (current[code] && code !== target)
    return `${keyLabel(code)} 已綁定 ${current[code]}，請先解除該和弦綁定。`;
  return "";
}
