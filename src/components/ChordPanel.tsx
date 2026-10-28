import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
import { shouldIgnorePianoShortcut } from "../music/shortcutTarget";
import {
  ChordPerformance,
  type ChordFeel,
  type ChordVoicing,
} from "../audio/ChordPerformance";
import {
  keyChordMaps,
  triadChordCatalog,
  triadKeyChordMaps,
} from "../music/chords";
import type { ChordSettingsPrefs, ChordType } from "./ChordSettings";
import "./ChordPanel.css";
const LazyChordSettings = lazy(() =>
  import("./ChordSettings").then((module) => ({
    default: module.ChordSettings,
  })),
);
export function parseChordPerformancePrefs(raw: string | null) {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const isOneOf = <T extends string>(
      candidate: unknown,
      choices: T[],
    ): candidate is T => choices.includes(candidate as T);
    return {
      voicing: isOneOf(value.voicing, [
        "block",
        "arpeggio",
        "accompaniment",
      ] as ChordVoicing[])
        ? value.voicing
        : undefined,
      feel: isOneOf(value.feel, ["gentle", "bold", "bright"] as ChordFeel[])
        ? value.feel
        : undefined,
      key: isOneOf(value.key, Object.keys(keyChordMaps))
        ? value.key
        : undefined,
      chordType: isOneOf(value.chordType, ["triad", "seventh"] as ChordType[])
        ? value.chordType
        : undefined,
    };
  } catch {
    return {};
  }
}
export function ChordPanel({
  onDown,
  onUp,
  blocked,
  resetKey,
}: {
  onDown: (id: string, n: number, velocity?: number) => void;
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
    [settingsRequested, setSettingsRequested] = useState(false),
    [message, setMessage] = useState("可用滑鼠、觸控或鍵盤演奏和弦。"),
    [held, setHeld] = useState<string[]>([]);
  const readChordPrefs = () => {
    try {
      if (typeof localStorage === "undefined") return {};
      return parseChordPerformancePrefs(
        localStorage.getItem("virtual-piano-chord-performance"),
      );
    } catch {
      return {};
    }
  };
  const [prefs, setPrefs] = useState<ChordSettingsPrefs>(() => {
    const saved = readChordPrefs();
    return {
      voicing: saved.voicing ?? ("block" as ChordVoicing),
      feel: saved.feel ?? ("gentle" as ChordFeel),
      key: saved.key ?? "C",
      chordType: saved.chordType ?? ("triad" as ChordType),
    };
  });
  const savePrefs = (next: Partial<typeof prefs>) =>
    setPrefs((current) => {
      const updated = { ...current, ...next };
      try {
        localStorage.setItem(
          "virtual-piano-chord-performance",
          JSON.stringify(updated),
        );
      } catch {
        /* storage may be unavailable */
      }
      return updated;
    });
  const toggleSettings = () => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    if (next) setSettingsRequested(true);
  };
  const shortcutLabels = Object.keys(s.chordMapping).map(keyLabel);
  const activeKeyMaps =
    prefs.chordType === "triad" ? triadKeyChordMaps : keyChordMaps;
  const catalog =
    prefs.chordType === "triad" ? triadChordCatalog : chordCatalog;
  const legacyPreset = [aChordMap, cChordMap, functionChordMap].some(
    (map) => JSON.stringify(map) === JSON.stringify(s.chordMapping),
  );
  const configuredKey = Object.entries(activeKeyMaps).find(
    ([, map]) => JSON.stringify(map) === JSON.stringify(s.chordMapping),
  )?.[0];
  const configurationLabel = configuredKey
    ? `${configuredKey} 調${prefs.chordType === "triad" ? "三和弦" : "七和弦"}`
    : JSON.stringify(s.chordMapping) === JSON.stringify(aChordMap)
      ? "A 調常用"
      : JSON.stringify(s.chordMapping) === JSON.stringify(functionChordMap)
        ? "F1–F9 快捷鍵"
        : JSON.stringify(s.chordMapping) === JSON.stringify(cChordMap)
          ? "C 調入門"
          : "自訂配置";
  const voicingLabel =
    prefs.voicing === "block"
      ? "柱式，按住延音"
      : prefs.voicing === "arpeggio"
        ? "分解和弦循環，放開立即停止"
        : "節奏伴奏循環，放開立即停止";
  const downRef = useRef(onDown),
    upRef = useRef(onUp);
  downRef.current = onDown;
  upRef.current = onUp;
  const owners = useRef(new Map<string, { code: string; ids: string[] }>());
  const performance = useRef<ChordPerformance | null>(null);
  if (!performance.current)
    performance.current = new ChordPerformance(
      (id, midi, velocity) => downRef.current(id, midi, velocity),
      (id) => upRef.current(id),
    );
  const release = (owner: string) => {
    const entry = owners.current.get(owner);
    if (!entry) return;
    performance.current?.release(owner);
    owners.current.delete(owner);
    setHeld([...owners.current.values()].map((e) => e.code));
  };
  const allOff = () => {
    performance.current?.stop();
    owners.current.clear();
    setHeld([]);
  };
  const attack = (owner: string, code: string) => {
    if (!s.chordEnabled || blocked || edit || binding) return;
    performance.current?.release("progression");
    const notes = legacyPreset
      ? chordCatalog[s.chordMapping[code]]
      : catalog[s.chordMapping[code]] || chordCatalog[s.chordMapping[code]];
    if (!notes) return;
    if (s.chordLatch) {
      const same = [...owners.current.values()].some((v) => v.code === code);
      allOff();
      if (same) return;
    } else if (owners.current.has(owner)) return;
    const entry = {
      code,
      ids: [],
    };
    owners.current.set(owner, entry);
    setHeld([...owners.current.values()].map((e) => e.code));
    performance.current?.start(owner, notes, prefs.voicing, prefs.feel);
  };
  const api = useRef({ attack, release, allOff });
  api.current = { attack, release, allOff };
  useEffect(() => {
    api.current.allOff();
  }, [
    s.chordEnabled,
    s.chordLatch,
    s.chordMapping,
    blocked,
    resetKey,
    edit,
    prefs.voicing,
    prefs.feel,
    prefs.chordType,
  ]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (blocked) return;
      if (
        shouldIgnorePianoShortcut(e.target, e.key) ||
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
                options={Object.keys({
                  ...triadChordCatalog,
                  ...chordCatalog,
                }).map((c) => ({ value: c, label: c }))}
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
                if (!s.chordLatch && (e.code === "Enter" || e.code === "Space"))
                  api.current.release("accessible:" + code);
              }}
            >
              <kbd>{keyLabel(code)}</kbd>
              <strong>{chord}</strong>
              <small>
                {(
                  (legacyPreset ? chordCatalog[chord] : catalog[chord]) ||
                  chordCatalog[chord] ||
                  []
                )
                  .map(noteName)
                  .join(" · ")}
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
          <p>
            點選按鈕或按{" "}
            {shortcutLabels.length ? shortcutLabels.join("、") : "已設定的按鍵"}{" "}
            演奏和弦。
            {s.chordEnabled
              ? "和弦快捷鍵優先於同名單音鍵。"
              : "下方可先預覽目前配置；開啟後即可演奏和使用快捷鍵。"}
            <span className="chord-current-config">
              目前：{configurationLabel} · {voicingLabel} ·{" "}
              {prefs.feel === "gentle"
                ? "柔和"
                : prefs.feel === "bold"
                  ? "剛強"
                  : "輕快"}
            </span>
          </p>
        </div>
        <button
          type="button"
          className={
            s.chordEnabled ? "chord-toggle is-enabled" : "chord-toggle"
          }
          aria-pressed={s.chordEnabled}
          onClick={() => s.set({ chordEnabled: !s.chordEnabled })}
        >
          {s.chordEnabled ? "一鍵和弦已開啟" : "開啟一鍵和弦"}
        </button>
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="chord-settings"
          onClick={toggleSettings}
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
      {settingsRequested && (
        <div id="chord-settings" hidden={!settingsOpen}>
          <Suspense
            fallback={
              <div className="chord-presets" role="status">
                正在載入和弦設定…
              </div>
            }
          >
            <LazyChordSettings
              edit={edit}
              prefs={prefs}
              performance={performance.current!}
              onSavePrefs={savePrefs}
              onMessage={setMessage}
              onClearBinding={() => setBinding(null)}
              onToggleBindingMode={() => {
                setEdit(!edit);
                setBinding(null);
                setMessage(
                  "選擇和弦後按「改綁按鍵」，可使用字母、數字或 F1–F9。",
                );
              }}
              onStop={() => api.current.allOff()}
            />
          </Suspense>
        </div>
      )}
      {buttonsSlot ? createPortal(grid, buttonsSlot) : null}
      <div
        className={
          s.chordEnabled ? "chord-panel-grid" : "chord-panel-grid is-preview"
        }
        aria-label={s.chordEnabled ? "和弦按鍵" : "和弦預覽，啟用後可演奏"}
      >
        {grid}
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
              ...Object.fromEntries(
                Array.from({ length: 9 }, (_, i) => ["F" + (i + 1), true]),
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
