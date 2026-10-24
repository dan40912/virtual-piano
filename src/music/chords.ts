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
  single: Record<string, number>,
) {
  if (!/^(Key[A-Z]|Digit[0-9]|F[1-9])$/.test(code)) return "請選英文字母、數字或 F1–F9。";
  if (code === pedal) return "此鍵已綁定延音踏板。";
  // Chord and single-note shortcuts are separate modes; sharing is intentional.
  if (current[code] && code !== target)
    return `${keyLabel(code)} 已綁定 ${current[code]}，請先解除該和弦綁定。`;
  return "";
}
