import { PianoLid } from "./components/PianoLid";
import { RecordingIndicator } from "./components/RecordingIndicator";
import { recorder } from "./audio/LiveRecorder";
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
import { Roll } from "./components/Visuals";
import { PersistentSheetHost } from "./components/PersistentSheetHost";
import { MobilePerformanceControls } from "./components/MobilePerformanceControls";
import { engine } from "./audio/PianoEngine";
import { player } from "./audio/PlaybackScheduler";
import { useSettings } from "./store";
import { useStageOrientation } from "./hooks/useStageOrientation";
import { useFocusView } from "./hooks/useFocusView";
import { useKeyboardOnly } from "./hooks/useKeyboardOnly";
import { useDeferredMount } from "./hooks/useDeferredMount";
import { useVisualPreferences } from "./hooks/useVisualPreferences";
import { useLidHint } from "./hooks/useLidHint";
import { shouldIgnorePianoShortcut } from "./music/shortcutTarget";
import { readLastSong, rememberPosition, rememberSong } from "./library/songLibrary";
import { toStage } from "./stage/toStage";
import { mobileToolHeight } from "./stage/mobileToolHeight";
import { StageSlider } from "./components/StageSlider";
import { StageSegmented, StageStepper } from "./components/StageControls";
import {
  decodePracticeShare,
  describePracticeShare,
  advanceWaitStep,
  encodePracticeShare,
  normalizeLoopRange,
  readSongPreferences,
  selectLoopNotes,
  songPreferenceId,
  writeSongPreferences,
  type SongPracticePreferences,
} from "./practice/songPreferences";
import { isAutomaticNote, type AutoPolicy } from "./practice/handSplit";
import { applyIfCurrent, createCoalescedLoader } from "./music/defaultSongLoader";
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
  validateHymnal,
} from "./music/importers";
import {
  Settings2,
  Volume2,
  Sun,
  Maximize2,
  Upload,
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat2,
  ChevronDown,
  Music2,
  Headphones,
  X,
  Minimize2,
} from "lucide-react";
const GITHUB_URL = "https://github.com/dan40912/virtual-piano";
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
const LazyKeyboardMappingPanel = lazy(async () => ({
  default: (await import("./components/KeyboardMappingPanel")).KeyboardMappingPanel,
}));
const LazySoundTools = lazy(async () => ({
  default: (await import("./components/SoundTools")).SoundTools,
}));
const LazySongImportTools = lazy(async () => ({
  default: (await import("./components/SongImportTools")).SongImportTools,
}));

function PlaybackProgress({
  duration,
  onSeek,
  rotate,
  loop,
  loopA,
  loopB,
  onLoopA,
  onLoopB,
}: {
  duration: number;
  onSeek: (position: number) => void;
  rotate: boolean;
  loop: boolean;
  loopA: number;
  loopB: number;
  onLoopA: (position: number) => void;
  onLoopB: (position: number) => void;
}) {
  const position = useSyncExternalStore(
    player.subscribePosition,
    player.getPositionSnapshot,
    player.getPositionSnapshot,
  );
  return (
    <div className="timeline">
      <span>{clock(position)}</span>
      <StageSlider
        aria-label="播放進度"
        min={0}
        max={duration || 1}
        step={0.01}
        value={position}
        onChange={onSeek}
        rotate={rotate}
        markers={loop ? [
          { id: "A", label: "循環起點 A", value: loopA, onChange: onLoopA },
          { id: "B", label: "循環終點 B", value: loopB, onChange: onLoopB },
        ] : []}
      />
      <span>{clock(duration)}</span>
    </div>
  );
}

