import { useSettings } from "../store";

/** Controls for visual preferences applied by App's always-mounted preference hook. */
export function VisualPreferences() {
  const large = useSettings((s) => s.largeKeyLabels);
  const contrast = useSettings((s) => s.highContrast);
  const palette = useSettings((s) => s.notePalette);
  const set = useSettings((s) => s.set);
  return (
    <details className="visual-preferences">
      <summary>顯示與可讀性</summary>
      <div>
        <label><input type="checkbox" checked={large} onChange={(e) => set({ largeKeyLabels: e.target.checked })} />放大音名與按鍵標籤</label>
        <label><input type="checkbox" checked={contrast} onChange={(e) => set({ highContrast: e.target.checked })} />提高文字與控制項對比</label>
        <label><input type="checkbox" checked={palette === "accessible"} onChange={(e) => set({ notePalette: e.target.checked ? "accessible" : "gold" })} />清楚區分手彈與自動音符</label>
        <small>手彈音符會加外框與「手」標示，顏色以外也能辨認。</small>
      </div>
    </details>
  );
}
