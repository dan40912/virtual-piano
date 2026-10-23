export type PianoStyle = "natural" | "soft" | "strong" | "bright";
export interface VoiceStyle {
  name: string;
  description: string;
  cutoff: number;
  attack: number;
  release: number;
  velocityScale: number;
  velocityCurve: number;
  reverb: number;
}
export const voiceStyles: Record<PianoStyle, VoiceStyle> = {
  natural: {
    name: "原聲",
    description: "保留鋼琴取樣的自然音色與尾韻",
    cutoff: 16000,
    attack: 0,
    release: 1,
    velocityScale: 1,
    velocityCurve: 1,
    reverb: 0.18,
  },
  soft: {
    name: "柔和",
    description: "溫暖暗色音質、柔和起音與較長殘響",
    cutoff: 2200,
    attack: 0.018,
    release: 1.8,
    velocityScale: 0.72,
    velocityCurve: 1.25,
    reverb: 0.36,
  },
  strong: {
    name: "剛強",
    description: "明亮有力、快速起音與飽滿力度",
    cutoff: 14000,
    attack: 0,
    release: 0.85,
    velocityScale: 1.25,
    velocityCurve: 0.8,
    reverb: 0.16,
  },
  bright: {
    name: "輕快",
    description: "短尾音、清晰顆粒與較乾淨的空間",
    cutoff: 8500,
    attack: 0.002,
    release: 0.22,
    velocityScale: 1.05,
    velocityCurve: 0.95,
    reverb: 0.06,
  },
};
export const styledVelocity = (value: number, style: PianoStyle) =>
  Math.max(
    0.02,
    Math.min(
      1,
      Math.pow(value, voiceStyles[style].velocityCurve) *
        voiceStyles[style].velocityScale,
    ),
  );
