import { useEffect } from "react";
import { useSettings } from "../store";

/** Applies persisted visual preferences independently of whether their controls are mounted. */
export function useVisualPreferences() {
  const large = useSettings((settings) => settings.largeKeyLabels);
  const contrast = useSettings((settings) => settings.highContrast);
  const palette = useSettings((settings) => settings.notePalette);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeKeyLabels = String(large);
    root.dataset.highContrast = String(contrast);
    root.dataset.notePalette = palette;
    return () => {
      delete root.dataset.largeKeyLabels;
      delete root.dataset.highContrast;
      delete root.dataset.notePalette;
    };
  }, [large, contrast, palette]);
}
