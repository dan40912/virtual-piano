import { useSettings } from "../store";
import { voiceStyles, type PianoStyle } from "../audio/styles";
export function InstrumentControls({ onPreview }: { onPreview: () => void }) {
  const s = useSettings();
  return (
    <section className="panel-card instrument-controls" aria-label="聲音風格">
      <div className="panel-card-head">
        <h3>聲音風格</h3>
        <button type="button" className="quiet" onClick={onPreview}>♫ 試聽</button>
      </div>
      <div className="voice-choices">
        {(Object.entries(voiceStyles) as [PianoStyle, typeof voiceStyles.natural][]).map(([id, preset]) => (
          <button
            key={id}
            type="button"
            className="choice"
            aria-pressed={s.pianoStyle === id}
            onClick={() => s.set({ pianoStyle: id, reverb: preset.reverb })}
          >
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
      <p className="hint">同一組 Salamander 真實鋼琴取樣，以濾波、力度、起音、尾音與殘響呈現不同風格；即時套用於手彈與 MIDI。</p>
    </section>
  );
}
