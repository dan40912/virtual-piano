import { useSettings } from "../store";
import { voiceStyles, type PianoStyle } from "../audio/styles";
export function InstrumentControls({ onPreview }: { onPreview: () => void }) {
  const s = useSettings();
  return (
    <section className="instrument-controls" aria-label="演奏方式與聲音風格">
      <div className="instrument-controls-top">
        <div>
          <span className="eyebrow">PLAY IT YOUR WAY</span>
          <h2>同一首歌，彈出你的表情。</h2>
        </div>
        <div className="segmented">
          <button
            className={!s.chordEnabled ? "selected" : ""}
            onClick={() => s.set({ chordEnabled: false })}
          >
            全鍵盤演奏
          </button>
          <button
            className={s.chordEnabled ? "selected" : ""}
            onClick={() => s.set({ chordEnabled: true })}
          >
            一鍵和弦伴奏
          </button>
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
      <p>
        88 鍵已預設快捷鍵 · 琴鍵標示 ⇧ 代表 Shift ·{" "}
        {s.chordEnabled
          ? "和弦鍵優先，⇧ 組合鍵仍可彈單音"
          : "每個快捷鍵對應一個音符"}
        。風格會即時改變濾波、起音、尾音、力度與殘響，手動演奏和 MIDI 都適用。
      </p>
      <p className="voice-source">
        音源：同一組真實鋼琴取樣，搭配不同聲音處理；沒有使用或宣稱特定品牌鋼琴。
      </p>
    </section>
  );
}
