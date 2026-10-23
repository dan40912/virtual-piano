import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultMap } from "./music/model";
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
      set: (s) => set(s),
    }),
    {
      name: "piano-studio-settings-v1",
      version: 2,
      migrate: (state) => {
        const old = state as Partial<Settings>;
        return {
          ...old,
          mapping: completeMapping(old.mapping || defaultMap),
          pedal: old.pedal?.startsWith("Shift")
            ? "Space"
            : old.pedal || "Space",
        } as Settings;
      },
    },
  ),
);
