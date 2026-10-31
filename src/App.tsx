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
} from "react";
import { ChordPanel } from "./components/ChordPanel";
import { Piano } from "./components/Piano";
import { Roll, type RollJudge } from "./components/Visuals";
import { PersistentSheetHost } from "./components/PersistentSheetHost";
import { HeroPiano } from "./components/HeroPiano";
import { ControlDrawer, type DrawerTab } from "./components/ControlDrawer";
import { PracticePanel } from "./components/PracticePanel";
import { PracticeSummary } from "./components/PracticeSummary";
import { KeyboardPanel } from "./components/KeyboardPanel";
import type { StandView } from "./components/SongImportTools";
import { engine } from "./audio/PianoEngine";
import { player } from "./audio/PlaybackScheduler";
import { useSettings } from "./store";
import { useVisualPreferences } from "./hooks/useVisualPreferences";
import { shouldIgnorePianoShortcut } from "./music/shortcutTarget";
import { readLastSong, rememberPosition, rememberSong } from "./library/songLibrary";
import { StageSlider } from "./components/StageSlider";
import { StageSegmented } from "./components/StageControls";
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
import { DEFAULT_SPLIT_PITCH, isAutomaticNote, shouldMarkRollManual, type AutoPolicy } from "./practice/handSplit";
import {
  mostMissedSoundingPitch,
  practiceProgressResetPosition,
  practiceRestartPosition,
  selectPracticeFeedbackNotes,
} from "./practice/feedback";
import {
  accuracy,
  inPracticeHand,
  PLAY_STYLES,
  playStyleOf,
  styleModes,
  type PlayStyle,
  type PracticeHand,
} from "./practice/playStyle";
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
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  X,
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
  onScrub,
  onSeek,
  loop,
  loopA,
  loopB,
  onLoopA,
  onLoopB,
}: {
  duration: number;
  onScrub: (position: number) => void;
  onSeek: (position: number) => void;
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
        onChange={onScrub}
        onCommit={onSeek}
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
  const lastSong = useRef<ReturnType<typeof readLastSong> | undefined>(undefined);
  if (lastSong.current === undefined) lastSong.current = readLastSong();
  // Returning players go straight back to their song with the lid already open.
  const [lidOpen, setLidOpen] = useState(() => Boolean(lastSong.current));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("song");
  const [isRecording, setIsRecording] = useState(false);
  const [modeNotice, setModeNotice] = useState("");
  const [toast, setToast] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [scorePaperRequested, setScorePaperRequested] = useState(false);
  const [hand, setHand] = useState<PracticeHand>("right");
  const [summaryOpen, setSummaryOpen] = useState(false);
  useEffect(() => {
    useSettings.getState().set({ theme: "dark" });
  }, []);
  useEffect(() => {
    if (!lastSong.current) return;
    player.setPosition(lastSong.current.position);
    setViewPosition(lastSong.current.position);
  }, []);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!modeNotice) return;
    const timer = window.setTimeout(() => setModeNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [modeNotice]);
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
    [practiceType, setPracticeType] = useState("wait"),
    [tolerance, setTolerance] = useState(0.2);
  const playStyle = playStyleOf(mode, practiceType);
  const scoring = (mode === "practice" && practiceType === "rhythm") || mode === "accompaniment";
  const feedbackTracking = playing && scoring;
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
    [splitPitch, setSplitPitch] = useState(DEFAULT_SPLIT_PITCH),
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
    [view, setView] = useState<StandView>("roll"),
    [zoom, setZoom] = useState(90),
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
  useEffect(() => {
    if (mode !== "practice" || practiceType !== "wait") return;
    waitHeld.current.clear();
    setStep(0);
  }, [mode, practiceType, song, muted, transpose, loop, loopA, loopB, hand, splitPitch]);
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
  // Wait practice only asks for the chosen hand; if that hand has no notes, ask for all of them.
  const handGroups = useMemo(() => {
    const filtered = groupList
      .map((group) => group.filter((n) => inPracticeHand(hand, n.midi + transpose, splitPitch)))
      .filter((group) => group.length);
    return filtered.length ? filtered : groupList;
  }, [groupList, hand, transpose, splitPitch]);
  const waitGroups = useMemo(
    () => selectLoopNotes(handGroups, loop, loopA, loopB),
    [handGroups, loop, loopA, loopB],
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
    setSummaryOpen(false);
    player.stop();
    setPlaying(false);
    panic();
  }, [panic]);
  const resetPracticeAt = (startAt: number) => {
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
  const resetPractice = () => {
    resetPracticeAt(
      practiceProgressResetPosition(mode, practiceType, loop, loopA, player.position),
    );
  };
  const restartPractice = () => {
    const startAt = practiceRestartPosition(mode, practiceType, loop, loopA, player.position);
    player.setPosition(startAt);
    setViewPosition(startAt);
    if (songRef.current) rememberPosition(songRef.current, startAt);
    resetPracticeAt(startAt);
  };
  /** The single entry point for switching how the player plays, so every control stops and resets alike. */
  const chooseStyle = (next: PlayStyle) => {
    const target = styleModes(next);
    if (target.mode === mode && target.practiceType === practiceType) return;
    stop();
    resetPractice();
    setMode(target.mode);
    setPracticeType(target.practiceType);
    setModeNotice(`${PLAY_STYLES.find((entry) => entry.value === next)!.label}：${PLAY_STYLES.find((entry) => entry.value === next)!.hint}`);
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
      // One track: the left hand plays itself. Several: you play the first, the rest accompany.
      setAutoPolicy(Object.fromEntries(s.tracks.map((_, i) => [i, s.tracks.length === 1 ? "bass" : i === 0 ? "manual" : "all"])));
      setSplitPitch(DEFAULT_SPLIT_PITCH);
    }
    restoredPreferenceId.current = id;
    setSong(s);
    setView("roll");
    setSummaryOpen(false);
    setMode(targetMode);
    if (targetMode === "practice") setPracticeType("wait");
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
    pressed.current.set(id, n);
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
    if (lidOpen && (mode === "practice" || mode === "accompaniment") && song) {
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
              (mode === "accompaniment"
                ? !isAutomaticNote(autoPolicy[a.trackId], a.midi + transpose, splitPitch)
                : inPracticeHand(hand, a.midi + transpose, splitPitch)) &&
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
  const openLid = () => {
    // Call ready before any await so the opening tap also unlocks audio on mobile.
    primeAudio();
    setLidOpen(true);
    if (!songRef.current) void loadDefaultSong("practice");
  };
  const pause = () => {
    if (songRef.current) rememberPosition(songRef.current, player.position);
    player.stop(false);
    setPlaying(false);
    setActive(new Set());
  };
  const closeLid = () => {
    if (player.playing) pause();
    setDrawerOpen(false);
    setSummaryOpen(false);
    setLidOpen(false);
  };
  const openDrawer = (tab: string) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
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
    // Fetch the audio library once the page is idle, so the first tap can unlock audio instantly.
    const schedule = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1200));
    schedule(() => void engine.preload().catch(() => {}));
  }, []);
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
      if (e.code === "Escape" && drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (e.repeat || e.code.startsWith("Shift")) return;
      const code = keyboardBinding(e);
      if (shouldIgnorePianoShortcut(e.target, e.key)) return;
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
    drawerOpen,
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
      const meta = practiceMeta.current;
      if (meta.mode === "accompaniment" || (meta.mode === "practice" && meta.practiceType === "rhythm"))
        setSummaryOpen(true);
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
    setSummaryOpen(false);
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
    player.silent = mode === "practice";
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
  // Dragging the progress bar only previews the position; the transport is
  // rescheduled and the position persisted once, when the drag is committed.
  const scrubResume = useRef<boolean | null>(null);
  const scrub = (p: number) => {
    if (scrubResume.current === null) {
      scrubResume.current = player.playing;
      if (player.playing) player.stop(false);
    }
    player.setPosition(p);
    setViewPosition(p);
  };
  const commitSeek = (p: number) => {
    const resume = scrubResume.current;
    scrubResume.current = null;
    seek(p);
    if (resume && songRef.current) void play();
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
  // Only the notes this exercise asks the player for: the chosen hand, or the
  // non-automatic part in follow mode.
  const considered = song
    ? selectPracticeFeedbackNotes(song.notes, {
        muted,
        transpose,
        startAt: practiceStart.current,
        loop,
        loopA,
        loopB,
      }).filter((n) =>
        mode === "accompaniment"
          ? !isAutomaticNote(autoPolicy[n.trackId], n.midi + transpose, splitPitch)
          : inPracticeHand(hand, n.midi + transpose, splitPitch),
      )
    : [];
  const missedNotes =
    scoring
      ? considered.filter(
          (n) => n.startTime < position - tolerance && !hit.current.has(n.id),
        )
      : [];
  const missed = missedNotes.length;
  const missedPitch = mostMissedSoundingPitch(missedNotes, transpose);
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
  const style = PLAY_STYLES.find((entry) => entry.value === playStyle)!;
  const waitMode = mode === "practice" && practiceType === "wait";
  const waitDone = waitMode && waitGroups.length > 0 && step >= waitGroups.length;
  useEffect(() => {
    if (waitDone) setSummaryOpen(true);
  }, [waitDone]);
  // Status messages surface as a short toast instead of a permanent status line.
  const firstStatus = useRef(true);
  useEffect(() => {
    if (firstStatus.current) {
      firstStatus.current = false;
      return;
    }
    setToast(status);
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [status]);
  const togglePlay = () => {
    if (playing) pause();
    else void play();
  };
  const restartFromTop = () => {
    stop();
    restartPractice();
  };
  const loopWindow = (from: number) => {
    if (!song) return;
    const to = Math.min(song.duration, from + 4);
    setLoopA(Math.max(0, from));
    setLoopB(Math.max(from + 0.1, to));
    setLoop(true);
    setSummaryOpen(false);
    seek(Math.max(0, from));
  };
  const total = considered.length;
  const currentAccuracy = waitMode
    ? accuracy(score.correct, score.wrong, 0)
    : accuracy(score.correct, score.wrong, missed);
  const statText = !song || mode === "auto"
    ? ""
    : waitMode
      ? waitDone
        ? "完成"
        : waitGroups.length
          ? `下一個 ${expected.map(noteName).join(" + ")}`
          : ""
      : playing || score.correct || score.wrong || missed
        ? `準確率 ${currentAccuracy}%`
        : "";
  const consideredIds = new Set(considered.map((n) => n.id));
  const judge: RollJudge | undefined = scoring
    ? { hits: hit.current, missBefore: position - tolerance, counts: (id) => consideredIds.has(id) }
    : undefined;
  const timeSignature = song
    ? (song.signatures.filter((s) => s.time <= position).at(-1)?.value || song.timeSignature).join("/")
    : "";
  const audioReady = audio.includes("已就緒");
  const canFullscreen = typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => setStatus("此瀏覽器不支援全螢幕"));
  };
  const chooseFile = (accept: string) => {
    file.current!.accept = accept;
    file.current!.click();
  };
  const notice = modeNotice || toast;

  const drawerTabs: DrawerTab[] = [
    {
      id: "song",
      label: "曲目",
      content: (
        <Suspense fallback={<p className="hint" role="status">正在載入曲目工具…</p>}>
          <LazySongImportTools
            song={song}
            url={url}
            loading={loading || defaultSongLoading}
            status={status}
            view={view}
            onViewChange={(next) => {
              if (next === "score") setScorePaperRequested(true);
              setView(next);
            }}
            onUrlChange={setUrl}
            onChooseFile={chooseFile}
            onFetchSong={() => void fetchSong()}
            onLoadDefault={() => void loadDefaultSong()}
            onLoadDemo={() => load(demo)}
            onClearSong={() => {
              markSongChoice();
              stop();
              songRef.current = null;
              setSong(null);
              setStatus("曲目已清除，可以自由演奏");
            }}
            onLibraryLoad={(nextSong, savedPosition) => load(nextSong, "practice", savedPosition)}
            onSharePractice={() => void sharePractice()}
            onRestoreOriginal={restoreOriginalComparison}
            shareNotice={shareNotice}
            hasOriginalComparison={Boolean(originalComparison.current)}
          />
        </Suspense>
      ),
    },
    {
      id: "practice",
      label: "練習",
      content: (
        <PracticePanel
          style={playStyle}
          onStyle={chooseStyle}
          hand={hand}
          onHand={(next) => { setHand(next); resetPractice(); }}
          splitPitch={splitPitch}
          onSplitPitch={setSplitPitch}
          tolerance={tolerance}
          onTolerance={setTolerance}
          speed={speed}
          onSpeed={setSpeed}
          transpose={transpose}
          onTranspose={setTranspose}
          zoom={zoom}
          onZoom={setZoom}
          loop={loop}
          onLoop={setLoop}
          loopA={loopA}
          loopB={loopB}
          onSetA={() => setLoopAFromPosition(player.position)}
          onSetB={() => setLoopBFromPosition(player.position)}
          loopSelectionArmed={loopSelectionArmed}
          onArmLoopSelection={() => {
            setLoopSelectionArmed((armed) => !armed);
            setDrawerOpen(false);
          }}
          metronome={metro}
          onMetronome={setMetro}
          tracks={song?.tracks || []}
          muted={muted}
          onToggleTrack={(index) => {
            setMuted((current) => current.includes(index) ? current.filter((v) => v !== index) : [...current, index]);
            resetPractice();
          }}
          autoPolicy={autoPolicy}
          onPolicy={(track, policy) => setAutoPolicy((current) => ({ ...current, [track]: policy }))}
          feedback={{ pitch: missedPitch, window: missedWindow }}
          onLoopWindow={loopWindow}
          onRestart={restartFromTop}
        />
      ),
    },
    {
      id: "sound",
      label: "聲音",
      content: (
        <Suspense fallback={<p className="hint" role="status">正在載入聲音工具…</p>}>
          <LazySoundTools
            audioState={audio}
            pedal={pedal}
            manualTranspose={manualTranspose}
            onPreview={() => void audition()}
            onPedalToggle={() => {
              engine.sustain(!engine.pedals.has("manual"), undefined, "manual");
              recorder.pedal(engine.pedal);
              setPedal(engine.pedal);
            }}
            onManualTransposeChange={setManualTranspose}
            onRetryAudio={() => void engine.ready().catch((e) => setStatus(e.message))}
            onPanic={panic}
          />
        </Suspense>
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
      content: (
        <Suspense fallback={<p className="hint" role="status">正在載入錄音工具…</p>}>
          <LazyRecordingControls
            onPlay={(recording) => void playRecording(recording)}
            onRecordingChange={setIsRecording}
            referenceSong={originalComparison.current?.song || null}
            onCompareOriginal={restoreOriginalComparison}
          />
        </Suspense>
      ),
    },
    {
      id: "keys",
      label: "鍵盤",
      content: (
        <KeyboardPanel
          onOpenMapping={() => setPanel("keyboard")}
          onDown={(id, midi, velocity) => void downRef.current(id, midi, velocity)}
          onUp={release}
          onPedal={(source, down) => {
            engine.sustain(down, undefined, source);
            recorder.pedal(engine.pedal);
            setPedal(engine.pedal);
          }}
        />
      ),
    },
  ];

  return (
    <div
      className="vp"
      data-lid={lidOpen ? "open" : "closed"}
      data-drawer={drawerOpen ? "open" : "closed"}
      data-chord-enabled={settings.chordEnabled ? "true" : "false"}
      onPointerDownCapture={primeAudio}
      onKeyDownCapture={primeAudio}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) {
          if (!lidOpen) setLidOpen(true);
          void importFile(e.dataTransfer.files[0]);
        }
      }}
    >
      <section className="vp-top">
        <div className="hero" inert={lidOpen} aria-hidden={lidOpen}>
          <div className="hero-copy">
            <p className="eyebrow">Virtual Piano Studio</p>
            <h1><span>掀開琴蓋，</span><em>讓音樂流下來。</em></h1>
            <p className="hero-lede">一架在瀏覽器裡的演奏級鋼琴。跟著落下的音符彈，觸控、電腦鍵盤或 MIDI 鍵盤都可以。</p>
            <div className="hero-actions">
              <button type="button" className="cta" onClick={openLid}>
                掀開琴蓋 <ChevronUp size={18} aria-hidden="true" />
              </button>
              <span className="hero-hint">或直接彈下方琴鍵 · 電腦鍵盤 A 到 L</span>
            </div>
          </div>
          <p className={`hero-audio ${audioReady ? "ready" : ""}`} role="status">
            <i aria-hidden="true" />
            {audioReady ? "鋼琴音源已就緒" : audio.includes("失敗") ? audio : audio.includes("載入") ? audio.replace("Grand Piano", "鋼琴音源") : "第一次觸碰時載入鋼琴音源"}
          </p>
          <HeroPiano />
          <a className="hero-source" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>

        <div className="stand" inert={!lidOpen} aria-hidden={!lidOpen}>
          <header className="transport" aria-label="播放控制">
            <button type="button" className="icon-button lid-close" aria-label="闔上琴蓋" title="闔上琴蓋" onClick={closeLid}>
              <ChevronDown size={18} />
            </button>
            <div className="transport-title">
              <strong title={song?.title}>{song?.title || "自由演奏"}</strong>
              <span>
                {song
                  ? `${Math.round(bpm * speed)} BPM · ${timeSignature} 拍 · ${style.label}`
                  : defaultSongLoading ? "正在準備預設曲…" : "選一首曲子開始"}
              </span>
            </div>
            <div className="transport-buttons">
              <button type="button" className="icon-button" aria-label="從頭開始" title="從頭開始" disabled={!song} onClick={() => { stop(); restartPractice(); void play(); }}>
                <RotateCcw size={17} />
              </button>
              <button type="button" className="play-button" aria-label={playing ? "暫停" : "播放"} disabled={!song} onClick={togglePlay}>
                {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
            </div>
            <PlaybackProgress
              duration={song?.duration || 0}
              onScrub={scrub}
              onSeek={commitSeek}
              loop={loop}
              loopA={loopA}
              loopB={loopB}
              onLoopA={setLoopAFromPosition}
              onLoopB={setLoopBFromPosition}
            />
            <StageSegmented<PlayStyle>
              className="transport-styles"
              label="演奏方式"
              value={playStyle}
              options={PLAY_STYLES.map(({ value, label }) => ({ value, label }))}
              onChange={chooseStyle}
            />
            {statText && <span className="transport-stat" role="status" aria-live="polite">{statText}</span>}
            <RecordingIndicator recording={isRecording} />
            <button
              type="button"
              className="settings-button"
              aria-expanded={drawerOpen}
              onClick={() => (drawerOpen ? setDrawerOpen(false) : openDrawer(drawerTab))}
            >
              <Settings2 size={17} aria-hidden="true" />
              <span>{drawerOpen ? "收起" : "設定"}</span>
            </button>
            {canFullscreen && (
              <button type="button" className="icon-button transport-fullscreen" aria-label={fullscreen ? "離開全螢幕" : "全螢幕"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            )}
          </header>

          <div className="stand-view">
            <div className="waterfall" hidden={view !== "roll"}>
              <Roll
                song={song}
                transpose={transpose}
                count={settings.keyCount}
                zoom={zoom}
                muted={muted}
                scroll={scroll}
                mapping={settings.mapping}
                octave={settings.octave}
                manual={shouldMarkRollManual(mode !== "auto", mode, practiceType)}
                autoPolicy={mode === "accompaniment" ? autoPolicy : undefined}
                splitPitch={splitPitch}
                practiceHand={mode === "practice" ? hand : undefined}
                loopRange={{ enabled: loop, a: loopA, b: loopB }}
                loopSelectionArmed={loopSelectionArmed}
                onLoopSelect={selectLoopRange}
                judge={judge}
              />
              {loopSelectionArmed && (
                <p className="wait-hint">在音符區由上往下拖曳，選取要循環的段落
                  <button type="button" className="quiet" onClick={() => setLoopSelectionArmed(false)}>取消</button>
                </p>
              )}
              {!song && (
                <div className="stand-empty">
                  <p>{defaultSongLoading ? "正在準備預設練習曲…" : "選一首曲子，音符就會從這裡落下。"}</p>
                  <div className="button-row">
                    <button type="button" className="primary" disabled={defaultSongLoading} onClick={() => void loadDefaultSong()}>載入預設練習曲</button>
                    <button type="button" onClick={() => openDrawer("song")}>選擇或匯入曲目</button>
                  </div>
                </div>
              )}
              {outOfRange > 0 && <p className="stand-warning">{outOfRange} 個音符超出 88 鍵音域，播放時略過</p>}
            </div>
            {view === "sheet" && (
              <div className="sheet-view">
                <PersistentSheetHost visible song={song} transpose={transpose} />
                {(!song?.xml || transpose !== 0) && (
                  <div className="stand-empty">
                    <p>
                      {song && !song.xml
                        ? "MIDI 沒有五線譜。匯入 MusicXML 就能顯示樂譜。"
                        : transpose
                          ? "轉調時請改用音符瀑布。"
                          : "目前曲目沒有可顯示的五線譜。"}
                    </p>
                    <div className="button-row">
                      {song && !song.xml && <button type="button" onClick={() => chooseFile(".xml,.musicxml")}>匯入 MusicXML</button>}
                      <button type="button" className="primary" onClick={() => setView("roll")}>改用音符瀑布</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="score-view" hidden={view !== "score"}>
              <Suspense fallback={<p className="hint">正在載入琴譜架…</p>}>
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
            {summaryOpen && (
              <PracticeSummary
                accuracy={currentAccuracy}
                correct={score.correct}
                wrong={score.wrong}
                missed={waitMode ? 0 : missed}
                total={waitMode ? waitGroups.reduce((sum, group) => sum + group.length, 0) : total}
                missedPitch={waitMode ? undefined : missedPitch}
                missedWindow={waitMode ? undefined : missedWindow}
                onLoopWindow={loopWindow}
                onRestart={() => {
                  restartFromTop();
                  if (!waitMode) void play();
                }}
                onClose={() => setSummaryOpen(false)}
              />
            )}
            {notice && <p className="toast" role="status">{notice}</p>}
            <ControlDrawer
              open={drawerOpen}
              tabs={drawerTabs}
              active={drawerTab}
              onTabChange={setDrawerTab}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      </section>

      <section className="vp-keys" aria-label="鋼琴鍵盤">
        <div className="nameboard">
          <span className="nameboard-range">{settings.keyCount === 88 ? "A0 – C8" : "C2 – C7"}</span>
          <span className="nameboard-brand">Virtual Piano</span>
          <span className="rotate-hint">轉成橫向，琴鍵更好彈</span>
          <span className="nameboard-status" aria-live="off">
            {pedalVisible && <b>延音</b>}
            {allActive.size ? Array.from(allActive).sort((a, b) => a - b).map(noteName).join(" ") : ""}
          </span>
        </div>
        <div className="keybed">
          <Piano
            count={settings.keyCount}
            mapping={shownMap}
            active={active}
            expected={lidOpen ? expected : []}
            onDown={handlePianoDown}
            onUp={release}
            onSelect={selectMappingNote}
            mappingMode={panel === "keyboard"}
            autoEnabled={mode === "auto" || mode === "accompaniment"}
            onScroll={setScroll}
            scrollPosition={scroll}
            onBounds={setScrollMax}
            visibleWhiteKeys={settings.visibleWhiteKeys}
            swipeScrollEnabled={settings.keyboardSwipeScroll}
            chordMapping={settings.chordMapping}
            chordEnabled={settings.chordEnabled}
            labels={settings.keyLabels}
          />
          {scrollMax > 0 && (
            <StageSlider className="range-scroll" aria-label="鍵盤水平位置" min={0} max={scrollMax} step={1} value={scroll} onChange={setScroll} />
          )}
        </div>
      </section>

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
      {panel === "keyboard" && (
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
            aria-label="電腦鍵盤對應"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <h2>電腦鍵盤對應</h2>
              <button
                type="button"
                className="icon-button"
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
            <Suspense fallback={<p role="status">正在載入鍵盤對應設定…</p>}>
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
          </section>
        </div>
      )}
    </div>
  );
}
