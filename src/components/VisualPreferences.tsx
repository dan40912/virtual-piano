import { useSettings } from "../store";

/** Readability toggles applied by App's always-mounted preference hook. */
export function VisualPreferences() {
  const large = useSettings((s) => s.largeKeyLabels);
  const contrast = useSettings((s) => s.highContrast);
  const palette = useSettings((s) => s.notePalette);
  const set = useSettings((s) => s.set);
  return (
    <div className="visual-preferences">
      <label className="check-row"><input type="checkbox" checked={large} onChange={(e) => set({ largeKeyLabels: e.target.checked })} /><span>放大琴鍵標籤</span></label>
      <label className="check-row"><input type="checkbox" checked={contrast} onChange={(e) => set({ highContrast: e.target.checked })} /><span>提高文字與控制項對比</span></label>
      <label className="check-row"><input type="checkbox" checked={palette === "accessible"} onChange={(e) => set({ notePalette: e.target.checked ? "accessible" : "gold" })} /><span>色弱友善配色<small>手彈音符改為藍色並加外框，不只靠顏色辨認</small></span></label>
    </div>
  );
}
