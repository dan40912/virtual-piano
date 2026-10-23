import { PianoLid } from "./components/PianoLid";
import { defaultSong } from "./music/defaultSong";
import { recorder } from "./audio/LiveRecorder";
import { InstrumentControls } from "./components/InstrumentControls";
import {
  shortcutLabel,
  keyboardBinding,
  validShortcut,
} from "./music/keyboard";
import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { ChordPanel } from "./components/ChordPanel";
import { Piano } from "./components/Piano";
import { Roll, Sheet } from "./components/Visuals";
import { engine } from "./audio/PianoEngine";
import { player } from "./audio/PlaybackScheduler";
import { useSettings } from "./store";
import {
  demo,
  defaultMap,
  groups,
  noteName,
  type Note,
  type Song,
} from "./music/model";
import {
  importHymnal,
  parseMidi,
  parseXml,
  validateHymnal,
} from "./music/importers";
import {
  Piano as PianoIcon,
  Settings2,
  Volume2,
  Sun,
  Maximize2,
  Upload,
  Link2,
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat2,
  ChevronDown,
  Music2,
  Check,
  Headphones,
  X,
  Download,
  SlidersHorizontal,
  Minimize2,
} from "lucide-react";
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
const LazyScorePaper = lazy(async () => ({
  default: (await import("./components/ScorePaper")).ScorePaper,
}));
const LazyRecordingControls = lazy(async () => ({
  default: (await import("./components/RecordingControls")).RecordingControls,
}));

function PlaybackProgress({
  duration,
  onSeek,
}: {
  duration: number;
  onSeek: (position: number) => void;
}) {
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  return (
    <div className="timeline">
      <span>{clock(position)}</span>
      <input
        aria-label="播放進度"
        type="range"
        min="0"
        max={duration || 1}
        step=".01"
        value={position}
        onChange={(event) => onSeek(+event.target.value)}
      />
      <span>{clock(duration)}</span>
    </div>
  );
}

