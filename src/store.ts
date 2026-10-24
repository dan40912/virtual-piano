import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultMap, legacyMap } from "./music/model";
import { aChordMap } from "./music/chords";
import { completeMapping } from "./music/keyboard";
import type { PianoStyle } from "./audio/styles";
interface Settings {
  pianoStyle: PianoStyle;
  chordEnabled: boolean;
  chordMapping: Record<string, string>;
  chordLatch: boolean;
  mapping: Record<string, number>;
  profiles: Record<string, Record<string, number>>;
  pedal: string;
  volume: number;
  reverb: number;
  velocity: number;
  theme: string;
  keyCount: number;
  octave: number;
  visibleWhiteKeys: number;
  lidHintSeen: boolean;
  mobileScoreSplit: number;
  set: (s: Partial<Settings>) => void;
}
export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      mapping: defaultMap,
      pianoStyle: "natural",
      chordEnabled: false,
      chordMapping: aChordMap,
      chordLatch: false,
      profiles: {},
      pedal: "Space",
      volume: 0.7,
      reverb: 0.18,
      velocity: 0.75,
      theme: "dark",
      keyCount: 61,
      octave: 0,
      visibleWhiteKeys: 18,
      lidHintSeen: false,
      mobileScoreSplit: 0.55,
      set: (s) => set(s),
    }),
    {
      name: "piano-studio-settings-v1",
      version: 8,
      migrate: (state) => {
        const old = state as Partial<Settings>;
        const migrated = { ...old } as Partial<Settings> & {
          mobileLayout?: unknown;
        };
        delete migrated.mobileLayout;
        const simplifyMapping = (mapping?: Record<string, number>) => {
          if (!mapping) return defaultMap;
          const keys = Object.keys(mapping);
          const isPreviousDefault =
            keys.length === Object.keys(legacyMap).length &&
            Object.entries(legacyMap).every(([key, note]) => mapping[key] === note);
          if (isPreviousDefault) return defaultMap;
          // Earlier defaults assigned the full piano with Shift combinations.
          // Replace that generated layout instead of carrying its scattered keys forward.
          const wasGeneratedDefault =
            keys.length === 24 && mapping.KeyZ === 48 && mapping.KeyQ === 60 && mapping.KeyU === 71;
          if (keys.some((key) => key.startsWith("Shift+")) || wasGeneratedDefault)
            return defaultMap;
          return completeMapping(mapping);
        };
        return {
          ...migrated,
          mapping: simplifyMapping(old.mapping),
          visibleWhiteKeys:
            typeof old.visibleWhiteKeys === "number" &&
            old.visibleWhiteKeys >= 14 &&
            old.visibleWhiteKeys <= 28
              ? old.visibleWhiteKeys
              : 18,
          profiles: Object.fromEntries(
            Object.entries(old.profiles || {}).map(([name, mapping]) => [
              name,
              simplifyMapping(mapping),
            ]),
          ),
          pedal: old.pedal?.startsWith("Shift")
            ? "Space"
            : old.pedal || "Space",
          lidHintSeen: old.lidHintSeen === true,
          mobileScoreSplit:
            typeof old.mobileScoreSplit === "number" &&
            old.mobileScoreSplit >= 0.25 &&
            old.mobileScoreSplit <= 0.65
              ? old.mobileScoreSplit
              : 0.55,
        } as Settings;
      },
    },
  ),
);
