const symbols: Record<string, string> = {
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Minus: "−",
  Equal: "=",
  Backquote: "`",
  BracketLeft: "[",
  BracketRight: "]",
};
export const physicalCodes = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
  .map((c) => "Key" + c)
  .concat(
    [..."1234567890"].map((c) => "Digit" + c),
    Object.keys(symbols),
  );
export const shortcutLabel = (code: string): string =>
  code.startsWith("Shift+")
    ? "⇧" + shortcutLabel(code.slice(6))
    : symbols[code] || code.replace(/^Key|^Digit/, "");
export const keyboardBinding = (e: Pick<KeyboardEvent, "code" | "shiftKey">) =>
  e.shiftKey ? "Shift+" + e.code : e.code;
export const validShortcut = (code: string) =>
  physicalCodes.includes(code.replace(/^Shift\+/, ""));
export function completeMapping(
  existing: Record<string, number>,
): Record<string, number> {
  const map = { ...existing };
  const notes = new Set(Object.values(map));
  const available = [
    ...physicalCodes,
    ...physicalCodes.map((c) => "Shift+" + c),
  ];
  for (let midi = 21; midi <= 108; midi++) {
    if (notes.has(midi)) continue;
    const key = available.find((c) => map[c] === undefined);
    if (!key) break;
    map[key] = midi;
    notes.add(midi);
  }
  return map;
}
