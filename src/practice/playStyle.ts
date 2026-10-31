/**
 * One choice the player understands ("how do you want to play?") mapped onto
 * the engine's mode + practice type pair.
 */
export type PlayStyle = "listen" | "follow" | "wait" | "rhythm";
export type PracticeHand = "right" | "left" | "both";

export const PLAY_STYLES: { value: PlayStyle; label: string; hint: string }[] = [
  { value: "listen", label: "聆聽", hint: "整首自動演奏，先熟悉旋律" },
  { value: "wait", label: "逐音", hint: "按對亮起的琴鍵才前進，不趕時間" },
  { value: "follow", label: "跟彈", hint: "伴奏自動播放，你彈另一手並計分" },
  { value: "rhythm", label: "挑戰", hint: "伴奏靜音，跟著節奏彈出每個音" },
];

export const PRACTICE_HANDS: { value: PracticeHand; label: string }[] = [
  { value: "right", label: "右手" },
  { value: "left", label: "左手" },
  { value: "both", label: "雙手" },
];

export function styleModes(style: PlayStyle) {
  if (style === "listen") return { mode: "auto", practiceType: "rhythm" } as const;
  if (style === "follow") return { mode: "accompaniment", practiceType: "rhythm" } as const;
  return { mode: "practice", practiceType: style } as const;
}

export function playStyleOf(mode: string, practiceType: string): PlayStyle {
  if (mode === "auto") return "listen";
  if (mode === "accompaniment") return "follow";
  return practiceType === "wait" ? "wait" : "rhythm";
}

/** Notes at or below the split pitch belong to the left hand, matching handSplit's "bass" policy. */
export function inPracticeHand(hand: PracticeHand, soundingPitch: number, splitPitch: number) {
  if (hand === "both") return true;
  return hand === "left" ? soundingPitch <= splitPitch : soundingPitch > splitPitch;
}

/**
 * Which hand a note belongs to. Songs with several tracks split by track (the
 * first track is the right hand, as follow mode assumes); single-track songs
 * split by pitch.
 */
export function noteInHand(
  hand: PracticeHand,
  note: { midi: number; trackId: number },
  splitPitch: number,
  transpose: number,
  multiTrack: boolean,
) {
  if (hand === "both") return true;
  if (multiTrack) return hand === "right" ? note.trackId === 0 : note.trackId !== 0;
  return inPracticeHand(hand, note.midi + transpose, splitPitch);
}

/**
 * Practise the right hand by default, unless the song barely uses one side of
 * the split (a melody only, or a bass line only); then ask for every note.
 * A melody that dips to the split note is still one hand, so the left hand
 * only counts notes a fourth or more below the split.
 */
export function defaultHand(
  notes: { midi: number; trackId?: number }[],
  splitPitch: number,
  transpose = 0,
): PracticeHand {
  if (!notes.length) return "both";
  if (new Set(notes.map((n) => n.trackId ?? 0)).size > 1) return "right";
  const left = notes.filter((n) => n.midi + transpose <= splitPitch - 5).length;
  const right = notes.filter((n) => n.midi + transpose > splitPitch).length;
  return Math.min(left, right) / notes.length < 0.15 ? "both" : "right";
}

/** Accuracy counts wrong presses and missed notes against hits, as a whole percent. */
export function accuracy(correct: number, wrong: number, missed: number) {
  const attempts = correct + wrong + missed;
  return attempts ? Math.round((correct / attempts) * 100) : 0;
}
