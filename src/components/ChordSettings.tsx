import { StageSegmented } from "./StageControls";
import {
  aChordMap,
  cChordMap,
  chordCatalog,
  functionChordMap,
  keyChordMaps,
  triadChordCatalog,
  triadKeyChordMaps,
} from "../music/chords";
import {
  type ChordFeel,
  ChordPerformance,
  type ChordVoicing,
} from "../audio/ChordPerformance";
import { useSettings } from "../store";

export type ChordType = "triad" | "seventh";
export type ChordSettingsPrefs = {
  voicing: ChordVoicing;
  feel: ChordFeel;
  key: string;
  chordType: ChordType;
};

type Props = {
  edit: boolean;
  prefs: ChordSettingsPrefs;
  performance: ChordPerformance;
  onSavePrefs: (next: Partial<ChordSettingsPrefs>) => void;
  onMessage: (message: string) => void;
  onClearBinding: () => void;
  onToggleBindingMode: () => void;
  onStop: () => void;
};

export function ChordSettings({
  edit,
  prefs,
  performance,
  onSavePrefs,
  onMessage,
  onClearBinding,
  onToggleBindingMode,
  onStop,
}: Props) {
  const s = useSettings();
  const activeKeyMaps =
    prefs.chordType === "triad" ? triadKeyChordMaps : keyChordMaps;
  const catalog =
    prefs.chordType === "triad" ? triadChordCatalog : chordCatalog;
  const preset = JSON.stringify(s.chordMapping) === JSON.stringify(aChordMap)
    ? "A"
    : JSON.stringify(s.chordMapping) === JSON.stringify(functionChordMap)
      ? "F"
      : JSON.stringify(s.chordMapping) === JSON.stringify(cChordMap)
        ? "C"
        : "key";
  const applyPreset = (next: "A" | "C" | "F" | "key") => {
    s.set({
      chordEnabled: true,
      chordMapping:
        next === "A"
          ? { ...aChordMap }
          : next === "C"
            ? { ...cChordMap }
            : next === "F"
              ? { ...functionChordMap }
              : { ...activeKeyMaps[prefs.key] },
    });
    onClearBinding();
    onMessage(
      next === "F"
        ? "已啟用 F1–F9；直接按功能鍵即可演奏對應和弦。"
        : next === "key"
          ? `已套用 ${prefs.key} 調級數和弦。`
          : "已套用常用和弦配置。",
    );
  };
  const selectKey = (key: string) => {
    onSavePrefs({ key });
    s.set({ chordEnabled: true, chordMapping: { ...activeKeyMaps[key] } });
    onMessage(
      `已切換 ${key} 調${prefs.chordType === "triad" ? "三和弦" : "七和弦"}：Z–M 對應 I、ii、iii、IV、V、vi、vii°。`,
    );
  };
  const selectChordType = (chordType: ChordType) => {
    onSavePrefs({ chordType });
    const maps = chordType === "triad" ? triadKeyChordMaps : keyChordMaps;
    s.set({ chordEnabled: true, chordMapping: { ...maps[prefs.key] } });
    onMessage(
      chordType === "triad"
        ? "已切換三和弦配置；C 調進行可直接演奏 C–G–Am–F。"
        : "已切換七和弦配置；級數和弦標示包含七音。",
    );
  };
  const playProgression = () => {
    const map = activeKeyMaps[prefs.key];
    const progressionNames = [map.KeyZ, map.KeyB, map.KeyN, map.KeyV];
    const chords = progressionNames.map(
      (name) => catalog[name] || chordCatalog[name] || [],
    );
    onStop();
    performance.playProgression("progression", chords, prefs.feel);
    onMessage(
      `${prefs.key} 調 ${progressionNames.join("–")} 進行播放中；按停止即可結束。`,
    );
  };

  return (
    <div className="chord-presets">
      <label>
        快速配置{" "}
        <StageSegmented
          label="和弦快速配置"
          value={preset}
          options={[
            { value: "A", label: "A 調常用" },
            { value: "C", label: "C 調入門" },
            { value: "F", label: "F1–F9 快捷鍵" },
            { value: "key", label: "目前調性" },
          ]}
          onChange={applyPreset}
        />
      </label>
      <label className="chord-control">
        調性
        <select
          aria-label="和弦調性"
          value={prefs.key}
          onChange={(event) => selectKey(event.target.value)}
        >
          {Object.keys(activeKeyMaps).map((key) => (
            <option key={key} value={key}>
              {key} 調
            </option>
          ))}
        </select>
      </label>
      <label className="chord-control">
        和弦類型
        <select
          aria-label="和弦類型"
          value={prefs.chordType}
          onChange={(event) =>
            selectChordType(event.target.value as ChordType)
          }
        >
          <option value="triad">三和弦</option>
          <option value="seventh">七和弦</option>
        </select>
      </label>
      <label className="chord-control">
        演奏方式
        <select
          aria-label="和弦演奏方式"
          value={prefs.voicing}
          onChange={(event) =>
            onSavePrefs({ voicing: event.target.value as ChordVoicing })
          }
        >
          <option value="block">柱式</option>
          <option value="arpeggio">分解和弦</option>
          <option value="accompaniment">節奏伴奏</option>
        </select>
      </label>
      <label className="chord-control">
        風格
        <select
          aria-label="和弦風格"
          value={prefs.feel}
          onChange={(event) => onSavePrefs({ feel: event.target.value as ChordFeel })}
        >
          <option value="gentle">柔和</option>
          <option value="bold">剛強</option>
          <option value="bright">輕快</option>
        </select>
      </label>
      <button type="button" onClick={playProgression}>
        播放{" "}
        {[
          activeKeyMaps[prefs.key].KeyZ,
          activeKeyMaps[prefs.key].KeyB,
          activeKeyMaps[prefs.key].KeyN,
          activeKeyMaps[prefs.key].KeyV,
        ].join("–")}
      </button>
      <label>
        <input
          type="checkbox"
          checked={s.chordLatch}
          onChange={(event) => s.set({ chordLatch: event.target.checked })}
        />
        一按保持，換和弦時自動放開
      </label>
      <button
        type="button"
        className={edit ? "enabled" : ""}
        onClick={onToggleBindingMode}
      >
        {edit ? "完成綁定" : "綁定模式"}
      </button>
      <button type="button" onClick={onStop}>
        停止和弦
      </button>
    </div>
  );
}
