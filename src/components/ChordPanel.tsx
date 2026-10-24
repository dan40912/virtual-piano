import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings2 } from "lucide-react";
import { useSettings } from "../store";
import { StageSegmented } from "./StageControls";
import {
  aChordMap,
  cChordMap,
  chordCatalog,
  functionChordMap,
  keyLabel,
  validateChordBinding,
} from "../music/chords";
import { noteName } from "../music/model";
export function ChordPanel({
  onDown,
  onUp,
  blocked,
  resetKey,
}: {
  onDown: (id: string, n: number) => void;
  onUp: (id: string) => void;
  blocked: boolean;
  resetKey: number;
}) {
  const s = useSettings();
  const [buttonsSlot, setButtonsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setButtonsSlot(document.querySelector<HTMLElement>(".chord-buttons-slot"));
  }, []);
  const [edit, setEdit] = useState(false),
    [binding, setBinding] = useState<string | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [message, setMessage] = useState("可用滑鼠、觸控或鍵盤演奏和弦。"),
    [held, setHeld] = useState<string[]>([]);
  const downRef = useRef(onDown),
    upRef = useRef(onUp);
  downRef.current = onDown;
  upRef.current = onUp;
  const owners = useRef(new Map<string, { code: string; ids: string[] }>());
  const serial = useRef(0);
  const release = (owner: string) => {
    const entry = owners.current.get(owner);
    if (!entry) return;
    entry.ids.forEach((id) => upRef.current(id));
    owners.current.delete(owner);
    setHeld([...owners.current.values()].map((e) => e.code));
  };
  const allOff = () => {
    for (const key of [...owners.current.keys()]) release(key);
  };
  const attack = (owner: string, code: string) => {
    if (!s.chordEnabled || blocked || edit || binding) return;
    const notes = chordCatalog[s.chordMapping[code]];
    if (!notes) return;
    if (s.chordLatch) {
      const same = [...owners.current.values()].some((v) => v.code === code);
      allOff();
      if (same) return;
    } else if (owners.current.has(owner)) return;
    const entry = {
      code,
      ids: notes.map((_, i) => `chord:${serial.current++}:${i}`),
    };
    owners.current.set(owner, entry);
    setHeld([...owners.current.values()].map((e) => e.code));
    notes.forEach((n, i) => downRef.current(entry.ids[i], n));
  };
  const api = useRef({ attack, release, allOff });
  api.current = { attack, release, allOff };
  useEffect(() => {
    api.current.allOff();
  }, [s.chordEnabled, s.chordLatch, s.chordMapping, blocked, resetKey, edit]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (blocked) return;
      const target = e.target as HTMLElement;
      if (
        target.matches(
          'input:not([type="checkbox"]):not([type="range"]):not([type="radio"]),textarea,select',
        ) ||
        target.closest(".stage-slider, .stage-segmented, .stage-stepper") ||
        target.isContentEditable ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (binding) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code === "Escape") {
          setBinding(null);
          return;
        }
        if (e.repeat) return;
        const error = validateChordBinding(
          e.code,
          s.chordMapping,
          binding,
          s.pedal,
          s.mapping,
        );
        if (error) {
          setMessage(error);
          return;
        }
        const map = { ...s.chordMapping };
        const chord = map[binding];
        delete map[binding];
        map[e.code] = chord;
        s.set({ chordMapping: map });
        setBinding(null);
        setMessage(
          `${keyLabel(e.code)} → ${chord} 已儲存；和弦模式中優先，關閉後恢復單音。`,
        );
        return;
      }
      if (e.shiftKey || !s.chordEnabled || !s.chordMapping[e.code]) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) api.current.attack("key:" + e.code, e.code);
    };
    const keyup = (e: KeyboardEvent) => {
      if (!s.chordLatch) api.current.release("key:" + e.code);
    };
    const blur = () => api.current.allOff();
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      api.current.allOff();
    };
  }, [
    s.chordEnabled,
    s.chordMapping,
    s.chordLatch,
    s.pedal,
    s.mapping,
    binding,
    blocked,
  ]);
  const grid = (
      <div className="chord-grid">
        {Object.entries(s.chordMapping).map(([code, chord]) => (
          <div
            className={"chord-card " + (held.includes(code) ? "sounding" : "")}
            key={code}
          >
            {edit ? (
              <>
                <span className="chord-key">{keyLabel(code)}</span>
                <StageSegmented
                  label={`${keyLabel(code)} 和弦`}
                  className="chord-choice"
                  value={chord}
                  options={Object.keys(chordCatalog).map((c) => ({ value: c, label: c }))}
                  onChange={(next) =>
                    s.set({
                      chordMapping: {
                        ...s.chordMapping,
                        [code]: next,
                      },
                    })
                  }
                />
                <button
                  onClick={() => {
                    setBinding(code);
                    setMessage(`請按下要綁定 ${chord} 的實體按鍵…`);
                  }}
                >
                  {binding === code ? "等待按鍵…" : "改綁按鍵"}
                </button>
                <button
                  onClick={() => {
                    const m = { ...s.chordMapping };
                    delete m[code];
                    s.set({ chordMapping: m });
                    if (binding === code) setBinding(null);
                  }}
                >
                  解除
                </button>
              </>
            ) : (
              <button
                className="chord-pad"
                disabled={!s.chordEnabled || blocked}
                aria-label={`演奏 ${chord} 和弦，${keyLabel(code)} 鍵`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  api.current.attack("pointer:" + e.pointerId, code);
                }}
                onPointerUp={(e) => {
                  if (!s.chordLatch)
                    api.current.release("pointer:" + e.pointerId);
                }}
                onPointerCancel={(e) =>
                  api.current.release("pointer:" + e.pointerId)
                }
                onKeyDown={(e) => {
                  if ((e.code === "Enter" || e.code === "Space") && !e.repeat) {
                    e.preventDefault();
                    api.current.attack("accessible:" + code, code);
                  }
                }}
                onKeyUp={(e) => {
                  if (
                    !s.chordLatch &&
                    (e.code === "Enter" || e.code === "Space")
                  )
                    api.current.release("accessible:" + code);
                }}
              >
                <kbd>{keyLabel(code)}</kbd>
                <strong>{chord}</strong>
                <small>
                  {(chordCatalog[chord] || []).map(noteName).join(" · ")}
                </small>
              </button>
            )}
          </div>
        ))}
      </div>
  );
  return (
    <section className="chord-panel" aria-label="一鍵和弦">
      <div className="chord-heading">
        <div>
          <h3>
            一鍵和弦 <span className="tag">EASY PLAY</span>
          </h3>
          <p>點選和弦按鈕，或使用 F1–F9 快捷鍵演奏。</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={s.chordEnabled}
            onChange={(e) => s.set({ chordEnabled: e.target.checked })}
          />
          啟用
        </label>
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="chord-settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings2 size={14} />
          和弦設定
          <ChevronDown
            size={14}
            className={
              settingsOpen
                ? "chord-settings-chevron is-open"
                : "chord-settings-chevron"
            }
          />
        </button>
      </div>
      {settingsOpen && (
        <div className="chord-presets" id="chord-settings">
          <label>
            快速配置{" "}
            <StageSegmented
              label="和弦快速配置"
              value={
                JSON.stringify(s.chordMapping) === JSON.stringify(aChordMap)
                  ? "A"
              : JSON.stringify(s.chordMapping) === JSON.stringify(cChordMap)
                ? "C"
                : JSON.stringify(s.chordMapping) === JSON.stringify(functionChordMap)
                  ? "F"
                  : "custom"
              }
              options={[{ value: "A", label: "A 調常用" }, { value: "C", label: "C 調入門" }, { value: "F", label: "F1–F9 快捷鍵" }]}
              onChange={(next) => {
                s.set({
                  chordEnabled: true,
                  chordMapping:
                    next === "A"
                      ? { ...aChordMap }
                    : next === "C"
                      ? { ...cChordMap }
                      : { ...functionChordMap },
                });
                setBinding(null);
                setMessage(
                  next === "F"
                    ? "已啟用 F1–F9；直接按功能鍵即可演奏對應和弦。"
                    : "已套用常用和弦配置；這是演奏工具，沒有推測歌曲的和弦時間。",
                );
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.chordLatch}
              onChange={(e) => s.set({ chordLatch: e.target.checked })}
            />
            一按保持，換和弦時自動放開
          </label>
          <button
            className={edit ? "enabled" : ""}
            onClick={() => {
              setEdit(!edit);
              setBinding(null);
              setMessage("選擇和弦後按「改綁按鍵」，可使用字母、數字或 F1–F9。");
            }}
          >
            {edit ? "完成綁定" : "綁定模式"}
          </button>
          <button onClick={() => api.current.allOff()}>停止和弦</button>
        </div>
      )}
      {buttonsSlot ? createPortal(grid, buttonsSlot) : null}
      <div className="chord-panel-grid">{grid}</div>
      {edit && (
        <button
          onClick={() => {
            const code = Object.keys({
              ...Object.fromEntries(
                "ZXCVBNMQ1234567890"
                  .split("")
                  .map((c) => [/\d/.test(c) ? "Digit" + c : "Key" + c, true]),
              ),
              ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["F" + (i + 1), true])),
            }).find((c) => !s.chordMapping[c]);
            if (code)
              s.set({ chordMapping: { ...s.chordMapping, [code]: "C" } });
            else setMessage("請先解除一個綁定後再新增。");
          }}
        >
          ＋ 新增和弦鍵
        </button>
      )}
      <p className="chord-message" role="status">
        {message}
        {edit ? "（綁定模式中暫停和弦演奏）" : ""}
      </p>
    </section>
  );
}
