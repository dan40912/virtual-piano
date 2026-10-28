import { Download } from "lucide-react";
import { noteName } from "../music/model";
import { shortcutLabel } from "../music/keyboard";
import { StageSegmented } from "./StageControls";

export type BindingConflict = { code: string; midi: number; occupied: number } | null;

export function KeyboardMappingPanel({
  mapping,
  profiles,
  pedal,
  selected,
  pendingBinding,
  bindingConflict,
  warning,
  profile,
  onSelectMappingNote,
  onBindShortcut,
  onCancelConflict,
  onCancelPending,
  onClearSelected,
  onRestoreDefaults,
  onExport,
  onImport,
  onPedalChange,
  onProfileChange,
  onSaveProfile,
  onLoadProfile,
}: {
  mapping: Record<string, number>;
  profiles: Record<string, Record<string, number>>;
  pedal: string;
  selected: number | null;
  pendingBinding: string | null;
  bindingConflict: BindingConflict;
  warning: string;
  profile: string;
  onSelectMappingNote: (midi: number) => void;
  onBindShortcut: (code: string, midi: number, replace?: boolean) => void;
  onCancelConflict: () => void;
  onCancelPending: () => void;
  onClearSelected: () => void;
  onRestoreDefaults: () => void;
  onExport: () => void;
  onImport: () => void;
  onPedalChange: (pedal: string) => void;
  onProfileChange: (profile: string) => void;
  onSaveProfile: (profile: string) => void;
  onLoadProfile: (profile: string) => void;
}) {
  return <>
    <div className={`mapping-guide ${pendingBinding || selected !== null ? "is-active" : ""}`} role="status">
      <strong>
        {bindingConflict
          ? "這個按鍵已經有用途"
          : pendingBinding
            ? `正在設定 ${shortcutLabel(pendingBinding)}`
            : selected !== null
              ? `正在設定 ${noteName(selected)}`
              : "快速綁定"}
      </strong>
      <span>
        {bindingConflict
          ? `${shortcutLabel(bindingConflict.code)} 目前控制 ${noteName(bindingConflict.occupied)}，要改綁到 ${noteName(bindingConflict.midi)} 嗎？`
          : pendingBinding
            ? "點選下方要綁定的音符。按 Esc 可取消。"
            : selected !== null
              ? "現在按下電腦鍵盤上的按鍵即可完成；按 Esc 可取消。"
              : "兩種方式都可以：按一個未綁定的電腦鍵，再點音符；或先點下方音符，再按電腦鍵。"}
      </span>
      {bindingConflict && <div className="mapping-conflict-actions">
        <button type="button" className="primary" onClick={() => onBindShortcut(bindingConflict.code, bindingConflict.midi, true)}>
          取代並綁定
        </button>
        <button type="button" onClick={onCancelConflict}>保留原設定</button>
      </div>}
    </div>
    <div className="mapping-grid">
      {Array.from({ length: 88 }, (_, i) => i + 21).map((midi) => {
        const key = Object.entries(mapping).find(([, value]) => value === midi)?.[0];
        return <button
          key={midi}
          className={selected === midi ? "selected" : ""}
          aria-pressed={selected === midi}
          aria-label={`${noteName(midi)}，${key ? `已綁定 ${shortcutLabel(key)}` : "尚未綁定"}`}
          onClick={() => onSelectMappingNote(midi)}
        >
          {noteName(midi)}
          <small>{key ? shortcutLabel(key) : "—"}</small>
        </button>;
      })}
    </div>
    <p className="mapping-status" role="status" aria-live="polite">{warning}</p>
    <div className="modal-actions">
      <button onClick={onClearSelected}>解除選取</button>
      {pendingBinding && <button onClick={onCancelPending}>取消快速綁定</button>}
      <button onClick={onRestoreDefaults}>恢復預設</button>
      <button onClick={onExport}><Download size={13} />匯出 JSON</button>
      <button onClick={onImport}>匯入 JSON</button>
    </div>
    <label>
      踏板按鍵{" "}
      <StageSegmented label="踏板按鍵" value={pedal} options={[{ value: "Space", label: "Space" }, { value: "ControlRight", label: "Control" }]} onChange={onPedalChange} />
    </label>
    <div className="profile">
      <input aria-label="配置名稱" value={profile} onChange={(event) => onProfileChange(event.target.value)} />
      <button onClick={() => onSaveProfile(profile)}>儲存配置</button>
      <StageSegmented
        label="載入配置"
        value=""
        options={Object.keys(profiles).map((key) => ({ value: key, label: key }))}
        onChange={onLoadProfile}
      />
    </div>
  </>;
}
