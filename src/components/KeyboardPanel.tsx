import { useSettings, type KeyLabelMode } from "../store";
import type { MidiCallbacks } from "../practice/webMidi";
import { StageSegmented, StageStepper } from "./StageControls";
import { StageSlider } from "./StageSlider";
import { WebMidiInput } from "./WebMidiInput";
import { VisualPreferences } from "./VisualPreferences";

/** The "鍵盤" drawer section: range, labels, input devices and readability. */
export function KeyboardPanel({
  onOpenMapping,
  onDown,
  onUp,
  onPedal,
}: {
  onOpenMapping: () => void;
  onDown: MidiCallbacks["onDown"];
  onUp: MidiCallbacks["onUp"];
  onPedal: MidiCallbacks["onPedal"];
}) {
  const settings = useSettings();
  return (
    <div className="panel-grid">
      <section className="panel-card">
        <h3>音域</h3>
        <div className="field-row">
          <span>琴鍵數</span>
          <StageSegmented label="琴鍵數" value={settings.keyCount} options={[{ value: 61, label: "61 鍵" }, { value: 88, label: "88 鍵" }]} onChange={(keyCount) => settings.set({ keyCount })} />
        </div>
        <div className="field-row">
          <span>電腦鍵盤八度</span>
          <StageStepper label="八度" value={settings.octave} min={-2} max={2} step={1} onChange={(octave) => settings.set({ octave })} format={(n) => (n > 0 ? `+${n}` : String(n))} />
        </div>
        <label className="field touch-only">
          <span>觸控琴鍵大小 <output>一次顯示 {settings.visibleWhiteKeys} 個白鍵</output></span>
          <StageSlider aria-label="一次顯示的白鍵數" min={10} max={28} step={1} value={settings.visibleWhiteKeys} onChange={(visibleWhiteKeys) => settings.set({ visibleWhiteKeys })} />
        </label>
        <button type="button" className="toggle-row touch-only" aria-pressed={settings.keyboardSwipeScroll} onClick={() => settings.set({ keyboardSwipeScroll: !settings.keyboardSwipeScroll })}>
          <span>滑動瀏覽音域<small>開啟時滑過琴鍵只會捲動，不會發聲</small></span>
          <i aria-hidden="true" />
        </button>
        <p className="hint">Page Up / Page Down 可移動電腦鍵盤的八度。</p>
      </section>
      <section className="panel-card">
        <h3>琴鍵標籤</h3>
        <StageSegmented<KeyLabelMode>
          label="琴鍵標籤"
          value={settings.keyLabels}
          options={[
            { value: "both", label: "按鍵＋音名" },
            { value: "letters", label: "只顯示按鍵" },
            { value: "notes", label: "只顯示音名" },
            { value: "none", label: "不顯示" },
          ]}
          onChange={(keyLabels) => settings.set({ keyLabels })}
        />
        <button type="button" onClick={onOpenMapping}>自訂電腦鍵盤對應…</button>
        <VisualPreferences />
      </section>
      <section className="panel-card">
        <h3>外接鍵盤</h3>
        <WebMidiInput onDown={onDown} onUp={onUp} onPedal={onPedal} />
      </section>
    </div>
  );
}
