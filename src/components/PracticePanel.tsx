import { noteName } from "../music/model";
import type { AutoPolicy } from "../practice/handSplit";
import { PLAY_STYLES, PRACTICE_HANDS, type PlayStyle, type PracticeHand } from "../practice/playStyle";
import { StageSegmented, StageStepper } from "./StageControls";
import { StageSlider } from "./StageSlider";

const clock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/** The "練習" drawer section: how to play, which hand, tempo, looping and tracks. */
export function PracticePanel(props: {
  style: PlayStyle;
  onStyle: (style: PlayStyle) => void;
  hand: PracticeHand;
  multiTrack: boolean;
  onHand: (hand: PracticeHand) => void;
  splitPitch: number;
  onSplitPitch: (pitch: number) => void;
  tolerance: number;
  onTolerance: (seconds: number) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  transpose: number;
  onTranspose: (semitones: number) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  loop: boolean;
  onLoop: (loop: boolean) => void;
  loopA: number;
  loopB: number;
  onSetA: () => void;
  onSetB: () => void;
  loopSelectionArmed: boolean;
  onArmLoopSelection: () => void;
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  tracks: string[];
  muted: number[];
  onToggleTrack: (index: number) => void;
  autoPolicy: Record<number, AutoPolicy>;
  onPolicy: (track: number, policy: AutoPolicy) => void;
  feedback: { pitch?: [number, number]; window?: [number, number] };
  onLoopWindow: (start: number) => void;
  onRestart: () => void;
}) {
  const style = PLAY_STYLES.find((entry) => entry.value === props.style)!;
  const handMatters = props.style === "wait" || props.style === "rhythm";
  return (
    <div className="panel-grid">
      <section className="panel-card">
        <h3>怎麼彈</h3>
        <div className="style-choices" role="group" aria-label="演奏方式">
          {PLAY_STYLES.map((entry) => (
            <button key={entry.value} type="button" className="choice" aria-pressed={props.style === entry.value} onClick={() => props.onStyle(entry.value)}>
              <strong>{entry.label}</strong>
              <span>{entry.hint}</span>
            </button>
          ))}
        </div>
        {handMatters && (
          <div className="field-row">
            <span>練習的手</span>
            <StageSegmented<PracticeHand> label="練習的手" value={props.hand} options={PRACTICE_HANDS} onChange={props.onHand} />
          </div>
        )}
        {handMatters && props.multiTrack && (
          <p className="hint">多音軌曲目依音軌分手：第一軌是右手，其餘是左手。</p>
        )}
        {((handMatters && !props.multiTrack) || props.style === "follow") && (
          <div className="field-row">
            <span>分手音<small>左手含此音</small></span>
            <StageStepper label="分手音" value={props.splitPitch} min={36} max={84} step={1} onChange={props.onSplitPitch} format={noteName} />
          </div>
        )}
        {(props.style === "rhythm" || props.style === "follow") && (
          <div className="field-row">
            <span>節奏容許誤差</span>
            <StageSegmented label="節奏容許誤差" value={props.tolerance} options={[{ value: 0.1, label: "嚴格" }, { value: 0.2, label: "標準" }, { value: 0.3, label: "寬鬆" }]} onChange={props.onTolerance} />
          </div>
        )}
        <p className="hint">{style.hint}。</p>
        <button type="button" onClick={props.onRestart}>從頭再練一次</button>
      </section>

      <section className="panel-card">
        <h3>速度與音高</h3>
        <div className="field-row">
          <span>速度</span>
          <StageStepper label="速度倍率" value={props.speed} min={0.25} max={2} step={0.05} onChange={props.onSpeed} format={(n) => `${Math.round(n * 100)}%`} />
        </div>
        <div className="field-row">
          <span>轉調</span>
          <StageStepper label="轉調" value={props.transpose} min={-12} max={12} step={1} onChange={props.onTranspose} format={(n) => `${n > 0 ? "+" : ""}${n} 半音`} />
        </div>
        <label className="field">
          <span>音符下落速度</span>
          <StageSlider aria-label="音符下落速度" min={30} max={160} step={1} value={props.zoom} onChange={props.onZoom} />
        </label>
        <button type="button" className="toggle-row" aria-pressed={props.metronome} onClick={() => props.onMetronome(!props.metronome)}>
          <span>節拍器<small>跟著曲目的速度與拍號</small></span>
          <i aria-hidden="true" />
        </button>
      </section>

      <section className="panel-card">
        <h3>段落循環</h3>
        <button type="button" className="toggle-row" aria-pressed={props.loop} onClick={() => props.onLoop(!props.loop)}>
          <span>循環 A–B<small>{clock(props.loopA)} 到 {clock(props.loopB)}</small></span>
          <i aria-hidden="true" />
        </button>
        <div className="button-row">
          <button type="button" onClick={props.onSetA}>目前位置設為 A</button>
          <button type="button" onClick={props.onSetB}>目前位置設為 B</button>
          <button type="button" aria-pressed={props.loopSelectionArmed} onClick={props.onArmLoopSelection}>
            {props.loopSelectionArmed ? "在音符區拖曳選取…" : "在音符區拖曳選取"}
          </button>
        </div>
        {(props.feedback.pitch || props.feedback.window) && (
          <div className="feedback-card" aria-live="polite">
            <strong>下一步可以加強</strong>
            {props.feedback.pitch && <span>最常漏掉 {noteName(props.feedback.pitch[0])}（{props.feedback.pitch[1]} 次）</span>}
            {props.feedback.window && (
              <>
                <span>{clock(props.feedback.window[0])} 附近漏了 {props.feedback.window[1]} 個音</span>
                <button type="button" onClick={() => props.onLoopWindow(props.feedback.window![0])}>循環練習這段</button>
              </>
            )}
          </div>
        )}
      </section>

      {props.tracks.length > 0 && (
        <section className="panel-card">
          <h3>音軌</h3>
          <ul className="track-list">
            {props.tracks.map((track, index) => (
              <li key={`${track}-${index}`}>
                <label className="check-row">
                  <input type="checkbox" checked={!props.muted.includes(index)} onChange={() => props.onToggleTrack(index)} />
                  <span>{track}</span>
                </label>
                {props.style === "follow" && (
                  <StageSegmented<AutoPolicy>
                    label={`${track} 誰來彈`}
                    value={props.autoPolicy[index] || "manual"}
                    options={[
                      { value: "manual", label: "我彈" },
                      { value: "bass", label: "左手自動" },
                      { value: "treble", label: "右手自動" },
                      { value: "all", label: "全自動" },
                    ]}
                    onChange={(policy) => props.onPolicy(index, policy)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
