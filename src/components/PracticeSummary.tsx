import { X } from "lucide-react";
import { noteName } from "../music/model";

const clock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/** The result card shown when an exercise ends: one number first, then what to do next. */
export function PracticeSummary({
  accuracy,
  correct,
  wrong,
  missed,
  total,
  missedPitch,
  missedWindow,
  onLoopWindow,
  onRestart,
  onClose,
}: {
  accuracy: number;
  correct: number;
  wrong: number;
  missed: number;
  total: number;
  missedPitch?: [number, number];
  missedWindow?: [number, number];
  onLoopWindow: (start: number) => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const verdict = accuracy >= 90 ? "太棒了！" : accuracy >= 70 ? "很不錯，再一次會更穩。" : "慢慢來，先放慢速度練這段。";
  return (
    <div className="summary" role="dialog" aria-label="練習結果">
      <button type="button" className="icon-button summary-close" aria-label="關閉練習結果" onClick={onClose}>
        <X size={18} />
      </button>
      <p className="eyebrow">這次練習</p>
      <p className="summary-score"><strong>{accuracy}</strong><span>%</span></p>
      <p className="summary-verdict">{verdict}</p>
      <dl className="summary-stats">
        <div><dt>命中</dt><dd>{correct}{total ? ` / ${total}` : ""}</dd></div>
        <div><dt>錯按</dt><dd>{wrong}</dd></div>
        <div><dt>漏掉</dt><dd>{missed}</dd></div>
      </dl>
      {(missedPitch || missedWindow) && (
        <p className="summary-tip">
          {missedPitch && <>最常漏掉 {noteName(missedPitch[0])}。</>}
          {missedWindow && <>{clock(missedWindow[0])} 附近最需要加強。</>}
        </p>
      )}
      <div className="button-row">
        {missedWindow && <button type="button" className="primary" onClick={() => onLoopWindow(missedWindow[0])}>循環練習這段</button>}
        <button type="button" className={missedWindow ? "" : "primary"} onClick={onRestart}>從頭再來</button>
      </div>
    </div>
  );
}