export default function App() {
  const settings = useSettings();
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const [lidOpen, setLidOpen] = useState(false);
  const [lidTab, setLidTab] = useState("import");
  const [moreControlsOpen, setMoreControlsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [scorePaperRequested, setScorePaperRequested] = useState(false);
  const [recordingRequested, setRecordingRequested] = useState(false);
  const [splitRatio, setSplitRatio] = useState(settings.mobileScoreSplit);
  const splitDrag = useRef<{
    pointerId: number;
    startY: number;
    startRatio: number;
  } | null>(null);
  useEffect(() => {
    useSettings.getState().set({ theme: "dark" });
  }, []);
  const [song, setSong] = useState<Song | null>(defaultSong);
  const position = player.position;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1),
    [transpose, setTranspose] = useState(0),
    [mode, setMode] = useState("auto"),
    [practiceType, setPracticeType] = useState("rhythm"),
    [tolerance, setTolerance] = useState(0.2);
  const [muted, setMuted] = useState<number[]>([]),
    [autoPolicy, setAutoPolicy] = useState<
      Record<number, "all" | "bass" | "manual">
    >({
      0: "bass",
    }),
    [loop, setLoop] = useState(false),
    [loopA, setLoopA] = useState(0),
    [loopB, setLoopB] = useState(defaultSong.duration),
    [metro, setMetro] = useState(false);
  const [active, setActive] = useState(new Set<number>()),
    [pedal, setPedal] = useState(false),
    [audio, setAudio] = useState(engine.state);
  const [url, setUrl] = useState("https://www.hymnal.net/zh/hymn/ch/471"),
    [status, setStatus] = useState(
      "支援 hymnal.net 網址、MIDI 與 MusicXML 檔案",
    ),
    [loading, setLoading] = useState(false);
  const [scroll, setScroll] = useState(0);
  const [scrollMax, setScrollMax] = useState(0);
  const [panel, setPanel] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [warning, setWarning] = useState(""),
    [view, setView] = useState("roll"),
    [zoom, setZoom] = useState(65),
    [rollExpanded, setRollExpanded] = useState(true),
    [manualTranspose, setManualTranspose] = useState(false),
    [profile, setProfile] = useState("我的配置");
  const [step, setStep] = useState(0),
    [score, setScore] = useState({ correct: 0, wrong: 0, offset: 0 });
  const playToken = useRef(0);
  const audioPrimed = useRef(false);
  const iosTipShown = useRef(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const practiceStart = useRef(0);
  const previousPosition = useRef(0);
  const practiceMeta = useRef({ mode, practiceType, loopA });
  practiceMeta.current = { mode, practiceType, loopA };
  const pressed = useRef(new Map<string, number>()),
    hit = useRef(new Set<string>()),
    waitHeld = useRef(new Set<number>());
  const file = useRef<HTMLInputElement>(null),
    jsonFile = useRef<HTMLInputElement>(null);
  const groupList = useMemo(
    () =>
      song
        ? groups(song, muted)
            .map((g) =>
              g.filter(
                (n) => n.midi + transpose >= 21 && n.midi + transpose <= 108,
              ),
            )
            .filter((g) => g.length)
        : [],
    [song, muted, transpose],
  );
  useEffect(() => {
    setSplitRatio(settings.mobileScoreSplit);
  }, [settings.mobileScoreSplit]);
  const expected =
    mode === "practice" && practiceType === "wait"
      ? (groupList[step] || []).map((n) => n.midi + transpose)
      : [];
  const refresh = useCallback(() => {
    const next = new Set(pressed.current.values());
    setActive((previous) =>
      previous.size === next.size &&
      [...next].every((midi) => previous.has(midi))
        ? previous
        : next,
    );
  }, []);
  const release = useCallback(
    (id: string) => {
      const n = pressed.current.get(id);
      pressed.current.delete(id);
      if (n !== undefined && !Array.from(pressed.current.values()).includes(n))
        waitHeld.current.delete(n);
      engine.release(id);
      recorder.release(id);
      refresh();
    },
    [refresh],
  );
  const panic = useCallback(() => {
    for (const id of pressed.current.keys()) recorder.release(id);
    recorder.pedal(false);
    pressed.current.clear();
    waitHeld.current.clear();
    engine.panic();
    setPedal(false);
    refresh();
  }, [refresh]);
  const stop = useCallback(() => {
    playToken.current++;
    practiceStart.current = 0;
    previousPosition.current = 0;
    hit.current.clear();
    setStep(0);
    setScore({ correct: 0, wrong: 0, offset: 0 });
    player.stop();
    setPlaying(false);
    panic();
  }, [panic]);
  const resetPractice = () => {
    practiceStart.current = player.position;
    previousPosition.current = player.position;
    setStep(
      Math.max(
        0,
        groupList.findIndex((g) => g[0].startTime >= player.position),
      ),
    );
    hit.current.clear();
    waitHeld.current.clear();
    setScore({ correct: 0, wrong: 0, offset: 0 });
  };
  const load = (s: Song) => {
    stop();
    setSong(s);
    setMuted([]);
    setAutoPolicy(
      Object.fromEntries(
        s.tracks.map((_, i) => [i, s.tracks.length === 1 ? "bass" : "all"]),
      ),
    );
    setLoopA(0);
    setLoopB(s.duration);
    setView("roll");
    setRollExpanded(true);
    setMode("practice");
    setPracticeType("rhythm");
    resetPractice();
    setStatus(`${s.title} · ${s.notes.length} 個音符，解析成功`);
  };
  const down = (id: string, base: number) => {
    const inputStarted = performance.now();
    if (pressed.current.has(id)) return;
    const n = base + (manualTranspose ? transpose : 0);
    if (n < 21 || n > 108) {
      setStatus("此音符超出 A0–C8 音域");
      return;
    }
    pressed.current.set(id, n);
    if (!id.startsWith("preview:")) recorder.attack(id, n, settings.velocity);
    waitHeld.current.add(n);
    refresh();
    const attackManual = () => {
      if (pressed.current.get(id) !== n) return;
      engine.attack(id, n, settings.velocity);
      if (import.meta.env.DEV) {
        console.debug("Manual piano input → attack", {
          elapsedMs: Number((performance.now() - inputStarted).toFixed(2)),
          ...engine.audioLatency(),
        });
      }
    };
    if (engine.sampler?.loaded) attackManual();
    else
      void engine
        .ready()
        .then(attackManual)
        .catch((e) => setStatus(e.message));
    if ((mode === "practice" || mode === "accompaniment") && song) {
      if (mode === "practice" && practiceType === "wait") {
        const group = groupList[step] || [];
        if (group.some((a) => a.midi + transpose === n)) {
          if (group.every((a) => waitHeld.current.has(a.midi + transpose))) {
            setScore((s) => ({ ...s, correct: s.correct + group.length }));
            player.setPosition(group[0].startTime);
            setStep((s) => s + 1);
          }
        } else setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      } else if (player.playing) {
        const candidates = song.notes
          .filter(
            (a) =>
              !muted.includes(a.trackId) &&
              (mode !== "accompaniment" ||
                autoPolicy[a.trackId] === "manual" ||
                (autoPolicy[a.trackId] === "bass" &&
                  a.midi + transpose > 60)) &&
              !hit.current.has(a.id) &&
              a.startTime >= practiceStart.current &&
              a.midi + transpose === n &&
              Math.abs(a.startTime - player.position) <= tolerance,
          )
          .sort(
            (a, b) =>
              Math.abs(a.startTime - player.position) -
              Math.abs(b.startTime - player.position),
          );
        const target = candidates[0];
        if (target) {
          hit.current.add(target.id);
          setScore((s) => ({
            ...s,
            correct: s.correct + 1,
            offset: s.offset + Math.abs(target.startTime - player.position),
          }));
        } else setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      }
    }
  };
  const downRef = useRef(down);
  downRef.current = down;
  const handlePianoDown = useCallback(
    (id: string, midi: number) => void downRef.current(id, midi),
    [],
  );
  const primeAudio = useCallback(() => {
    if (audioPrimed.current) return;
    audioPrimed.current = true;
    if (!iosTipShown.current && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      iosTipShown.current = true;
      setStatus("iPhone 沒有聲音時，請確認手機側邊的靜音開關。音源載入中…");
    }
    void engine
      .ready()
      .then(() => {
        if (import.meta.env.DEV)
          console.debug("Piano audio context latency", engine.audioLatency());
      })
      .catch((e) => {
        audioPrimed.current = false;
        setStatus(e.message);
      });
  }, []);
  const noteIsAuto = useCallback(
    (note: Note) => {
      if (mode !== "accompaniment") return true;
      const policy = autoPolicy[note.trackId];
      return (
        policy === "all" || (policy === "bass" && note.midi + transpose <= 60)
      );
    },
    [mode, autoPolicy, transpose],
  );
  const audition = async () => {
    if (recorder.recording) {
      setStatus("請先結束錄製，再試聽音色");
      return;
    }
    stop();
    const token = playToken.current;
    clearTimeout(previewTimer.current);
    try {
      await engine.ready();
      if (token !== playToken.current) return;
      [60, 64, 67].forEach((n, i) => void downRef.current("preview:" + i, n));
      previewTimer.current = setTimeout(
        () => [0, 1, 2].forEach((i) => release("preview:" + i)),
        700,
      );
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  useEffect(() => {
    engine.onState = (s) => {
      engine.state = s;
      setAudio(s);
    };
    return () => {
      engine.onState = () => {};
    };
  }, []);
  useEffect(() => {
    engine.settings(settings.volume, settings.reverb, settings.pianoStyle);
  }, [settings.volume, settings.reverb, settings.pianoStyle]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    const off = (e: KeyboardEvent) => {
      release(e.code);
      if (e.code === settings.pedal) {
        engine.sustain(false);
        recorder.pedal(false);
        setPedal(false);
      }
    };
    const on = (e: KeyboardEvent) => {
      if (e.code === "Escape" && panel) {
        setPanel("");
        setSelected(null);
        return;
      }
      if (e.repeat || e.code.startsWith("Shift")) return;
      const code = keyboardBinding(e);
      const target = e.target as HTMLElement;
      if (
        target.matches(
          'input:not([type="checkbox"]):not([type="range"]):not([type="radio"]),textarea,select',
        ) ||
        target.isContentEditable
      )
        return;
      if (panel === "keyboard" && selected !== null) {
        e.preventDefault();
        if (["Escape", "Tab"].includes(e.code)) return;
        const map = { ...settings.mapping };
        if (!validShortcut(code)) {
          setWarning("請使用字母、數字或符號鍵，可搭配 Shift");
          return;
        }
        const previous = map[code];
        if (previous !== undefined && previous !== selected) {
          setWarning(
            `${shortcutLabel(code)} 已綁定 ${noteName(previous)}，請先解除該綁定。`,
          );
          return;
        }
        if (e.code === settings.pedal) {
          setWarning("此按鍵已設定為延音踏板");
          return;
        }
        for (const key in map) if (map[key] === selected) delete map[key];
        map[code] = selected;
        settings.set({ mapping: map });
        setWarning(`${shortcutLabel(code)} → ${noteName(selected)} 已儲存`);
        setSelected(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === settings.pedal) {
        e.preventDefault();
        engine.sustain(true);
        recorder.pedal(true);
        setPedal(true);
        return;
      }
      if (e.code === "PageUp" || e.code === "PageDown") {
        e.preventDefault();
        settings.set({
          octave: Math.max(
            -2,
            Math.min(2, settings.octave + (e.code === "PageDown" ? -1 : 1)),
          ),
        });
        return;
      }
      if (!e.shiftKey && settings.chordEnabled && settings.chordMapping[e.code])
        return;
      const n = settings.mapping[code];
      if (n !== undefined) {
        e.preventDefault();
        void downRef.current(e.code, n + settings.octave * 12);
      }
    };
    const blur = () => {
      for (const id of [...pressed.current.keys()]) release(id);
      waitHeld.current.clear();
      engine.sustain(false);
      setPedal(false);
    };
    window.addEventListener("keydown", on);
    window.addEventListener("keyup", off);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("keyup", off);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, [
    settings.mapping,
    settings.chordEnabled,
    settings.chordMapping,
    settings.octave,
    settings.pedal,
    panel,
    selected,
    release,
    panic,
  ]);
  useEffect(() => {
    player.onFrame = (p) => {
      const meta = practiceMeta.current;
      if (
        p < previousPosition.current - 0.1 &&
        meta.mode === "practice" &&
        meta.practiceType === "rhythm"
      ) {
        hit.current.clear();
        practiceStart.current = meta.loopA;
        setScore({ correct: 0, wrong: 0, offset: 0 });
      }
      previousPosition.current = p;
    };
    player.onEnd = () => {
      setPlaying(false);
      setPedal(false);
    };
    return () => {
      playToken.current++;
      clearTimeout(previewTimer.current);
      player.stop();
    };
  }, []);
  const play = async () => {
    if (!song) return;
    const token = ++playToken.current;
    if (mode === "practice" && practiceType === "wait") {
      setStatus("等待模式已就緒：同時按住亮起的琴鍵即可前進");
      return;
    }
    try {
      await engine.ready();
      if (token !== playToken.current) return;
      engine.settings(settings.volume, settings.reverb, settings.pianoStyle);
      if (player.position >= song.duration) {
        player.setPosition(0);
        resetPractice();
      }
      player.silent = mode === "practice";
      player.start(song);
      setPlaying(true);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  useEffect(() => {
    player.speed = speed;
    player.transpose = transpose;
    player.muted = muted;
    player.noteFilter = mode === "accompaniment" ? noteIsAuto : null;
    player.loop = loop;
    player.a = loopA;
    player.b = loopB;
    player.metronome = metro;
    if (player.playing && song) player.start(song);
  }, [
    speed,
    transpose,
    muted,
    loop,
    loopA,
    loopB,
    metro,
    song,
    mode,
    noteIsAuto,
  ]);
  const seek = (p: number) => {
    previousPosition.current = p;
    practiceStart.current = p;
    player.setPosition(p);
    if (player.playing && song) player.start(song);
    if (mode === "practice") {
      setStep(
        Math.max(
          0,
          groupList.findIndex((g) => g[0].startTime >= p),
        ),
      );
      hit.current.clear();
      setScore({ correct: 0, wrong: 0, offset: 0 });
    }
  };
  const importFile = async (f: File) => {
    setLoading(true);
    try {
      if (f.size > 20 * 1024 * 1024) throw Error("檔案上限 20 MB");
      load(
        /\.(xml|musicxml)$/i.test(f.name)
          ? parseXml(await f.text(), f.name)
          : await parseMidi(await f.arrayBuffer(), f.name),
      );
    } catch (e) {
      setStatus("匯入失敗：" + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const fetchSong = async () => {
    try {
      validateHymnal(url);
    } catch (e) {
      setStatus((e as Error).message);
      return;
    }
    setLoading(true);
    setStatus("URL 格式有效 · 正在取得歌曲資訊…");
    try {
      load(await importHymnal(url));
    } catch {
      setStatus(
        "需要手動上傳：目前無法從此網址直接取得 MIDI，請先由原網站合法下載 MIDI 檔，再匯入此處。",
      );
    } finally {
      setLoading(false);
    }
  };
  const exportMap = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { mapping: settings.mapping, pedal: settings.pedal },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "piano-keyboard.json";
    a.click();
    URL.revokeObjectURL(u);
  };
  const shownMap = Object.fromEntries(
    Object.entries(settings.mapping).map(([k, n]) => [
      k,
      n + settings.octave * 12,
    ]),
  );
  const allActive = new Set([...active, ...player.getActiveNotesSnapshot()]);
  const manualFollow =
    (mode === "practice" && practiceType === "rhythm") ||
    mode === "accompaniment";
  const midiPedals = new Set<number>();
  if (playing)
    for (const p of song?.pedals || [])
      if (p.time <= position && !muted.includes(p.trackId))
        p.down ? midiPedals.add(p.trackId) : midiPedals.delete(p.trackId);
  const pedalVisible = pedal || midiPedals.size > 0;
  const outOfRange =
    song?.notes.filter(
      (n) => n.midi + transpose < 21 || n.midi + transpose > 108,
    ).length || 0;
  const considered =
    song?.notes.filter(
      (n) =>
        !muted.includes(n.trackId) &&
        n.midi + transpose >= 21 &&
        n.midi + transpose <= 108 &&
        n.startTime >= practiceStart.current,
    ) || [];
  const missed =
    mode === "practice" && practiceType === "rhythm"
      ? considered.filter(
          (n) => n.startTime < position - tolerance && !hit.current.has(n.id),
        ).length
      : 0;
  const bpm = song
    ? [...(song.tempos.length ? song.tempos : [{ time: 0, bpm: song.tempo }])]
        .reverse()
        .find((t) => t.time <= position)?.bpm || song.tempo
    : 100;
  return (
    <div
      className={`app ${immersive ? "immersive-mode" : ""}`}
      onPointerDownCapture={primeAudio}
      onKeyDownCapture={primeAudio}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) void importFile(e.dataTransfer.files[0]);
      }}
    >
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">
            <PianoIcon size={22} />
          </span>
          <span>
            Virtual Piano <b>Studio</b>
            <small>YOUR PERSONAL MUSIC SPACE</small>
          </span>
        </a>
        <nav>
          <button onClick={() => setPanel("keyboard")} title="鍵盤設定">
            <Settings2 size={16} />
            <span>鍵盤設定</span>
          </button>
          <button onClick={() => setPanel("audio")} title="音訊設定">
            <Volume2 size={17} />
            <span>音訊設定</span>
          </button>
          <i />
          <button
            className="desktop-lid-button"
            aria-label="打開琴蓋功能選單"
            onClick={() => {
              setLidTab("menu");
              setLidOpen(true);
            }}
          >
            <ChevronDown size={17} />
            <span>琴蓋選單</span>
          </button>
          <button
            className="mobile-track-button"
            aria-label={lidOpen ? "關閉曲目與工具" : "打開曲目與工具"}
            aria-expanded={lidOpen}
            onClick={() => {
              setLidTab("import");
              setLidOpen((open) => !open);
            }}
          >
            <Music2 size={16} />
            <span>曲目與工具</span>
          </button>
          <button
            aria-label="全螢幕"
            onClick={() => {
              if (immersive) {
                setImmersive(false);
                return;
              }
              if (document.fullscreenElement) {
                void document.exitFullscreen();
                return;
              }
              if (isIOS || !document.documentElement.requestFullscreen) {
                setImmersive(true);
                setStatus(
                  "已進入沉浸版面。iPhone 可在 Safari 分享選單中選擇「加入主畫面」，隱藏網址列。",
                );
                return;
              }
              void document.documentElement
                .requestFullscreen()
                .catch(() => setImmersive(true));
            }}
          >
            <Maximize2 size={17} />
          </button>
        </nav>
      </header>
      <button
        type="button"
        className="immersive-exit"
        aria-label="結束沉浸版面"
        onClick={() => setImmersive(false)}
      >
        返回工作室
      </button>
      <main>
        <section
          className="studio"
          data-mobile-layout={settings.mobileLayout}
          style={
            {
              "--mobile-score-height": `${splitRatio * 100}dvh`,
              "--mobile-piano-height": `${(1 - splitRatio) * 100}dvh`,
            } as CSSProperties
          }
        >
          <div
            className="mobile-layout-switch"
            role="group"
            aria-label="手機版面"
          >
            <span>版面</span>
            <button
              type="button"
              data-layout="play"
              className={settings.mobileLayout === "play" ? "selected" : ""}
              aria-pressed={settings.mobileLayout === "play"}
              onClick={() => settings.set({ mobileLayout: "play" })}
            >
              演奏版面
            </button>
            <button
              type="button"
              data-layout="score"
              className={settings.mobileLayout === "score" ? "selected" : ""}
              aria-pressed={settings.mobileLayout === "score"}
              onClick={() => settings.set({ mobileLayout: "score" })}
            >
              看譜版面
            </button>
            <small>
              {settings.mobileLayout === "auto" ? "依螢幕方向" : "已記住選擇"}
            </small>
          </div>
          <PianoLid
            open={lidOpen}
            onToggle={() => setLidOpen((v) => !v)}
            activeTab={lidTab}
            onTabChange={(id) => {
              if (id === "record") setRecordingRequested(true);
              setLidTab(id);
            }}
            tabs={[
              {
                id: "import",
                label: "琴譜與 MIDI",
                content: (
                  <div
                    className={`grand-workbench ${rollExpanded ? "roll-expanded" : ""}`}
                  >
                    <section className="music-desk" aria-label="樂譜架">
                      <div className="desk-crest">
                        <span /> MUSIC DESK <span />
                      </div>{" "}
                      <div className="studio-top">
                        <div className="song-info">
                          <div className="music-square">
                            <Music2 size={20} />
                          </div>
                          <div>
                            <h2>
                              {song?.title || "自由演奏"}
                              <span className="tag">
                                {song?.source.startsWith("使用者指定")
                                  ? "DEFAULT"
                                  : song?.source.startsWith("內建")
                                    ? "DEMO"
                                    : song
                                      ? "IMPORTED"
                                      : "LIVE"}
                              </span>
                            </h2>
                            <p>
                              {song
                                ? `${Math.round(bpm * speed)} BPM　 ·　${(song.signatures.filter((s) => s.time <= position).at(-1)?.value || song.timeSignature).join("/")} 拍　 ·　${song.tracks.length} 音軌`
                                : "讓指尖帶領旋律"}
                              <span> {song?.source}</span>
                            </p>
                          </div>
                        </div>
                        <div className="segmented">
                          <button
                            className={view === "score" ? "selected" : ""}
                            onClick={() => {
                              setScorePaperRequested(true);
                              setView("score");
                            }}
                          >
                            琴譜
                          </button>
                          <button
                            className={view === "roll" ? "selected" : ""}
                            onClick={() => setView("roll")}
                          >
                            Piano Roll
                          </button>
                          <button
                            className={view === "sheet" ? "selected" : ""}
                            onClick={() => setView("sheet")}
                          >
                            五線譜
                          </button>
                        </div>
                      </div>
                      <div className="visual-area">
                        <div
                          hidden={view !== "score"}
                          className="score-paper-host"
                        >
                          <Suspense
                            fallback={
                              <p className="score-loading">正在載入琴譜架…</p>
                            }
                          >
                            {scorePaperRequested && (
                              <LazyScorePaper
                                onXml={async (f) => {
                                  await importFile(f);
                                  setView("sheet");
                                }}
                              />
                            )}
                          </Suspense>
                        </div>
                        {view === "score" ? null : view === "roll" ? (
                          <>
                            <div className="roll-label">
                              <span>
                                <i />
                                {manualFollow
                                  ? "手動跟彈 · 音符由上往下落"
                                  : "音符由上往下 · 跟隨 MIDI"}
                              </span>
                              <div className="roll-tools">
                                <button
                                  type="button"
                                  className={manualFollow ? "selected" : ""}
                                  aria-pressed={manualFollow}
                                  onClick={() => {
                                    if (manualFollow) return;
                                    stop();
                                    setMode("practice");
                                    setPracticeType("rhythm");
                                    resetPractice();
                                    setView("roll");
                                  }}
                                >
                                  {manualFollow ? "手動跟彈中" : "切換手動跟彈"}
                                </button>
                                <label>
                                  下落速度
                                  <input
                                    aria-label="Piano Roll 下落速度"
                                    type="range"
                                    min="30"
                                    max="130"
                                    value={zoom}
                                    onChange={(e) => setZoom(+e.target.value)}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="roll-expand-button"
                                  aria-pressed={rollExpanded}
                                  onClick={() => setRollExpanded((v) => !v)}
                                >
                                  {rollExpanded ? (
                                    <Minimize2 size={13} />
                                  ) : (
                                    <Maximize2 size={13} />
                                  )}
                                  {rollExpanded ? "縮小" : "放大音符區"}
                                </button>
                              </div>
                            </div>
                            <Roll
                              song={song}
                              transpose={transpose}
                              count={settings.keyCount}
                              zoom={zoom}
                              muted={muted}
                              scroll={scroll}
                              mapping={settings.mapping}
                              octave={settings.octave}
                              manual={manualFollow}
                              autoPolicy={
                                mode === "accompaniment"
                                  ? autoPolicy
                                  : undefined
                              }
                            />
                            {!song && (
                              <p className="empty-roll">
                                匯入歌曲，讓旋律躍然眼前。
                              </p>
                            )}
                          </>
                        ) : song?.xml && transpose === 0 ? (
                          <>
                            <p className="sheet-note">
                              MusicXML 原始記譜 · 游標依原始音符位置同步追蹤。
                            </p>
                            <Sheet song={song} />
                          </>
                        ) : (
                          <div className="notation-empty">
                            <Music2 size={30} />
                            <p>
                              {transpose
                                ? "轉調後請使用同步 Piano Roll"
                                : "MIDI 不含完整記譜，使用 Piano Roll 保留準確音符。"}
                            </p>
                            <span>匯入未壓縮 MusicXML 可預覽原始五線譜。</span>
                            <button onClick={() => setView("roll")}>
                              顯示 Piano Roll →
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="music-desk-ledge" aria-hidden="true" />
                    </section>
                    <section className="midi-desk" aria-label="MIDI 放置區">
                      <span className="eyebrow">MIDI PLAYER</span>
                      <h3>把演奏檔放在這裡</h3>
                      <button
                        className="midi-drop-slot"
                        onClick={() => {
                          file.current!.accept = ".mid,.midi";
                          file.current!.click();
                        }}
                      >
                        <Upload size={25} />
                        <strong>放入 MIDI 檔案</strong>
                        <span>點擊選擇，或將 .mid 拖進此區</span>
                        <small>
                          {song ? "目前：" + song.title : "尚未放入 MIDI"}
                        </small>
                      </button>{" "}
                      <section className="import-box">
                        <div className="url-row">
                          <Link2 size={18} />
                          <input
                            aria-label="詩歌網址"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="貼上 hymnal.net 詩歌網址"
                          />
                          <button
                            className="primary"
                            disabled={loading}
                            onClick={() => void fetchSong()}
                          >
                            {loading ? "載入中…" : "載入樂譜"}
                            <span>↗</span>
                          </button>
                        </div>
                        <div className="import-bottom">
                          <div className="import-actions">
                            <button
                              onClick={() => {
                                file.current!.accept = ".mid,.midi";
                                file.current!.click();
                              }}
                            >
                              <Upload size={14} />
                              匯入 MIDI
                            </button>
                            <button
                              onClick={() => {
                                file.current!.accept = ".xml,.musicxml";
                                file.current!.click();
                              }}
                            >
                              <Music2 size={14} />
                              匯入 MusicXML
                            </button>
                            <span className="separator" />
                            <button onClick={() => load(defaultSong)}>
                              載入預設曲
                            </button>
                            <button onClick={() => load(demo)}>
                              小星星測試
                            </button>
                            <button
                              onClick={() => {
                                stop();
                                setSong(null);
                                setStatus("歌曲已清除，可自由演奏");
                              }}
                            >
                              清除
                            </button>
                          </div>
                          <span className="local-badge">
                            <span />
                            檔案僅在瀏覽器處理
                          </span>
                        </div>
                        <div className="status" role="status">
                          {status}
                          {status.includes("手動") && (
                            <a href={url} target="_blank" rel="noreferrer">
                              開啟原網站 ↗
                            </a>
                          )}
                        </div>
                      </section>
                    </section>
                  </div>
                ),
              },
              {
                id: "voice",
                label: "聲音與演奏",
                content: (
                  <InstrumentControls onPreview={() => void audition()} />
                ),
              },
              {
                id: "record",
                label: "我的錄製",
                content: recordingRequested ? (
                  <Suspense
                    fallback={
                      <p className="score-loading">正在載入錄製工具…</p>
                    }
                  >
                    <LazyRecordingControls onLoad={load} />
                  </Suspense>
                ) : null,
              },
              {
                id: "menu",
                label: "功能選單",
                content: (
                  <div className="lid-function-menu">
                    <div>
                      <span className="eyebrow">YOUR PIANO, YOUR WAY</span>
                      <h3>把工具收進琴蓋，讓音樂留在眼前。</h3>
                      <p>
                        選擇功能後可關上琴蓋繼續演奏；琴蓋開合不會停止歌曲或清除錄製。
                      </p>
                    </div>
                    <div className="lid-menu-grid">
                      <button onClick={() => setPanel("keyboard")}>
                        <Settings2 size={19} />
                        <strong>琴鍵與綁定</strong>
                        <span>88 鍵快捷鍵、自訂按法</span>
                      </button>
                      <button onClick={() => setPanel("audio")}>
                        <Volume2 size={19} />
                        <strong>音訊設定</strong>
                        <span>音量、殘響與演奏力度</span>
                      </button>
                      <button onClick={() => setPanel("tracks")}>
                        <SlidersHorizontal size={19} />
                        <strong>音軌管理</strong>
                        <span>旋律、伴奏與個別靜音</span>
                      </button>
                      <button
                        onClick={() => {
                          load(defaultSong);
                        }}
                      >
                        <Music2 size={19} />
                        <strong>載入預設曲</strong>
                        <span>e0637_i · 110 BPM · 3/4</span>
                      </button>
                      <button
                        onClick={() => {
                          stop();
                          setMode("free");
                          setLidOpen(false);
                        }}
                      >
                        <PianoIcon size={19} />
                        <strong>自由演奏</strong>
                        <span>關上琴蓋，直接開始彈</span>
                      </button>
                      <button
                        onClick={() => {
                          setLidTab("voice");
                        }}
                      >
                        <Headphones size={19} />
                        <strong>更換聲音風格</strong>
                        <span>柔和、剛強、輕快</span>
                      </button>
                    </div>
                  </div>
                ),
              },
            ]}
          />
          <div className="piano-housing">
            <div className="fallboard">
              <span className="instrument-name">
                VIRTUAL <b>PIANO</b>
              </span>
              <span className="instrument-sub">GRAND PIANO</span>
              <span className="range-label">
                {settings.keyCount === 88 ? "A0 — C8" : "C2 — C7"}
              </span>
            </div>
            <div className="felt" />
            <Piano
              count={settings.keyCount}
              mapping={shownMap}
              active={active}
              expected={expected}
              onDown={handlePianoDown}
              onUp={release}
              onSelect={setSelected}
              mappingMode={panel === "keyboard"}
              autoEnabled={mode === "auto" || mode === "accompaniment"}
              onScroll={setScroll}
              scrollPosition={scroll}
              onBounds={setScrollMax}
            />
            <div className="piano-lip" />
          </div>
          <ChordPanel
            onDown={(id, n) => void downRef.current(id, n)}
            onUp={release}
            blocked={panel !== ""}
            resetKey={playToken.current}
          />
          <div className="keyboard-tools">
            <div>
              <span className="tiny-dot" />{" "}
              {allActive.size
                ? Array.from(allActive).map(noteName).join(" · ")
                : "準備好，開始演奏"}
              <span className="key-hint">
                A – L 演奏　 /　
                {settings.pedal === "Space" ? "空白鍵" : settings.pedal} 延音
              </span>
            </div>
            <div>
              <label>
                音域{" "}
                <select
                  aria-label="琴鍵數量"
                  value={settings.keyCount}
                  onChange={(e) => settings.set({ keyCount: +e.target.value })}
                >
                  <option value={61}>61 鍵</option>
                  <option value={88}>88 鍵</option>
                </select>
              </label>
              <input
                className="range-scroll"
                aria-label="鍵盤水平位置"
                type="range"
                min="0"
                max={scrollMax}
                value={scroll}
                onChange={(e) => setScroll(+e.target.value)}
              />
              <span className="separator" />
              <button
                aria-label="降低八度"
                onClick={() =>
                  settings.set({ octave: Math.max(-2, settings.octave - 1) })
                }
              >
                −
              </button>
              <span>
                八度 {settings.octave > 0 ? "+" : ""}
                {settings.octave}
              </span>
              <button
                aria-label="提高八度"
                onClick={() =>
                  settings.set({ octave: Math.min(2, settings.octave + 1) })
                }
              >
                ＋
              </button>
            </div>
          </div>
          <div
            className={`player ${moreControlsOpen ? "more-controls-open" : ""}`}
          >
            <div className="playback-heading">
              <strong>{song?.title || "自由演奏"}</strong>
              <button
                type="button"
                className="player-more-toggle"
                aria-expanded={moreControlsOpen}
                onClick={() => setMoreControlsOpen((open) => !open)}
              >
                <Settings2 size={15} /> {moreControlsOpen ? "收起更多" : "更多"}
              </button>
            </div>
            <PlaybackProgress duration={song?.duration || 0} onSeek={seek} />
            <div className="transport-row">
              <div className="transport">
                <button
                  title="重播"
                  onClick={() => {
                    stop();
                    void play();
                  }}
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  className="play"
                  aria-label={playing ? "暫停" : "播放"}
                  disabled={!song || mode === "free"}
                  onClick={() => {
                    if (playing) {
                      player.stop(false);
                      setPlaying(false);
                      setActive(new Set());
                    } else void play();
                  }}
                >
                  {playing ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" />
                  )}
                </button>
                <button title="停止" onClick={stop}>
                  <Square size={17} />
                </button>
                <span className="separator" />
                <button
                  className={loop ? "enabled" : ""}
                  title="循環"
                  onClick={() => setLoop(!loop)}
                >
                  <Repeat2 size={18} />
                </button>
              </div>
              <div className="playback-settings">
                <label>
                  速度{" "}
                  <select
                    aria-label="速度倍率"
                    value={speed}
                    onChange={(e) => setSpeed(+e.target.value)}
                  >
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((x) => (
                      <option key={x} value={x}>
                        {x.toFixed(2)}×
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  轉調{" "}
                  <select
                    aria-label="轉調"
                    value={transpose}
                    onChange={(e) => setTranspose(+e.target.value)}
                  >
                    {Array.from({ length: 25 }, (_, i) => i - 12).map((n) => (
                      <option key={n} value={n}>
                        {n > 0 ? "+" : ""}
                        {n} 半音
                      </option>
                    ))}
                  </select>
                </label>
                <span className="separator" />
                <Volume2 size={16} />
                <input
                  aria-label="音量"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={settings.volume}
                  onChange={(e) => settings.set({ volume: +e.target.value })}
                />
                <span>{Math.round(settings.volume * 100)}%</span>
              </div>
              <div className="toggles">
                <button
                  className={metro ? "enabled" : ""}
                  onClick={() => setMetro(!metro)}
                >
                  ♩ <span>節拍器</span>
                </button>
                <button
                  className={pedalVisible ? "enabled" : ""}
                  onClick={() => {
                    engine.sustain(!pedal);
                    recorder.pedal(!pedal);
                    setPedal(!pedal);
                  }}
                >
                  ⌁ <span>延音</span>
                  <span className="toggle">
                    <i />
                  </span>
                </button>
              </div>
            </div>
            {loop && (
              <div className="loop-fields">
                <label>
                  A{" "}
                  <input
                    aria-label="循環起點"
                    type="number"
                    min="0"
                    max={loopB}
                    step=".1"
                    value={loopA}
                    onChange={(e) =>
                      setLoopA(
                        Math.max(0, Math.min(loopB - 0.1, +e.target.value)),
                      )
                    }
                  />
                </label>
                <label>
                  B{" "}
                  <input
                    aria-label="循環終點"
                    type="number"
                    min={loopA}
                    max={song?.duration}
                    step=".1"
                    value={loopB}
                    onChange={(e) =>
                      setLoopB(
                        Math.max(
                          loopA + 0.1,
                          Math.min(song?.duration || 1, +e.target.value),
                        ),
                      )
                    }
                  />
                </label>
                <span>以秒設定循環區間</span>
              </div>
            )}
          </div>
          <div className="mode-row">
            <div className="mode-switch">
              {[
                ["auto", "自動演奏"],
                ["accompaniment", "自動伴奏"],
                ["free", "自由演奏"],
                ["practice", "練習模式"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={mode === id ? "selected" : ""}
                  onClick={() => {
                    stop();
                    resetPractice();
                    setMode(id);
                  }}
                >
                  {id === "auto" ? (
                    <Play size={13} />
                  ) : id === "free" ? (
                    <PianoIcon size={14} />
                  ) : (
                    <Music2 size={14} />
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
            <span>
              {mode === "auto"
                ? "跟隨每一個音符，感受音樂的呼吸。"
                : mode === "accompaniment"
                  ? "選擇自動播放的部分；其餘音符由你親自彈奏。"
                  : mode === "free"
                    ? "使用電腦鍵盤、滑鼠或觸控，盡情彈奏。"
                    : "跟隨提示練習，讓每次演奏都更進一步。"}
            </span>
            <button onClick={() => setPanel("tracks")}>
              <SlidersHorizontal size={15} /> 音軌
            </button>
          </div>
          <div
            className="mobile-score-splitter"
            role="separator"
            aria-label="調整曲譜與鋼琴的顯示比例"
            aria-orientation="horizontal"
            aria-valuemin={25}
            aria-valuemax={65}
            aria-valuenow={Math.round(splitRatio * 100)}
            tabIndex={0}
            onPointerDown={(event) => {
              event.preventDefault();
              splitDrag.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startRatio: splitRatio,
              };
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Pointer events can still reach the divider in fallback mode.
              }
            }}
            onPointerMove={(event) => {
              const drag = splitDrag.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const next = Math.max(
                0.25,
                Math.min(
                  0.65,
                  drag.startRatio +
                    (event.clientY - drag.startY) / Math.max(320, innerHeight),
                ),
              );
              setSplitRatio(next);
            }}
            onPointerUp={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatio });
            }}
            onPointerCancel={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatio });
            }}
            onLostPointerCapture={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatio });
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                const next = Math.max(
                  0.25,
                  Math.min(
                    0.65,
                    splitRatio + (event.key === "ArrowDown" ? 0.03 : -0.03),
                  ),
                );
                setSplitRatio(next);
                settings.set({ mobileScoreSplit: next });
              }
            }}
          >
            <span />
          </div>
          {mode === "accompaniment" && song && (
            <div className="accompaniment-panel" aria-label="自動伴奏音軌設定">
              <div className="accompaniment-heading">
                <div>
                  <strong>選擇誰來彈</strong>
                  <span>
                    {song.tracks.length === 1
                      ? "單音軌曲目：低音自動涵蓋 C4 以下，高音留給你彈。"
                      : "可逐軌指定自動伴奏或手動演奏。"}
                  </span>
                </div>
                <div className="accompaniment-shortcuts">
                  <button
                    type="button"
                    onClick={() =>
                      setAutoPolicy(
                        Object.fromEntries(
                          song.tracks.map((_, i) => [i, "all"]),
                        ) as Record<number, "all" | "bass" | "manual">,
                      )
                    }
                  >
                    全部自動
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAutoPolicy(
                        Object.fromEntries(
                          song.tracks.map((_, i) => [i, "manual"]),
                        ) as Record<number, "all" | "bass" | "manual">,
                      )
                    }
                  >
                    全部手彈
                  </button>
                </div>
              </div>
              <div className="accompaniment-tracks">
                {song.tracks.map((track, i) => {
                  const policy = autoPolicy[i] || "manual";
                  const noteCount = song.notes.filter(
                    (n) => n.trackId === i,
                  ).length;
                  return (
                    <div className="accompaniment-track" key={`${track}-${i}`}>
                      <div className="accompaniment-track-name">
                        <i />
                        <span>{track}</span>
                        <small>{noteCount} 音符</small>
                      </div>
                      <div
                        className="accompaniment-options"
                        role="group"
                        aria-label={`${track} 演奏方式`}
                      >
                        {(
                          [
                            ["manual", "手彈"],
                            ["bass", "低音自動"],
                            ["all", "整軌自動"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            type="button"
                            key={value}
                            className={policy === value ? "selected" : ""}
                            aria-pressed={policy === value}
                            onClick={() =>
                              setAutoPolicy((current) => ({
                                ...current,
                                [i]: value,
                              }))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="accompaniment-legend">
                <span>
                  <i className="auto" /> 自動播放
                </span>
                <span>
                  <i className="hand" /> 請你手彈（Piano Roll 會標出電腦按鍵）
                </span>
              </div>
            </div>
          )}
          {mode === "practice" && (
            <div className="practice">
              <select
                value={practiceType}
                onChange={(e) => {
                  stop();
                  resetPractice();
                  setPracticeType(e.target.value);
                }}
              >
                <option value="wait">等待正確音符</option>
                <option value="rhythm">節奏練習</option>
              </select>
              {practiceType === "rhythm" && (
                <select
                  value={tolerance}
                  onChange={(e) => setTolerance(+e.target.value)}
                >
                  {[0.1, 0.2, 0.3].map((t) => (
                    <option key={t} value={t}>
                      ±{t * 1000}ms
                    </option>
                  ))}
                </select>
              )}
              <span>
                {practiceType === "wait"
                  ? step >= groupList.length
                    ? "練習完成"
                    : `下一組：${expected.map(noteName).join(" + ")}`
                  : "按播放開始，依 Piano Roll 提示演奏"}
              </span>
              <span>
                正確 {score.correct} · 錯誤 {score.wrong} · 遺漏 {missed}
              </span>
              <span>
                完成{" "}
                {Math.round(
                  (score.correct / Math.max(1, considered.length)) * 100,
                )}
                %
                {practiceType === "rhythm" && score.correct
                  ? ` · 平均誤差 ${Math.round((score.offset / score.correct) * 1000)}ms`
                  : ""}
              </span>
              <button
                onClick={() => {
                  stop();
                  resetPractice();
                }}
              >
                重新練習
              </button>
            </div>
          )}
          {outOfRange > 0 && (
            <p className="warning">
              {outOfRange} 個音符超出 88 鍵音域，播放時略過。
            </p>
          )}
        </section>
        <div className="below">
          <span>
            <Check size={14} />
            真實鋼琴取樣
          </span>
          <span>
            <Check size={14} />
            支援多點觸控
          </span>
          <span>
            <Check size={14} />
            無需登入・音樂留在你的裝置
          </span>
          <span className="shortcut">
            小提示：Page Up / Down 切換八度　 ·　⇧ = Shift
          </span>
        </div>
      </main>
      <footer>
        <span>VIRTUAL PIANO STUDIO</span>
        <span>為每一位熱愛音樂的人而作。</span>
        <a
          href="https://github.com/sfzinstruments/SalamanderGrandPiano"
          target="_blank"
          rel="noreferrer"
        >
          Piano samples: Alexander Holm · CC BY 3.0 ↗
        </a>
      </footer>
      <input
        ref={file}
        type="file"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void importFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={jsonFile}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          try {
            const raw = JSON.parse(await e.target.files![0].text());
            if (
              !raw.mapping ||
              typeof raw.mapping !== "object" ||
              Object.entries(raw.mapping).some(
                ([k, v]) =>
                  !validShortcut(k) ||
                  typeof v !== "number" ||
                  !Number.isInteger(v) ||
                  v < 21 ||
                  v > 108,
              ) ||
              new Set(Object.values(raw.mapping)).size !==
                Object.keys(raw.mapping).length
            )
              throw Error("配置格式錯誤或含重複音符");
            settings.set({
              mapping: raw.mapping,
              pedal: ["Space", "ControlRight"].includes(raw.pedal)
                ? raw.pedal
                : settings.pedal,
            });
            setWarning("配置匯入成功");
          } catch (err) {
            setWarning((err as Error).message);
          }
          e.target.value = "";
        }}
      />
      {panel && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setPanel("");
            setSelected(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="設定"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <h2>
                {panel === "keyboard"
                  ? "鍵盤映射設定"
                  : panel === "audio"
                    ? "音訊設定"
                    : "音軌設定"}
              </h2>
              <button
                aria-label="關閉"
                onClick={() => {
                  setPanel("");
                  setSelected(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            {panel === "keyboard" ? (
              <>
                <p>
                  88 鍵皆有預設快捷鍵。⇧ 表示按住 Shift；點音符可重新綁定。Page
                  Up / Down 切換八度，八度 0 為原始音域。
                </p>
                <div className="mapping-grid">
                  {Array.from({ length: 88 }, (_, i) => i + 21).map((n) => (
                    <button
                      key={n}
                      className={selected === n ? "selected" : ""}
                      onClick={() => {
                        setSelected(n);
                        setWarning("");
                      }}
                    >
                      {noteName(n)}
                      <small>
                        {Object.entries(settings.mapping)
                          .map(([k, v]) => [shortcutLabel(k), v] as const)
                          .find(([, v]) => v === n)?.[0] || "—"}
                      </small>
                    </button>
                  ))}
                </div>
                <p role="status">
                  {selected ? `等待為 ${noteName(selected)} 指定按鍵…` : ""}{" "}
                  {warning}
                </p>
                <div className="modal-actions">
                  <button
                    onClick={() => {
                      if (selected !== null) {
                        const map = { ...settings.mapping };
                        for (const k in map)
                          if (map[k] === selected) delete map[k];
                        settings.set({ mapping: map });
                        setWarning("已解除");
                        setSelected(null);
                      }
                    }}
                  >
                    解除選取
                  </button>
                  <button
                    onClick={() => {
                      settings.set({ mapping: defaultMap });
                      setSelected(null);
                      setWarning("已恢復預設");
                    }}
                  >
                    恢復預設
                  </button>
                  <button onClick={exportMap}>
                    <Download size={13} />
                    匯出 JSON
                  </button>
                  <button onClick={() => jsonFile.current?.click()}>
                    匯入 JSON
                  </button>
                </div>
                <label>
                  踏板按鍵{" "}
                  <select
                    value={settings.pedal}
                    onChange={(e) => settings.set({ pedal: e.target.value })}
                  >
                    {["Space", "ControlRight"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <div className="profile">
                  <input
                    aria-label="配置名稱"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (profile.trim())
                        settings.set({
                          profiles: {
                            ...settings.profiles,
                            [profile.trim()]: { ...settings.mapping },
                          },
                        });
                    }}
                  >
                    儲存配置
                  </button>
                  <select
                    aria-label="載入配置"
                    value=""
                    onChange={(e) => {
                      settings.set({
                        mapping: settings.profiles[e.target.value],
                      });
                      setProfile(e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      載入配置
                    </option>
                    {Object.keys(settings.profiles).map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : panel === "audio" ? (
              <>
                <p>Grand Piano · Salamander 真實鋼琴取樣</p>
                <label className="setting-line">
                  音量
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={settings.volume}
                    onChange={(e) => settings.set({ volume: +e.target.value })}
                  />
                </label>
                <label className="setting-line">
                  殘響
                  <input
                    type="range"
                    min="0"
                    max=".8"
                    step=".01"
                    value={settings.reverb}
                    onChange={(e) => settings.set({ reverb: +e.target.value })}
                  />
                </label>
                <label className="setting-line">
                  演奏力度
                  <input
                    type="range"
                    min=".1"
                    max="1"
                    step=".01"
                    value={settings.velocity}
                    onChange={(e) =>
                      settings.set({ velocity: +e.target.value })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={manualTranspose}
                    onChange={(e) => setManualTranspose(e.target.checked)}
                  />
                  手動演奏套用轉調
                </label>
                <p>
                  電腦鍵盤不提供觸鍵速度；此處調整固定力度。取樣下載需網路連線。
                </p>
                <button
                  onClick={() =>
                    void engine.ready().catch((e) => setStatus(e.message))
                  }
                >
                  {audio} · 啟動 / 重試
                </button>
                <button onClick={panic}>釋放所有聲音</button>
              </>
            ) : (
              <>
                <p>音軌名稱來自原始檔案；不推測左右手。</p>
                {song?.tracks.map((t, i) => (
                  <label className="setting-line" key={i}>
                    <span>
                      <i
                        style={{
                          color: ["#c9b788", "#85b5a7", "#99a9cf"][i % 3],
                        }}
                      >
                        ●
                      </i>{" "}
                      {t}
                    </span>
                    <input
                      type="checkbox"
                      checked={!muted.includes(i)}
                      onChange={() => {
                        setMuted((m) =>
                          m.includes(i) ? m.filter((v) => v !== i) : [...m, i],
                        );
                        resetPractice();
                      }}
                    />
                    播放
                  </label>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
