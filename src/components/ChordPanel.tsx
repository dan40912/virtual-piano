import { useEffect, useRef, useState } from "react";
import { useSettings } from "../store";
import {
  aChordMap,
  cChordMap,
  chordCatalog,
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
  const [edit, setEdit] = useState(false),
    [binding, setBinding] = useState<string | null>(null),
    [message, setMessage] = useState("按一個鍵，整組和弦自動彈出。"),
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
  return (
    <section className="chord-panel" aria-label="一鍵和弦">
      <div className="chord-heading">
        <div>
          <h3>
            一鍵和弦 <span className="tag">EASY PLAY</span>
          </h3>
          <p>左手只按一個鍵，自動彈出低音與和弦；右手仍可用 A–L 彈旋律。</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={s.chordEnabled}
            onChange={(e) => s.set({ chordEnabled: e.target.checked })}
          />
          和弦快捷鍵優先
        </label>
        <button
          className={edit ? "enabled" : ""}
          onClick={() => {
            setEdit(!edit);
            setBinding(null);
            setMessage("選擇和弦後按「改綁按鍵」，再按你習慣的字母或數字。");
          }}
        >
          {edit ? "完成綁定" : "綁定模式"}
        </button>
      </div>
      <div className="chord-presets">
        <label>
          快速配置{" "}
          <select
            aria-label="和弦快速配置"
            value={
              JSON.stringify(s.chordMapping) === JSON.stringify(aChordMap)
                ? "A"
                : JSON.stringify(s.chordMapping) === JSON.stringify(cChordMap)
                  ? "C"
                  : "custom"
            }
            onChange={(e) => {
              s.set({
                chordMapping:
                  e.target.value === "A" ? { ...aChordMap } : { ...cChordMap },
              });
              setBinding(null);
              setMessage(
                "已套用常用和弦配置；這是演奏工具，沒有推測歌曲的和弦時間。",
              );
            }}
          >
            <option value="custom" disabled>
              自訂配置
            </option>
            <option value="A">A 調常用 · A / D / E7 / F♯m</option>
            <option value="C">C 調入門 · C / Dm / F / G / Am</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={s.chordLatch}
            onChange={(e) => s.set({ chordLatch: e.target.checked })}
          />
          一按保持，換和弦時自動放開
        </label>
        <button onClick={() => api.current.allOff()}>停止和弦</button>
      </div>
      <div className="chord-grid">
        {Object.entries(s.chordMapping).map(([code, chord]) => (
          <div
            className={"chord-card " + (held.includes(code) ? "sounding" : "")}
            key={code}
          >
            {edit ? (
              <>
                <span className="chord-key">{keyLabel(code)}</span>
                <select
                  aria-label={`${keyLabel(code)} 和弦`}
                  value={chord}
                  onChange={(e) =>
                    s.set({
                      chordMapping: {
                        ...s.chordMapping,
                        [code]: e.target.value,
                      },
                    })
                  }
                >
                  {Object.keys(chordCatalog).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
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
      {edit && (
        <button
          onClick={() => {
            const code = Object.keys({
              ...Object.fromEntries(
                "ZXCVBNMQ1234567890"
                  .split("")
                  .map((c) => [/\d/.test(c) ? "Digit" + c : "Key" + c, true]),
              ),
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
