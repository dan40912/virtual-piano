import { useSettings } from "../store";
import type { MidiCallbacks } from "../practice/webMidi";
import { StageSegmented } from "./StageControls";
import { StageSlider } from "./StageSlider";
import { WebMidiInput } from "./WebMidiInput";
import { InstrumentControls } from "./InstrumentControls";

export function SoundTools({
  rotate,
  hasMultipleTracks,
  onDown,
  onUp,
  onPedal,
  onPreview,
  onOpenKeyboard,
  onOpenAudio,
  onOpenTracks,
}: {
  rotate: boolean;
  hasMultipleTracks: boolean;
  onDown: MidiCallbacks["onDown"];
  onUp: MidiCallbacks["onUp"];
  onPedal: MidiCallbacks["onPedal"];
  onPreview: () => void;
  onOpenKeyboard: () => void;
  onOpenAudio: () => void;
  onOpenTracks: () => void;
}) {
  const settings = useSettings();
  return <div className="sound-tab-content">
    <WebMidiInput onDown={onDown} onUp={onUp} onPedal={onPedal} />
    <InstrumentControls onPreview={onPreview} />
    <div className="sound-tab-settings">
      <label>琴鍵數
        <StageSegmented label="琴鍵數" value={settings.keyCount} options={[{ value: 61, label: "61 鍵" }, { value: 88, label: "88 鍵" }]} onChange={(keyCount) => settings.set({ keyCount })} />
      </label>
      <label className="sound-volume-control">
        音量
        <StageSlider aria-label="音量" min={0} max={1} step={0.01} value={settings.volume} onChange={(volume) => settings.set({ volume })} rotate={rotate} />
        <span>{Math.round(settings.volume * 100)}%</span>
      </label>
      <button className="key-binding" onClick={onOpenKeyboard}>鍵盤設定</button>
      <button onClick={onOpenAudio}>音訊設定</button>
      {hasMultipleTracks && <button onClick={onOpenTracks}>音軌</button>}
    </div>
  </div>;
}