export default function App() {
  const settings = useSettings();
  useVisualPreferences();
  const lidHint = useLidHint();
  const appRef = useRef<HTMLDivElement>(null);
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const [lidOpen, setLidOpen] = useState(false);
  const mobilePianoExpanded =
    settings.mobileStageLayout === "performance" ||
    (settings.mobileStageLayout === "auto" &&
      window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches);
  const mobileScoreShown = lidOpen && settings.mobileScoreVisible && !mobilePianoExpanded;
  const [stage, setStage] = useState<"poster" | "playing">("poster");
  const [isRecording, setIsRecording] = useState(false);
  const [urlInputActive, setUrlInputActive] = useState(false);
  const keyboardOnly = useKeyboardOnly();
  const { rotate, fullscreen } = useStageOrientation(
    stage,
    urlInputActive || keyboardOnly.active,
    settings.mobileOrientation,
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const stageHeight = rotate ? window.innerWidth : window.innerHeight;
  const focusCompact = rotate || window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
  const focusKeyboardHeight = Math.max(
    110,
    Math.min(250, stageHeight * (focusCompact ? 0.42 : window.innerWidth < 768 ? 0.32 : 0.25)),
  );
  const [lidTab, setLidTab] = useState("stand");
  const songImportRequested = lidOpen && lidTab === "stand";
  const songImportMounted = useDeferredMount(songImportRequested);
  const soundToolsRequested = useDeferredMount(lidTab === "sound");
  const [moreControlsOpen, setMoreControlsOpen] = useState(false);
  const [modeNotice, setModeNotice] = useState("");
  const [immersive, setImmersive] = useState(false);
  const [scorePaperRequested, setScorePaperRequested] = useState(false);
  const [recordingRequested, setRecordingRequested] = useState(false);
  const [splitRatio, setSplitRatio] = useState(settings.mobileScoreSplit);
  const splitRatioRef = useRef(settings.mobileScoreSplit);
  const splitDrag = useRef<{
    pointerId: number;
    startY: number;
    startRatio: number;
  } | null>(null);
  useEffect(() => {
    useSettings.getState().set({ theme: "dark" });
  }, []);
  useEffect(() => {
    if (!lastSong.current) return;
    player.setPosition(lastSong.current.position);
    setViewPosition(lastSong.current.position);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.rotate = rotate ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.rotate;
    };
  }, [rotate]);
  useEffect(() => {
    if (!modeNotice) return;
    const timer = window.setTimeout(() => setModeNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [modeNotice]);
  const lastSong = useRef<ReturnType<typeof readLastSong> | undefined>(undefined);
  if (lastSong.current === undefined) lastSong.current = readLastSong();
  const songRef = useRef<Song | null>(lastSong.current?.song || null);
  const [song, setSong] = useState<Song | null>(songRef.current);
  songRef.current = song;
  const songChoiceVersion = useRef(0);
  const defaultSongLoader = useRef<(() => Promise<Song>) | null>(null);
  if (!defaultSongLoader.current) {
    defaultSongLoader.current = createCoalescedLoader(async () =>
      (await import("./music/defaultSong")).defaultSong,
    );
  }
  const explicitDefaultLoad = useRef<{ promise: Promise<void>; version: number } | null>(null);
  const [defaultSongLoading, setDefaultSongLoading] = useState(false);
  const originalComparison = useRef<{
    song: Song;
    preferences: SongPracticePreferences;
    mode: string;
    practiceType: string;
    position: number;
  } | null>(null);
  const restoredPreferenceId = useRef("");
  const skipPreferenceWrite = useRef(false);
  const [shareNotice, setShareNotice] = useState("");
  const [playing, setPlaying] = useState(false);
  const [viewPosition, setViewPosition] = useState(lastSong.current?.position || 0);
  const [speed, setSpeed] = useState(1),
    [transpose, setTranspose] = useState(0),
    [mode, setMode] = useState("auto"),
    [practiceType, setPracticeType] = useState("rhythm"),
    [tolerance, setTolerance] = useState(0.2);
  const feedbackTracking = playing && mode === "practice" && practiceType === "rhythm";
  const position = feedbackTracking ? viewPosition : player.position;
  useEffect(() => {
    if (!feedbackTracking) return;
    const timer = window.setInterval(() => setViewPosition(player.position), 100);
    return () => window.clearInterval(timer);
  }, [feedbackTracking]);
  const [muted, setMuted] = useState<number[]>([]),
    [autoPolicy, setAutoPolicy] = useState<
      Record<number, AutoPolicy>
    >({
      0: "bass",
    }),
    [splitPitch, setSplitPitch] = useState(60),
    [loop, setLoop] = useState(false),
    [loopA, setLoopA] = useState(0),
    [loopB, setLoopB] = useState(lastSong.current?.song.duration || 0),
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
    [pendingBinding, setPendingBinding] = useState<string | null>(null),
    [bindingConflict, setBindingConflict] = useState<{ code: string; midi: number; occupied: number } | null>(null),
    [warning, setWarning] = useState(""),
    [view, setView] = useState("roll"),
    [zoom, setZoom] = useState(65),
    [rollExpanded, setRollExpanded] = useState(true),
    [manualTranspose, setManualTranspose] = useState(false),
    [profile, setProfile] = useState("我的配置");
  const focusView = useFocusView({
    lidTab,
    lidOpen,
    visualView: view,
    setLidOpen,
    setLidTab,
    setVisualView: setView,
  });
  const [focusMoreOpen, setFocusMoreOpen] = useState(false);
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
  useEffect(() => {
    if (mode !== "practice" || practiceType !== "wait") return;
    waitHeld.current.clear();
    setStep(0);
  }, [mode, practiceType, song, muted, transpose, loop, loopA, loopB]);
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
  const waitGroups = useMemo(
    () => selectLoopNotes(groupList, loop, loopA, loopB),
    [groupList, loop, loopA, loopB],
  );
  const [loopSelectionArmed, setLoopSelectionArmed] = useState(false);
  const currentPreferences = (): SongPracticePreferences => ({
    speed,
    transpose,
    loop,
    loopA,
    loopB,
    muted,
    autoPolicy,
    splitPitch,
  });
  const applyPreferences = (preferences: SongPracticePreferences) => {
    setSpeed(preferences.speed);
    setTranspose(preferences.transpose);
    setLoop(preferences.loop);
    setLoopA(preferences.loopA);
    setLoopB(preferences.loopB);
    setMuted(preferences.muted);
    setAutoPolicy(preferences.autoPolicy);
    setSplitPitch(preferences.splitPitch);
  };
  useEffect(() => {
    if (!song) {
      restoredPreferenceId.current = "";
      return;
    }
    const id = songPreferenceId(song);
    if (restoredPreferenceId.current === id) return;
    const shareValue = new URLSearchParams(window.location.search).get("practice");
    const shared = shareValue ? decodePracticeShare(shareValue, song) : null;
    const preferences = shared || readSongPreferences(song);
    if (preferences) {
      skipPreferenceWrite.current = true;
      applyPreferences(preferences);
    }
    if (shared && shareValue) {
      setShareNotice("已驗證並套用分享的練習設定；連結不含歌曲檔案。");
      const url = new URL(window.location.href);
      url.searchParams.delete("practice");
      window.history.replaceState({}, "", url.toString());
    } else if (shareValue) {
      const sharedInfo = describePracticeShare(shareValue);
      setShareNotice(sharedInfo
        ? `分享設定適用於「${sharedInfo.title}」；請自行載入相同曲目後套用。${sharedInfo.sourceUrl ? ` 來源：${sharedInfo.sourceUrl}` : ""}`
        : "分享設定無效，已略過。");
    }
    restoredPreferenceId.current = id;
  }, [song]);
  useEffect(() => {
    if (!song || restoredPreferenceId.current !== songPreferenceId(song)) return;
    if (skipPreferenceWrite.current) {
      skipPreferenceWrite.current = false;
      return;
    }
    writeSongPreferences(song, currentPreferences());
  }, [song, speed, transpose, loop, loopA, loopB, muted, autoPolicy, splitPitch]);
  useEffect(() => {
    splitRatioRef.current = settings.mobileScoreSplit;
    setSplitRatio(settings.mobileScoreSplit);
  }, [settings.mobileScoreSplit]);
  const expected = useMemo(
    () =>
      mode === "practice" && practiceType === "wait"
        ? (waitGroups[step] || []).map((n) => n.midi + transpose)
        : [],
    [mode, practiceType, waitGroups, step, transpose],
  );
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
    if (songRef.current) rememberPosition(songRef.current, player.position);
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
    const startAt = mode === "practice" && practiceType === "wait" && loop ? loopA : player.position;
    practiceStart.current = startAt;
    previousPosition.current = startAt;
    setStep(
      Math.max(
        0,
        waitGroups.findIndex((g) => g[0].startTime >= startAt),
      ),
    );
    hit.current.clear();
    waitHeld.current.clear();
    setScore({ correct: 0, wrong: 0, offset: 0 });
  };
  const markSongChoice = () => {
    songChoiceVersion.current++;
    setDefaultSongLoading(false);
  };
  const load = (s: Song, targetMode: "auto" | "practice" | "accompaniment" = "practice", resumeAt = 0, keepComparison = false) => {
    markSongChoice();
    if (!keepComparison) originalComparison.current = null;
    if (songRef.current) rememberPosition(songRef.current, player.position);
    stop();
    const id = songPreferenceId(s);
    const stored = readSongPreferences(s);
    const shareValue = new URLSearchParams(window.location.search).get("practice");
    const shared = shareValue ? decodePracticeShare(shareValue, s) : null;
    const preferences = shared || stored;
    if (preferences) applyPreferences(preferences);
    else {
      setSpeed(1);
      setTranspose(0);
      setLoop(false);
      setLoopA(0);
      setLoopB(s.duration);
      setMuted([]);
      setAutoPolicy(Object.fromEntries(s.tracks.map((_, i) => [i, s.tracks.length === 1 ? "bass" : "all"])));
    }
    restoredPreferenceId.current = id;
    setSong(s);
    setView("roll");
    setRollExpanded(true);
    setMode(targetMode);
    if (targetMode === "practice") setPracticeType("rhythm");
    const resumePosition = Math.max(0, Math.min(s.duration, resumeAt));
    const resumeGroups = groups(s, preferences?.muted || []);
    setStep(Math.max(0, resumeGroups.findIndex((group) => group[0].startTime >= resumePosition)));
    hit.current.clear();
    practiceStart.current = resumePosition;
    previousPosition.current = resumePosition;
    player.setPosition(resumePosition);
    setViewPosition(resumePosition);
    setScore({ correct: 0, wrong: 0, offset: 0 });
    if (shared) {
      setShareNotice("已驗證並套用分享的練習設定；連結不含歌曲檔案。");
      const url = new URL(window.location.href);
      url.searchParams.delete("practice");
      window.history.replaceState({}, "", url.toString());
    } else if (shareValue) {
      const sharedInfo = describePracticeShare(shareValue);
      setShareNotice(sharedInfo
        ? `分享設定適用於「${sharedInfo.title}」；請先載入相同曲目。${sharedInfo.sourceUrl ? ` 來源：${sharedInfo.sourceUrl}` : ""}`
        : "分享設定無效，已略過。");
    }
    let libraryNote = "";
    try { rememberSong(s, resumePosition); }
    catch (error) { libraryNote = ` · ${(error as Error).message}`; }
    setStatus(`${s.title} · ${s.notes.length} 個音符，解析成功${libraryNote}`);
  };
  const loadDefaultSong = (
    requestedMode: "auto" | "practice" | "accompaniment" = "practice",
  ) => {
    if (explicitDefaultLoad.current?.version === songChoiceVersion.current)
      return explicitDefaultLoad.current.promise;
    markSongChoice();
    const requestVersion = songChoiceVersion.current;
    setDefaultSongLoading(true);
    setStatus("正在載入預設練習曲…");
    const request = applyIfCurrent(
      defaultSongLoader.current!,
      () => songChoiceVersion.current === requestVersion,
      (defaultSong) => load(defaultSong, requestedMode),
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        if (songChoiceVersion.current === requestVersion) {
          const message = error instanceof Error ? error.message : "未知錯誤";
          setStatus(`預設曲載入失敗：${message}。請再按「載入預設曲」重試。`);
        }
      })
      .finally(() => {
        if (songChoiceVersion.current === requestVersion) setDefaultSongLoading(false);
        if (explicitDefaultLoad.current?.promise === request) explicitDefaultLoad.current = null;
      });
    explicitDefaultLoad.current = { promise: request, version: requestVersion };
    return request;
  };
  const restoreOriginalComparison = () => {
    const original = originalComparison.current;
    if (!original) return;
    originalComparison.current = null;
    load(original.song, original.mode as "auto" | "practice" | "accompaniment", original.position);
    applyPreferences(original.preferences);
    restoredPreferenceId.current = songPreferenceId(original.song);
    setPracticeType(original.practiceType);
    setShareNotice("已返回原曲並恢復練習設定。");
  };
  const playRecording = async (recording: Song) => {
    if (song && recording.source.startsWith("本機") && !originalComparison.current) {
      originalComparison.current = {
        song,
        preferences: currentPreferences(),
        mode,
        practiceType,
        position: player.position,
      };
    }
    load(recording, "auto", 0, true);
    const token = playToken.current;
    try {
      await engine.ready();
      if (token !== playToken.current) return;
      engine.settings(settings.volume, settings.reverb, settings.pianoStyle);
      player.silent = false;
      player.muted = [];
      player.noteFilter = null;
      player.start(recording);
      setPlaying(true);
      setStatus(`正在播放錄音 · ${recording.notes.length} 個音符`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  const down = (id: string, base: number, inputVelocity = settings.velocity) => {
    const inputStarted = performance.now();
    if (pressed.current.has(id)) return;
    const n = base + (manualTranspose ? transpose : 0);
    if (n < 21 || n > 108) {
      setStatus("此音符超出 A0–C8 音域");
      return;
    }
    if (stage === "poster" && !id.startsWith("preview:")) startStage();
    pressed.current.set(id, n);
    if (!lidOpen && !id.startsWith("preview:")) lidHint.noteAttacked();
    if (!id.startsWith("preview:")) recorder.attack(id, n, inputVelocity);
    waitHeld.current.add(n);
    refresh();
    const attackManual = () => {
      if (pressed.current.get(id) !== n) return;
      engine.attack(id, n, inputVelocity);
      if (import.meta.env.DEV) {
        console.debug("Manual piano input → attack", JSON.stringify({
          elapsedMs: Number((performance.now() - inputStarted).toFixed(2)),
          ...engine.audioLatency(),
        }));
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
        const group = waitGroups[step] || [];
        if (!group.length) {
          setStatus("等待練習已完成；按『重新練習』可再彈一次。");
        } else if (group.some((a) => a.midi + transpose === n)) {
          if (group.every((a) => waitHeld.current.has(a.midi + transpose))) {
            setScore((s) => ({ ...s, correct: s.correct + group.length }));
            player.setPosition(group[0].startTime);
            const progress = advanceWaitStep(step, waitGroups.length, loop);
            setStep(progress.step);
            if (progress.wrapped) {
              player.setPosition(loopA);
              setViewPosition(loopA);
            } else if (progress.complete) setStatus("等待練習完成；按『重新練習』可再彈一次。");
          }
        } else setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      } else if (player.playing) {
        const candidates = song.notes
          .filter(
            (a) =>
              !muted.includes(a.trackId) &&
              (mode !== "accompaniment" ||
                !isAutomaticNote(autoPolicy[a.trackId], a.midi + transpose, splitPitch)) &&
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
    (id: string, midi: number, velocity?: number) => void downRef.current(id, midi, velocity),
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
          console.debug("Piano audio context latency", JSON.stringify(engine.audioLatency()));
      })
      .catch((e) => {
        audioPrimed.current = false;
        setStatus(e.message);
      });
  }, []);
  const startStage = (intent: "free" | "load" = "free") => {
    if (stage !== "poster") return;
    // Call ready before any await so the first touch unlocks audio on mobile.
    primeAudio();
    setStage("playing");
    if (intent === "free") {
      markSongChoice();
      stop();
      songRef.current = null;
      setSong(null);
      setMode("auto");
      setStatus("自由演奏已就緒；掀開琴蓋可載入歌曲練習。");
    } else {
      lidHint.dismiss();
      setLidTab("stand");
      setLidOpen(true);
      if (!songRef.current)
        void loadDefaultSong(mode as "auto" | "practice" | "accompaniment");
    }
  };
  const enterFocusView = () => {
    focusView.enter();
    setFocusMoreOpen(false);
  };
  const leaveFocusView = () => {
    focusView.exit();
    setFocusMoreOpen(false);
  };
  const openLid = () => {
    lidHint.dismiss();
    setLidOpen(true);
  };
  const toggleMobileScore = () => {
    if (mobileScoreShown) {
      settings.set({ mobileScoreVisible: false });
      return;
    }
    settings.set({ mobileScoreVisible: true, mobileStageLayout: "score" });
    setLidTab("stand");
    if (!lidOpen) openLid();
  };
  const toggleMobilePlayback = () =>
    settings.set({ mobilePlaybackVisible: !useSettings.getState().mobilePlaybackVisible });
  const leaveStage = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Stage exit still proceeds if the browser already left fullscreen.
      }
    }
    setImmersive(false);
    setLidOpen(false);
    setStage("poster");
  };
  const noteIsAuto = useCallback(
    (note: Note) => {
      if (mode !== "accompaniment") return true;
      const policy = autoPolicy[note.trackId];
      return isAutomaticNote(policy, note.midi + transpose, splitPitch);
    },
    [mode, autoPolicy, transpose, splitPitch],
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
        engine.sustain(false, undefined, "manual");
        recorder.pedal(engine.pedal);
        setPedal(engine.pedal);
      }
    };
    const on = (e: KeyboardEvent) => {
      if (e.code === "Escape" && panel) {
        if (panel === "keyboard" && bindingConflict) {
          setBindingConflict(null);
          setWarning("已取消取代，原綁定保留");
          return;
        }
        if (panel === "keyboard" && selected !== null) {
          setSelected(null);
          setPendingBinding(null);
          setWarning("已取消快速綁定");
          return;
        }
        setPanel("");
        setSelected(null);
        setPendingBinding(null);
        return;
      }
      if (e.repeat || e.code.startsWith("Shift")) return;
      const code = keyboardBinding(e);
      if (shouldIgnorePianoShortcut(e.target, e.key)) return;
      const focusNeedsShift = Boolean(
        settings.mapping.KeyF !== undefined || settings.chordMapping.KeyF,
      );
      const desktopKeyboard = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      if (
        e.code === "KeyF" &&
        panel === "" &&
        selected === null &&
        desktopKeyboard &&
        e.shiftKey === focusNeedsShift
      ) {
        e.preventDefault();
        enterFocusView();
        return;
      }
      if (panel === "keyboard" && pendingBinding !== null) {
        e.preventDefault();
        return;
      }
      if (panel === "keyboard" && selected !== null) {
        e.preventDefault();
        if (["Escape", "Tab"].includes(e.code)) return;
        bindShortcut(code, selected);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === settings.pedal) {
        e.preventDefault();
        engine.sustain(true, undefined, "manual");
        recorder.pedal(engine.pedal);
        setPedal(engine.pedal);
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
      } else if (validShortcut(code) && panel === "") {
        e.preventDefault();
        setPendingBinding(code);
        setSelected(null);
        setPanel("keyboard");
        setWarning(`${shortcutLabel(code)} 尚未綁定，請點選要指定的琴鍵。`);
      }
    };
    const blur = () => {
      for (const id of [...pressed.current.keys()]) release(id);
      waitHeld.current.clear();
      engine.sustain(false, undefined, "manual");
      recorder.pedal(engine.pedal);
      setPedal(engine.pedal);
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
    pendingBinding,
    bindingConflict,
    release,
    panic,
    settings.mapping,
    settings.chordMapping,
    enterFocusView,
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
      setPedal(engine.pedal);
      if (songRef.current) rememberPosition(songRef.current, player.position);
    };
    return () => {
      playToken.current++;
      clearTimeout(previewTimer.current);
      player.stop();
    };
  }, []);
  useEffect(() => {
    const checkpoint = () => {
      if (songRef.current) rememberPosition(songRef.current, player.position);
    };
    window.addEventListener("beforeunload", checkpoint);
    return () => window.removeEventListener("beforeunload", checkpoint);
  }, []);
  const play = async (requestedMode = mode) => {
    if (!song) {
      setStatus(defaultSongLoading
        ? "預設練習曲仍在載入，請稍後再播放；也可匯入自己的曲目。"
        : "目前沒有已載入的曲目；請載入預設曲或匯入曲目。",
      );
      return;
    }
    const token = ++playToken.current;
    if (requestedMode === "practice" && practiceType === "wait") {
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
      player.silent = requestedMode === "practice";
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
    const target = mode === "practice" && practiceType === "wait" && loop && p >= loopB ? loopA : p;
    previousPosition.current = target;
    practiceStart.current = target;
    player.setPosition(target);
    setViewPosition(target);
    if (songRef.current) rememberPosition(songRef.current, target);
    if (player.playing && song) player.start(song);
    if (mode === "practice") {
      const nextGroup = waitGroups.findIndex((group) => group[0].startTime >= target);
      setStep(
        Math.max(
          0,
          nextGroup < 0 ? waitGroups.length : nextGroup,
        ),
      );
      hit.current.clear();
      setScore({ correct: 0, wrong: 0, offset: 0 });
    }
  };
  const importFile = async (f: File) => {
    markSongChoice();
    setLoading(true);
    try {
      if (f.size > 20 * 1024 * 1024) throw Error("檔案上限 20 MB");
      let importedSong: Song;
      if (/\.(xml|musicxml)$/i.test(f.name)) {
        const { parseMusicXml } = await import("./music/MusicXml");
        importedSong = parseMusicXml(await f.text(), f.name);
      } else {
        importedSong = await parseMidi(await f.arrayBuffer(), f.name);
      }
      load(importedSong);
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
    markSongChoice();
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
  const shownMap = useMemo(
    () => Object.fromEntries(Object.entries(settings.mapping).map(([k, n]) => [k, n + settings.octave * 12])),
    [settings.mapping, settings.octave],
  );
  const bindShortcut = (code: string, midi: number, replace = false) => {
    setBindingConflict(null);
    if (!validShortcut(code)) {
      setWarning("請使用字母、數字或符號鍵");
      return;
    }
    if (code === settings.pedal) {
      setWarning("此按鍵已設定為延音踏板");
      return;
    }
    const map = { ...settings.mapping };
    const occupied = map[code];
    if (occupied !== undefined && occupied !== midi && !replace) {
      setBindingConflict({ code, midi, occupied });
      setWarning("");
      return;
    }
    for (const key in map) if (map[key] === midi) delete map[key];
    map[code] = midi;
    settings.set({ mapping: map });
    setWarning(`${shortcutLabel(code)} → ${noteName(midi)} 已儲存`);
    setSelected(null);
    setPendingBinding(null);
    setBindingConflict(null);
  };
  const pendingBindingRef = useRef(pendingBinding);
  pendingBindingRef.current = pendingBinding;
  const bindShortcutRef = useRef(bindShortcut);
  bindShortcutRef.current = bindShortcut;
  const selectMappingNote = useCallback((midi: number) => {
    setBindingConflict(null);
    const pending = pendingBindingRef.current;
    if (pending) {
      bindShortcutRef.current(pending, midi);
      return;
    }
    setSelected(midi);
    setWarning(`已選 ${noteName(midi)}。現在按下要綁定的電腦按鍵；按 Esc 可取消。`);
  }, []);
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
  const missedNotes =
    mode === "practice" && practiceType === "rhythm"
      ? considered.filter(
          (n) => n.startTime < position - tolerance && !hit.current.has(n.id),
        )
      : [];
  const missed = missedNotes.length;
  const missedPitch = [...missedNotes.reduce((counts, note) => counts.set(note.midi, (counts.get(note.midi) || 0) + 1), new Map<number, number>())]
    .sort((a, b) => b[1] - a[1])[0];
  const missedWindow = [...missedNotes.reduce((counts, note) => {
    const start = Math.floor(note.startTime / 4) * 4;
    counts.set(start, (counts.get(start) || 0) + 1);
    return counts;
  }, new Map<number, number>())].sort((a, b) => b[1] - a[1])[0];
  const bpm = song
    ? [...(song.tempos.length ? song.tempos : [{ time: 0, bpm: song.tempo }])]
        .reverse()
        .find((t) => t.time <= position)?.bpm || song.tempo
    : 100;
  const hasMiniPlayback = Boolean(song && stage === "playing" && !lidOpen);
  const setLoopAFromPosition = (next: number) =>
    setLoopA(Math.max(0, Math.min(loopB - 0.1, next)));
  const setLoopBFromPosition = (next: number) =>
    setLoopB(Math.max(loopA + 0.1, Math.min(song?.duration || 1, next)));
  const selectLoopRange = (a: number, b: number) => {
    if (!song) return;
    const range = normalizeLoopRange(a, b, song.duration);
    setLoopA(range.a);
    setLoopB(range.b);
    setLoop(true);
    setLoopSelectionArmed(false);
    setShareNotice(`已設定 Piano Roll 循環 ${clock(range.a)}–${clock(range.b)}。`);
  };
  const sharePractice = async () => {
    if (!song) return;
    const url = new URL(window.location.href);
    url.searchParams.set("practice", encodePracticeShare(song, currentPreferences()));
    const shareUrl = url.toString();
    setShareNotice(shareUrl);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice("練習設定連結已複製；曲目檔案不會包含在連結中。接收者需自行載入相同曲目。");
    } catch { /* Keep the visible URL available for manual copying. */ }
  };
  const playbackBar = (
          <div
            className={`player ${moreControlsOpen ? "more-controls-open" : ""} ${!lidOpen && hasMiniPlayback ? "player-mini" : ""}`}
            data-visible={song && (lidOpen || hasMiniPlayback) ? "true" : "false"}
          >
            <div className="playback-heading">
              <button
                type="button"
                className="focus-entry"
                aria-label="進入專注練習"
                title={`專注練習（${settings.mapping.KeyF !== undefined || settings.chordMapping.KeyF ? "Shift+F" : "F"}）`}
                onClick={enterFocusView}
              >
                <Maximize2 size={14} /> 專注練習
              </button>
              <strong>{song?.title || "自由演奏"}</strong>
              <button
                type="button"
                className="player-more-toggle"
                aria-expanded={moreControlsOpen}
                onClick={() => setMoreControlsOpen((open) => !open)}
              >
                <Settings2 size={15} /> {moreControlsOpen ? "收起設定" : "播放設定"}
              </button>
            </div>
            <PlaybackProgress
              duration={song?.duration || 0}
              onSeek={seek}
              rotate={rotate}
              loop={loop}
              loopA={loopA}
              loopB={loopB}
              onLoopA={setLoopAFromPosition}
              onLoopB={setLoopBFromPosition}
            />
            <div className="transport-row">
              <div className="transport">
                <button
                  title="重播"
                  aria-label="重播"
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
                  disabled={!song}
                  onClick={() => {
                    if (playing) {
                      if (songRef.current) rememberPosition(songRef.current, player.position);
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
                <button title="停止" aria-label="停止" onClick={stop}>
                  <Square size={17} />
                </button>
                <span className="separator" />
                <button
                  className={loop ? "enabled" : ""}
                  title="循環"
                  aria-label="循環"
                  aria-pressed={loop}
                  onClick={() => setLoop(!loop)}
                >
                  <Repeat2 size={18} />
                </button>
              </div>
              <div className="playback-settings">
                <label>
                  速度{" "}
                  <StageStepper label="速度倍率" value={speed} min={0.25} max={2} step={0.05} onChange={setSpeed} format={(n) => `${n.toFixed(2)}×`} />
                </label>
                <label>
                  轉調{" "}
                  <StageStepper label="轉調" value={transpose} min={-12} max={12} step={1} onChange={setTranspose} format={(n) => `${n > 0 ? "+" : ""}${n} 半音`} />
                </label>
                <span className="separator" />
                <Volume2 size={16} />
                <StageSlider className="playback-volume" aria-label="音量" min={0} max={1} step={0.01} value={settings.volume} onChange={(volume) => settings.set({ volume })} rotate={rotate} />
                <span>{Math.round(settings.volume * 100)}%</span>
              </div>
              <div className="toggles">
                <button
                  className={metro ? "enabled" : ""}
                  aria-label="節拍器"
                  aria-pressed={metro}
                  onClick={() => setMetro(!metro)}
                >
                  ♩ <span>節拍器</span>
                </button>
                <button
                  className={pedalVisible ? "enabled" : ""}
                  aria-label="延音"
                  aria-pressed={pedalVisible}
                  onClick={() => {
                    engine.sustain(!engine.pedals.has("manual"), undefined, "manual");
                    recorder.pedal(engine.pedal);
                    setPedal(engine.pedal);
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
                <button type="button" onClick={() => setLoopAFromPosition(player.position)}>設為 A · {clock(loopA)}</button>
                <button type="button" onClick={() => setLoopBFromPosition(player.position)}>設為 B · {clock(loopB)}</button>
                <span>拖曳進度條上的 A／B 標記可微調循環範圍</span>
              </div>
            )}
          </div>
  );

  return (
    <div
      ref={appRef}
      className={`app ${immersive ? "immersive-mode" : ""}`}
      data-stage={stage}
      data-view={focusView.active ? "focus" : "studio"}
      data-lid={lidOpen ? "open" : "closed"}
      data-mobile-piano-expanded={mobilePianoExpanded ? "true" : "false"}
      data-keyboard-only={keyboardOnly.active ? "true" : "false"}
      data-mobile-score-visible={settings.mobileScoreVisible ? "true" : "false"}
      data-mobile-playback-visible={settings.mobilePlaybackVisible ? "true" : "false"}
      data-rotate={rotate ? "true" : "false"}
      data-lid-tab={lidTab}
      data-chord-enabled={settings.chordEnabled ? "true" : "false"}
      data-url-input={urlInputActive ? "true" : "false"}
      onPointerDownCapture={(event) => {
        if (
          stage === "poster" &&
          event.target instanceof Element &&
          Boolean(event.target.closest("[data-stage-start]"))
        ) startStage(event.target.closest(".stage-load-song") ? "load" : "free");
        primeAudio();
      }}
      onKeyDownCapture={primeAudio}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) void importFile(e.dataTransfer.files[0]);
      }}
    >
      <div
        className="stage"
        ref={stageRef}
        style={{
          "--stage-height": `${stageHeight}px`,
          "--stage-width": `${rotate ? window.innerHeight : window.innerWidth}px`,
        } as CSSProperties}
      >
      <header>
        <div className="header-status" role="status" aria-label={modeNotice || (defaultSongLoading ? "正在載入預設練習曲" : `音源狀態：${audio}`)}>
          <span className={`audio-status-dot ${audio.includes("已就緒") ? "ready" : ""}`} />
          <span>{modeNotice || (defaultSongLoading ? "準備預設曲…" : audio.includes("已就緒") ? "音源就緒" : audio.includes("載入") ? "載入中" : audio)}</span>
        </div>
        <nav>
          {stage === "playing" && (
            <button
              type="button"
              className="orientation-toggle"
              aria-pressed={settings.mobileOrientation === "landscape"}
              aria-label={settings.mobileOrientation === "landscape" ? "使用直向演奏版面" : "使用橫向演奏版面"}
              title="版面方向可隨時切換，不會停止播放"
              onClick={() => {
                const next = settings.mobileOrientation === "landscape" ? "portrait" : "landscape";
                settings.set({ mobileOrientation: next });
                setModeNotice(next === "landscape" ? "已切換橫向演奏版面；點擊方向按鈕可切回直向。" : "已切回直向版面。播放進度保持不變。");
              }}
            >
              {settings.mobileOrientation === "landscape" ? "直向" : "橫向演奏"}
            </button>
          )}
          <button
            aria-label={immersive || fullscreen ? "離開全螢幕" : "全螢幕"}
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
            {immersive || fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
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
      {(rotate || fullscreen || immersive) && stage === "playing" && (
        <button
          type="button"
          className="stage-leave"
          aria-label="離開演奏"
          onClick={() => void leaveStage()}
        >
          <X size={15} /> <span>離開</span>
        </button>
      )}
      <main>
        <section
          className="studio"
          style={
            {
              "--mobile-score-height": `${splitRatio * stageHeight}px`,
              "--mobile-piano-height": `${(1 - splitRatio) * stageHeight}px`,
              // Reserve 44px for the handle, 24px for the splitter, 44px for playback,
              // and 110px for the minimum keyboard deck. Chords reserve 38px above it.
              "--mobile-tool-height": `${mobileToolHeight(stageHeight, splitRatio, settings.chordEnabled && lidTab === "chord" ? 38 : 0)}px`,
              "--focus-keyboard-height": `${focusKeyboardHeight}px`,
            } as CSSProperties
          }
        >
          <div className="stage-prompt" data-stage-start>
            <button type="button" onClick={() => startStage("free")}>直接彈奏</button>
            <button type="button" className="stage-load-song" onClick={() => startStage("load")}>
              <Upload size={14} /> 載入歌曲練習
            </button>
            <span>開啟鋼琴後可使用觸控、電腦鍵盤或外接 MIDI 鍵盤</span>
          </div>
          <div
            className={`focus-toolbar ${focusMoreOpen ? "focus-more-open" : ""}`}
            role="toolbar"
            aria-label="專注檢視工具列"
          >
            <button type="button" className="focus-leave" aria-label="離開專注模式" onClick={leaveFocusView}>
              <span aria-hidden="true">←</span><span>離開</span>
            </button>
            <strong className="focus-song-title" title={song?.title || "即興演奏"}>
              {song?.title || "即興演奏"}
            </strong>
            <RecordingIndicator recording={isRecording} />
            <button
              type="button"
              className="focus-more-toggle"
              aria-label={focusMoreOpen ? "收起專注設定" : "專注設定"}
              aria-expanded={focusMoreOpen}
              onClick={() => setFocusMoreOpen((open) => !open)}
            >
              <Settings2 size={15} /><span>設定</span>
            </button>
            <div className="focus-more-controls">
              <div className="focus-mode-control">
                <span>模式</span>
                <StageSegmented
                  label="專注檢視模式"
                  value={mode}
                  options={[
                    { value: "auto", label: "自動" },
                    { value: "accompaniment", label: "伴奏" },
                    { value: "practice", label: "練習" },
                  ]}
                  onChange={(next) => setMode(next)}
                />
              </div>
              <label className="focus-speed-control">
                <span>速度 {Math.round(speed * 100)}%</span>
                <StageSlider aria-label="專注檢視速度" min={0.25} max={2} step={0.05} value={speed} onChange={setSpeed} rotate={rotate} />
              </label>
              {song && song.tracks.length > 1 && (
                <div className="focus-track-control" role="group" aria-label="音軌">
                  {song.tracks.map((trackName, index) => {
                    const enabled = !muted.includes(index);
                    return (
                      <button
                        type="button"
                        key={`${trackName}-${index}`}
                        aria-pressed={enabled}
                        title={trackName}
                        onClick={() => setMuted((current) => enabled ? [...current, index] : current.filter((track) => track !== index))}
                      >
                        {trackName}
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="focus-volume-control">
                <Volume2 size={15} aria-hidden="true" />
                <StageSlider aria-label="專注檢視音量" min={0} max={1} step={0.01} value={settings.volume} onChange={(volume) => settings.set({ volume })} rotate={rotate} />
              </label>
            </div>
            <button
              type="button"
              className="focus-play-toggle"
              disabled={!song}
              onClick={() => {
                if (playing) {
                  if (songRef.current) rememberPosition(songRef.current, player.position);
                  player.stop(false);
                  setPlaying(false);
                  setActive(new Set());
                } else void play();
              }}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
              <span>{playing ? "暫停" : "播放"}</span>
            </button>
            <button type="button" className="focus-restart" disabled={!song} onClick={() => { stop(); void play(); }}>
              <RotateCcw size={15} /> <span>重來</span>
            </button>
          </div>
          <PianoLid
            open={lidOpen}
            rotate={rotate}
            focusView={focusView.active}
            onToggle={() => {
              if (lidOpen) setLidOpen(false);
              else openLid();
            }}
            hintActive={lidHint.active && !lidOpen}
            hintPulse={lidHint.pulse}
            onHintDismiss={lidHint.dismiss}
            onHintOpen={() => {
              openLid();
            }}
            player={playbackBar}
            scoreVisible={mobileScoreShown}
            onScoreToggle={toggleMobileScore}
            playbackVisible={settings.mobilePlaybackVisible}
            onPlaybackToggle={toggleMobilePlayback}
            activeTab={lidTab}
            onTabChange={(id) => {
              if (id === "record") setRecordingRequested(true);
              setLidTab(id);
            }}
            tabs={[
              {
                id: "stand",
                label: "譜架",
                content: (
                  <div
                    className={`grand-workbench ${rollExpanded ? "roll-expanded" : ""}`}
                  >
                    <div className="stand-mode-controls" aria-label="演奏模式">
                      {([["auto", "自動"], ["accompaniment", "伴奏"], ["practice", "練習"]] as const).map(([id, label]) => (
                        <button key={id} className={mode === id ? "selected" : ""} aria-pressed={mode === id} onClick={() => {
                          if (mode === id) return;
                          stop();
                          resetPractice();
                          setMode(id);
                          setModeNotice("");
                        }}>{label}</button>
                      ))}
                      {mode === "practice" && <>
                        <StageSegmented label="練習方式" value={practiceType} options={[{ value: "wait", label: "等待正確音符" }, { value: "rhythm", label: "節奏練習" }]} onChange={(next) => { stop(); resetPractice(); setPracticeType(next); }} />
                        {practiceType === "rhythm" && <StageSegmented label="節奏容許誤差" value={tolerance} options={[{ value: 0.1, label: "±100ms" }, { value: 0.2, label: "±200ms" }, { value: 0.3, label: "±300ms" }]} onChange={setTolerance} />}
                      </>}
                    </div>
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
                        <label className="view-select-label">
                          顯示
                          <StageSegmented label="譜架內容" value={view} options={[{ value: "score", label: "琴譜" }, { value: "roll", label: "Piano Roll" }, { value: "sheet", label: "五線譜" }]} onChange={(next) => { if (next === "score") setScorePaperRequested(true); setView(next); }} />
                        </label>
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
                        <div className="roll-label" hidden={view !== "roll"}>
                              <span>
                                <i />
                                {manualFollow && modeNotice === "已切換到練習模式 · 手動跟彈"
                                  ? modeNotice
                                  : manualFollow
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
                                    setModeNotice("已切換到練習模式 · 手動跟彈");
                                    setStatus("已切換到練習模式 · 手動跟彈");
                                    setPracticeType("rhythm");
                                    resetPractice();
                                    setView("roll");
                                  }}
                                >
                                  {manualFollow ? "手動跟彈中" : "切換手動跟彈"}
                                </button>
                                <label>
                                  下落速度
                                    <StageSlider
                                    aria-label="Piano Roll 下落速度"
                                      min={30}
                                      max={130}
                                      step={1}
                                    value={zoom}
                                      onChange={setZoom}
                                      rotate={rotate}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={loopSelectionArmed ? "selected" : ""}
                                  aria-pressed={loopSelectionArmed}
                                  title="在音符區由上往下拖曳，選取循環 A 到 B"
                                  onClick={() => setLoopSelectionArmed((armed) => !armed)}
                                >
                                  {loopSelectionArmed ? "拖曳選取 A/B…" : "選取循環 A/B"}
                                </button>
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
                                <button
                                  type="button"
                                  className="roll-focus-entry"
                                  aria-label="進入專注練習"
                                  title={`專注練習（${settings.mapping.KeyF !== undefined || settings.chordMapping.KeyF ? "Shift+F" : "F"}）`}
                                  onClick={enterFocusView}
                                >
                                  <Maximize2 size={13} /> 專注練習
                                </button>
                              </div>
                        </div>
                        {view === "roll" && !song && (
                          <p className="empty-roll">
                            匯入歌曲，讓旋律躍然眼前。
                          </p>
                        )}
                        <PersistentSheetHost
                          visible={view === "sheet"}
                          song={song}
                          transpose={transpose}
                        />
                        {view === "sheet" && (!song?.xml || transpose !== 0) && (
                          <div className="notation-empty">
                            <Music2 size={30} />
                            <p>
                              {song && !song.xml
                                ? "MIDI 沒有五線譜。匯入 MusicXML 可顯示樂譜，或改用 Piano Roll。"
                                : transpose
                                  ? "轉調後請使用同步 Piano Roll"
                                  : "目前曲目沒有可顯示的五線譜。"}
                            </p>
                            {song && !song.xml ? (
                              <div className="notation-actions">
                                <button onClick={() => {
                                  file.current!.accept = ".xml,.musicxml";
                                  file.current!.click();
                                }}>匯入 MusicXML</button>
                                <button onClick={() => setView("roll")}>改用 Piano Roll</button>
                              </div>
                            ) : (
                              <button onClick={() => setView("roll")}>顯示 Piano Roll →</button>
                            )}
                          </div>
                        )}
                        <div className="roll-focus-content" hidden={view !== "roll"}>
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
                            autoPolicy={mode === "accompaniment" ? autoPolicy : undefined}
                            splitPitch={splitPitch}
                            focusMode={focusView.active}
                            loopRange={{ enabled: loop, a: loopA, b: loopB }}
                            loopSelectionArmed={loopSelectionArmed}
                            rotate={rotate}
                            onLoopSelect={selectLoopRange}
                          />
                        </div>
                      </div>
                      <div className="music-desk-ledge" aria-hidden="true" />
                    </section>
                    {songImportMounted && (
                      <Suspense fallback={<p className="score-loading" role="status">正在載入曲目工具…</p>}>
                        <LazySongImportTools
                          song={song}
                          url={url}
                          loading={loading || defaultSongLoading}
                          status={status}
                          rotate={rotate}
                          urlInputActive={urlInputActive}
                          onUrlChange={setUrl}
                          onUrlInputActiveChange={setUrlInputActive}
                          onChooseFile={(accept) => {
                            file.current!.accept = accept;
                            file.current!.click();
                          }}
                          onFetchSong={() => void fetchSong()}
                          onLoadDefault={() => void loadDefaultSong()}
                          onLoadDemo={() => load(demo)}
                          onClearSong={() => {
                            markSongChoice();
                            stop();
                            songRef.current = null;
                            setSong(null);
                            setStatus("歌曲已清除，可自由演奏");
                          }}
                          onLibraryLoad={(nextSong, savedPosition) => load(nextSong, "practice", savedPosition)}
                          onSharePractice={() => void sharePractice()}
                          onRestoreOriginal={restoreOriginalComparison}
                          shareNotice={shareNotice}
                          hasOriginalComparison={Boolean(originalComparison.current)}
                        />
                      </Suspense>
                    )}
                  </div>
                ),
              },
              {
                id: "sound",
                label: "聲音",
                content: (
                  soundToolsRequested ? (
                    <Suspense fallback={<p className="score-loading" role="status">正在載入聲音工具…</p>}>
                      <LazySoundTools
                        rotate={rotate}
                        hasMultipleTracks={Boolean(song && song.tracks.length > 1)}
                        onDown={(id, midi, velocity) => void downRef.current(id, midi, velocity)}
                        onUp={release}
                        onPedal={(source, down) => {
                          engine.sustain(down, undefined, source);
                          recorder.pedal(engine.pedal);
                          setPedal(engine.pedal);
                        }}
                        onPreview={() => void audition()}
                        onOpenKeyboard={() => setPanel("keyboard")}
                        onOpenAudio={() => setPanel("audio")}
                        onOpenTracks={() => setPanel("tracks")}
                      />
                    </Suspense>
                  ) : null
                ),
              },
              {
                id: "chord",
                label: "和弦",
                content: (
                  <ChordPanel
                    onDown={(id, n, velocity) => void downRef.current(id, n, velocity)}
                    onUp={release}
                    blocked={panel !== ""}
                    resetKey={playToken.current}
                  />
                ),
              },
              {
                id: "record",
                label: "錄音",
                content: recordingRequested ? (
                  <Suspense
                    fallback={
                      <p className="score-loading">正在載入錄製工具…</p>
                    }
                  >
                    <LazyRecordingControls
                      onPlay={(recording) => void playRecording(recording)}
                      onRecordingChange={setIsRecording}
                      referenceSong={originalComparison.current?.song || null}
                      onCompareOriginal={restoreOriginalComparison}
                    />
                  </Suspense>
                ) : null,
              },
            ]}
          />
          <div className="closed-playback-slot">{playbackBar}</div>
          <div className="piano-housing">
            <div className="fallboard">
              <span className="instrument-name">
                VIRTUAL <b>PIANO</b>
              </span>
              <span className="instrument-sub">GRAND PIANO</span>
              <span className="range-label">
                {settings.keyCount === 88 ? "A0 — C8" : "C2 — C7"}
              </span>
              <RecordingIndicator recording={isRecording} />
            </div>
            <div className="felt" />
            <div className="chord-buttons-slot" />
            <Piano
              count={settings.keyCount}
              mapping={shownMap}
              active={active}
              expected={expected}
              onDown={handlePianoDown}
              onUp={release}
              onSelect={selectMappingNote}
              mappingMode={panel === "keyboard"}
              autoEnabled={mode === "auto" || mode === "accompaniment"}
              onScroll={setScroll}
              scrollPosition={scroll}
              onBounds={setScrollMax}
              rotate={rotate}
              visibleWhiteKeys={settings.visibleWhiteKeys}
              swipeScrollEnabled={settings.keyboardSwipeScroll}
              chordMapping={settings.chordMapping}
              chordEnabled={settings.chordEnabled}
            />
            <div className="keyboard-zoom-control" aria-label="琴鍵大小與滑動設定">
              <RecordingIndicator recording={isRecording} />
              <button
                type="button"
                className="mobile-score-toggle"
                aria-pressed={mobileScoreShown}
                aria-label={mobileScoreShown ? "隱藏曲譜區，保留琴鍵與工具面板" : "顯示曲譜區"}
                onClick={toggleMobileScore}
              >
                {mobileScoreShown ? "隱藏曲譜" : "顯示曲譜"}
              </button>
              {song && (
                <button
                  type="button"
                  className="mobile-playback-toggle"
                  aria-pressed={settings.mobilePlaybackVisible}
                  onClick={toggleMobilePlayback}
                >
                  {settings.mobilePlaybackVisible ? "隱藏播放" : "顯示播放"}
                </button>
              )}
              <span>{settings.visibleWhiteKeys} 白鍵</span>
              <button
                type="button"
                className="keyboard-zoom-preset"
                onClick={() => settings.set({ visibleWhiteKeys: 14 })}
                aria-label="放大琴鍵，顯示 14 個白鍵"
                title="放大琴鍵"
              >
                大鍵
              </button>
              <button type="button" className="keyboard-only-entry" onClick={keyboardOnly.enter}>
                純鍵盤
              </button>
              <StageSlider
                aria-label="調整手機琴鍵大小，至少顯示14個白鍵"
                min={14}
                max={28}
                step={1}
                value={settings.visibleWhiteKeys}
                onChange={(visibleWhiteKeys) => settings.set({ visibleWhiteKeys })}
                rotate={rotate}
              />
              <button
                type="button"
                className="keyboard-swipe-toggle"
                aria-pressed={settings.keyboardSwipeScroll}
                aria-label={settings.keyboardSwipeScroll ? "已開啟滑動瀏覽琴鍵；滑動不會發聲，點擊可回到演奏" : "目前為演奏琴鍵模式；點擊可用滑動瀏覽琴鍵"}
                title={settings.keyboardSwipeScroll ? "滑動只瀏覽音域，不會發聲" : "觸碰琴鍵會演奏；可切換成瀏覽模式"}
                onClick={() => settings.set({ keyboardSwipeScroll: !settings.keyboardSwipeScroll })}
              >
                {settings.keyboardSwipeScroll ? "瀏覽中" : "演奏中"}
              </button>
              <button
                type="button"
                className="keyboard-focus-toggle"
                aria-pressed={mobilePianoExpanded}
                aria-label={mobilePianoExpanded ? "切換到看譜版面" : "切換到演奏版面"}
                title={`目前是${mobilePianoExpanded ? "演奏版面" : "看譜版面"}；切換不會停止播放`}
                onClick={() =>
                  settings.set({
                    mobileStageLayout: mobilePianoExpanded ? "score" : "performance",
                  })
                }
              >
                {mobilePianoExpanded ? "看譜版面" : "演奏版面"}
              </button>
            </div>
            <div className="octave-side-controls" aria-label="八度控制">
              <button aria-label="降低八度" onClick={() => settings.set({ octave: Math.max(-2, settings.octave - 1) })}>−</button>
              <span>八度 {settings.octave > 0 ? "+" : ""}{settings.octave}</span>
              <button aria-label="提高八度" onClick={() => settings.set({ octave: Math.min(2, settings.octave + 1) })}>＋</button>
            </div>
            <div className="piano-lip" />
          </div>
          <button type="button" className="keyboard-only-exit" aria-label="退出純鍵盤模式並返回原畫面" title="退出純鍵盤" onClick={keyboardOnly.exit}>
            <X size={20} aria-hidden="true" />
          </button>
          <MobilePerformanceControls
            playing={playing}
            hasSong={Boolean(song)}
            visibleWhiteKeys={settings.visibleWhiteKeys}
            keyboardSwipeScroll={settings.keyboardSwipeScroll}
            octave={settings.octave}
            rotate={rotate}
            onOpenTracks={() => { setLidTab("stand"); openLid(); }}
            onTogglePlayback={() => {
              if (playing) {
                if (songRef.current) rememberPosition(songRef.current, player.position);
                player.stop(false);
                setPlaying(false);
                setActive(new Set());
              } else void play();
            }}
            onEnterKeyboardOnly={keyboardOnly.enter}
            onVisibleWhiteKeysChange={(visibleWhiteKeys) => settings.set({ visibleWhiteKeys })}
            onKeyboardSwipeScrollChange={(keyboardSwipeScroll) => settings.set({ keyboardSwipeScroll })}
            onOctaveChange={(octave) => settings.set({ octave })}
          />
          <div className="keyboard-tools">
            <div>
              <span className="tiny-dot" />{" "}
              {allActive.size
                ? Array.from(allActive).map(noteName).join(" · ")
                : "準備好，開始演奏"}
              <span className="key-hint">
                A–J 主音／W E T Y U 黑鍵　 /　
                {settings.pedal === "Space" ? "空白鍵" : settings.pedal} 延音
              </span>
            </div>
            <div>
              <label>
                音域{" "}
                <StageSegmented label="琴鍵數量" value={settings.keyCount} options={[{ value: 61, label: "61 鍵" }, { value: 88, label: "88 鍵" }]} onChange={(keyCount) => settings.set({ keyCount })} />
              </label>
              <StageSlider className="range-scroll" aria-label="鍵盤水平位置" min={0} max={scrollMax} step={1} value={scroll} onChange={setScroll} rotate={rotate} />
              <span className="separator" />
              <button type="button" className="keyboard-only-entry" onClick={keyboardOnly.enter}>
                純鍵盤
              </button>
            </div>
          </div>

          <div className="mode-row">
            <div className="mode-switch">
              {[
                ["auto", "自動演奏"],
                ["accompaniment", "自動伴奏"],
                ["practice", "練習模式"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={mode === id ? "selected" : ""}
                  aria-pressed={mode === id}
                  onClick={() => {
                    stop();
                    resetPractice();
                    setMode(id);
                  }}
                >
                  {id === "auto" ? (
                    <Play size={13} />
                  ) : (
                    <Music2 size={14} />
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
            <span className={modeNotice ? "mode-notice" : ""} role="status" aria-live="polite">
              {modeNotice || (mode === "auto"
                ? "跟隨每一個音符，感受音樂的呼吸。"
                : mode === "accompaniment"
                  ? "選擇自動播放的部分；其餘音符由你親自彈奏。"
                  : "跟隨提示練習，讓每次演奏都更進一步。")}
            </span>
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
              const point = toStage(
                event.clientX,
                event.clientY,
                rotate,
                window.innerWidth,
              );
              splitDrag.current = {
                pointerId: event.pointerId,
                startY: point.y,
                startRatio: splitRatioRef.current,
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
              const point = toStage(
                event.clientX,
                event.clientY,
                rotate,
                window.innerWidth,
              );
              const next = Math.max(
                0.25,
                Math.min(0.65, drag.startRatio + (point.y - drag.startY) / Math.max(320, stageHeight)),
              );
              splitRatioRef.current = next;
              setSplitRatio(next);
            }}
            onPointerUp={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatioRef.current });
            }}
            onPointerCancel={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatioRef.current });
            }}
            onLostPointerCapture={(event) => {
              if (splitDrag.current?.pointerId !== event.pointerId) return;
              splitDrag.current = null;
              useSettings.getState().set({ mobileScoreSplit: splitRatioRef.current });
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
                splitRatioRef.current = next;
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
                      ? `單音軌曲目：以 ${noteName(splitPitch)} 為分界（分界音歸低音），可選低音或高音自動演奏。`
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
                        ) as Record<number, AutoPolicy>,
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
                        ) as Record<number, AutoPolicy>,
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
                            ["treble", "高音自動"],
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
              <div className="accompaniment-heading">
                <span>分界音（低音含分界，高音自動高於分界）</span>
                <StageStepper label="分界音高" value={splitPitch} min={36} max={84} step={1} onChange={setSplitPitch} format={noteName} />
              </div>
            </div>
          )}
          {mode === "practice" && (
            <div className="practice">
              <span>
                {practiceType === "wait"
                  ? waitGroups.length === 0
                    ? "A/B 區段內沒有音符，請重新選取循環範圍"
                    : step >= waitGroups.length
                    ? "練習完成"
                    : `下一組：${expected.map(noteName).join(" + ")}`
                  : "按播放開始，依 Piano Roll 提示演奏"}
              </span>
              {(playing || practiceType === "wait") && <>
                <span>正確 {score.correct} · 錯誤 {score.wrong} · 遺漏 {missed}</span>
                <span>
                  完成 {Math.round((score.correct / Math.max(1, considered.length)) * 100)}%
                  {practiceType === "rhythm" && score.correct
                    ? ` · 平均誤差 ${Math.round((score.offset / score.correct) * 1000)}ms`
                    : ""}
                </span>
              </>}
              {missed > 0 && (missedPitch || missedWindow) && <div className="practice-feedback" aria-live="polite">
                <strong>下一步可以加強</strong>
                {missedPitch && <span>最常漏掉：{noteName(missedPitch[0])}（{missedPitch[1]} 次）</span>}
                {missedWindow && <span>困難片段：{clock(missedWindow[0])} 附近（{missedWindow[1]} 個漏音）</span>}
                {missedWindow && song && <button type="button" onClick={() => {
                  const from = Math.max(0, missedWindow[0]);
                  const to = Math.min(song.duration, missedWindow[0] + 4);
                  setLoopA(from);
                  setLoopB(Math.max(from + 0.1, to));
                  setLoop(true);
                  seek(from);
                }}>循環練習這段</button>}
              </div>}
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
      </main>
      <footer>
        <span>VIRTUAL PIANO STUDIO</span>
        <span>為每一位熱愛音樂的人而作。</span>
        <div className="footer-links">
          <a
            href="https://github.com/sfzinstruments/SalamanderGrandPiano"
            target="_blank"
            rel="noreferrer"
          >
            Piano samples: Alexander Holm · CC BY 3.0 ↗
          </a>
          <a
            className="footer-github"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 查看原始碼"
            title="在 GitHub 查看原始碼"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
              />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
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
            setPendingBinding(null);
            setBindingConflict(null);
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
                  setPendingBinding(null);
                  setBindingConflict(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            {panel === "keyboard" ? (
              <Suspense fallback={<p role="status">正在載入鍵盤綁定設定…</p>}>
                <LazyKeyboardMappingPanel
                  mapping={settings.mapping}
                  profiles={settings.profiles}
                  pedal={settings.pedal}
                  selected={selected}
                  pendingBinding={pendingBinding}
                  bindingConflict={bindingConflict}
                  warning={warning}
                  profile={profile}
                  onSelectMappingNote={selectMappingNote}
                  onBindShortcut={bindShortcut}
                  onCancelConflict={() => {
                    setBindingConflict(null);
                    setWarning("已取消取代，原綁定保留");
                  }}
                  onCancelPending={() => {
                    setPendingBinding(null);
                    setWarning("");
                  }}
                  onClearSelected={() => {
                    if (selected === null) return;
                    const map = { ...settings.mapping };
                    for (const key in map) if (map[key] === selected) delete map[key];
                    settings.set({ mapping: map });
                    setWarning("已解除");
                    setSelected(null);
                  }}
                  onRestoreDefaults={() => {
                    settings.set({ mapping: defaultMap });
                    setSelected(null);
                    setWarning("已恢復預設");
                  }}
                  onExport={exportMap}
                  onImport={() => jsonFile.current?.click()}
                  onPedalChange={(pedal) => settings.set({ pedal })}
                  onProfileChange={setProfile}
                  onSaveProfile={(name) => {
                    if (!name.trim()) return;
                    settings.set({
                      profiles: {
                        ...settings.profiles,
                        [name.trim()]: { ...settings.mapping },
                      },
                    });
                  }}
                  onLoadProfile={(name) => {
                    settings.set({ mapping: settings.profiles[name] });
                    setProfile(name);
                  }}
                />
              </Suspense>
            ) : panel === "audio" ? (
              <>
                <p>Grand Piano · Salamander 真實鋼琴取樣</p>
                <label className="setting-line">
                  音量
                  <StageSlider aria-label="音量" min={0} max={1} step={0.01} value={settings.volume} onChange={(volume) => settings.set({ volume })} rotate={rotate} />
                </label>
                <label className="setting-line">
                  殘響
                  <StageSlider aria-label="殘響" min={0} max={0.8} step={0.01} value={settings.reverb} onChange={(reverb) => settings.set({ reverb })} rotate={rotate} />
                </label>
                <label className="setting-line">
                  演奏力度
                  <StageSlider aria-label="演奏力度" min={0.1} max={1} step={0.01} value={settings.velocity} onChange={(velocity) => settings.set({ velocity })} rotate={rotate} />
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
      {rotate && stage === "playing" && (
        <button
          type="button"
          className="orientation-return"
          aria-label="切回直向演奏版面"
          onClick={() => {
            settings.set({ mobileOrientation: "portrait" });
            setModeNotice("已切回直向版面。播放進度保持不變。");
          }}
        >
          直向
        </button>
      )}
    </div>
  );
}
