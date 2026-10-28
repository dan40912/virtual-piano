import { useSettings } from "../store";
import { voiceStyles, type PianoStyle } from "../audio/styles";
import { VisualPreferences } from "./VisualPreferences";
export function InstrumentControls({ onPreview }: { onPreview: () => void }) {
  const s = useSettings();
  return (
    <section className="instrument-controls" aria-label="演奏方式與聲音風格">
      <div className="instrument-controls-top">
        <div>
          <span className="eyebrow">PLAY IT YOUR WAY</span>
          <h2>同一首歌，彈出你的表情。</h2>
        </div>
      </div>
      <button className="voice-preview" onClick={onPreview}>
        ♫ 試聽目前風格 · 同一組和弦比較
      </button>
      <div className="voice-choices">
        {(
          Object.entries(voiceStyles) as [
            PianoStyle,
            typeof voiceStyles.natural,
          ][]
        ).map(([id, preset]) => (
          <button
            key={id}
            className={s.pianoStyle === id ? "selected" : ""}
            aria-pressed={s.pianoStyle === id}
            onClick={() => s.set({ pianoStyle: id, reverb: preset.reverb })}
          >
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
      <p>風格即時套用於手動演奏與 MIDI。</p>
      <VisualPreferences />
      <details className="visual-preferences">
        <summary>音色與快捷鍵說明</summary>
        <p>預設中央 16 個半音不需要 Shift；Page Up / Down 可移動八度。一鍵和弦請到「和弦」分頁設定。</p>
        <p className="voice-source">音源：同一組 Salamander 真實鋼琴取樣，以濾波、力度、起音、尾音與殘響呈現不同風格。</p>
      </details>
    </section>
  );
}
