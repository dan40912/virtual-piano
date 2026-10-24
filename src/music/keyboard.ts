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
// Keep playing on ordinary keys. Change octaves with Page Up/Down instead.
export const keyboardBinding = (e: Pick<KeyboardEvent, "code" | "shiftKey">) =>
  e.code;
export const validShortcut = (code: string) => physicalCodes.includes(code);
export function completeMapping(
  existing: Record<string, number>,
): Record<string, number> {
  const map: Record<string, number> = {};
  const notes = new Set<number>();
  for (const [code, midi] of Object.entries(existing)) {
    if (!validShortcut(code) || !Number.isInteger(midi) || midi < 21 || midi > 108 || notes.has(midi)) continue;
    map[code] = midi;
    notes.add(midi);
  }
  return map;
}
