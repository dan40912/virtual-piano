import { useSettings } from "../store";
import { InstrumentControls } from "./InstrumentControls";
import { StageSlider } from "./StageSlider";

/** The "聲音" drawer section: voice, levels, sustain and audio recovery. */
export function SoundTools({
  audioState,
  pedal,
  manualTranspose,
  onPreview,
  onPedalToggle,
  onManualTransposeChange,
  onRetryAudio,
  onPanic,
}: {
  audioState: string;
  pedal: boolean;
  manualTranspose: boolean;
  onPreview: () => void;
  onPedalToggle: () => void;
  onManualTransposeChange: (enabled: boolean) => void;
  onRetryAudio: () => void;
  onPanic: () => void;
}) {
  const settings = useSettings();
  return (
    <div className="panel-grid">
      <InstrumentControls onPreview={onPreview} />
      <section className="panel-card">
        <h3>音量與空間</h3>
        <label className="field">
          <span>音量 <output>{Math.round(settings.volume * 100)}%</output></span>
          <StageSlider aria-label="音量" min={0} max={1} step={0.01} value={settings.volume} onChange={(volume) => settings.set({ volume })} />
        </label>
        <label className="field">
          <span>殘響 <output>{Math.round(settings.reverb * 100)}%</output></span>
          <StageSlider aria-label="殘響" min={0} max={0.8} step={0.01} value={settings.reverb} onChange={(reverb) => settings.set({ reverb })} />
        </label>
        <label className="field">
          <span>觸鍵力度 <output>{Math.round(settings.velocity * 100)}%</output></span>
          <StageSlider aria-label="演奏力度" min={0.1} max={1} step={0.01} value={settings.velocity} onChange={(velocity) => settings.set({ velocity })} />
        </label>
        <p className="hint">電腦鍵盤沒有力度感應，這裡設定固定力度；MIDI 鍵盤會使用實際力度。</p>
      </section>
      <section className="panel-card">
        <h3>踏板與音源</h3>
        <button type="button" className="toggle-row" aria-pressed={pedal} onClick={onPedalToggle}>
          <span>延音踏板<small>{settings.pedal === "Space" ? "空白鍵" : settings.pedal} 也可以踩</small></span>
          <i aria-hidden="true" />
        </button>
        <label className="check-row">
          <input type="checkbox" checked={manualTranspose} onChange={(event) => onManualTransposeChange(event.target.checked)} />
          <span>手彈也套用轉調<small>開啟後，你彈的音會跟著曲目一起移調</small></span>
        </label>
        <p className="status-line" role="status">{audioState}</p>
        <div className="button-row">
          <button type="button" onClick={onRetryAudio}>重新載入音源</button>
          <button type="button" className="quiet" onClick={onPanic}>停止所有聲音</button>
        </div>
      </section>
    </div>
  );
}
