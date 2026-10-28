import { Midi } from "@tonejs/midi";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioCapture } from "../audio/AudioCapture";
import { engine } from "../audio/PianoEngine";
import { recorder } from "../audio/LiveRecorder";
import type { Song } from "../music/model";
import {
  deleteRecording, listRecordings, renameRecording, saveRecording,
  type SavedRecording,
} from "../library/recordingLibrary";
import "./RecordingControls.css";

export function RecordingControls({
  onPlay,
  onRecordingChange,
  referenceSong = null,
  onCompareOriginal,
}: {
  onPlay: (song: Song) => void;
  onRecordingChange?: (recording: boolean) => void;
  referenceSong?: Song | null;
  onCompareOriginal?: () => void;
}) {
  const [version, refresh] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [name, setName] = useState("我的演奏");
  const [recordAudio, setRecordAudio] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentSaved, setCurrentSaved] = useState(false);
  const [library, setLibrary] = useState<SavedRecording[]>([]);
  const captureRef = useRef(new AudioCapture());
  const startLock = useRef(false);
  const mounted = useRef(false);
  const isRecording = recorder.recording;

  captureRef.current.onError = (message) => { if (mounted.current) setError(message); };

  const refreshLibrary = useCallback(() => {
    try { setLibrary(listRecordings()); } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    recorder.onChange = () => refresh((v) => v + 1);
    return () => {
      mounted.current = false;
      recorder.onChange = () => {};
      recorder.stop();
      captureRef.current.stop(false);
      onRecordingChange?.(false);
    };
  }, [onRecordingChange]);

  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

  useEffect(() => {
    if (!isRecording) {
      setElapsed(recorder.elapsed());
      return;
    }
    const timer = window.setInterval(() => setElapsed(recorder.elapsed()), 200);
    return () => window.clearInterval(timer);
  }, [isRecording, version]);

  const exportMidi = async (song: Song, title: string) => {
    try {
      const midi = new Midi();
      midi.header.name = title;
      const track = midi.addTrack();
      track.name = title;
      song.notes.forEach((n) => track.addNote({
        midi: n.midi, time: n.startTime, duration: n.duration, velocity: n.velocity,
      }));
      song.pedals.forEach((p) => track.addCC({ number: 64, time: p.time, value: p.down ? 1 : 0 }));
      const blob = new Blob([new Uint8Array(midi.toArray())], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[\\/:*?"<>|]/g, "-")}.mid`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  };

  const start = async () => {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true);
    setError("");
    try {
      if (recorder.notes.length && !currentSaved && !window.confirm("這段演奏尚未儲存。確定放棄並開始新錄製嗎？")) return;
      if (recordAudio && !AudioCapture.supported()) throw new Error("此瀏覽器不支援同步錄製音訊，仍可錄製 MIDI 演奏");
      await engine.ready();
      if (!mounted.current) return;
      if (recordAudio) {
        if (!engine.createRecordingStream) throw new Error("目前音源尚未提供音訊擷取，請更新後重試");
        const handle = await engine.createRecordingStream();
        if (!mounted.current) { handle.dispose(); return; }
        captureRef.current.start(handle);
      }
      if (!mounted.current) { captureRef.current.stop(false); return; }
      recorder.start();
      setCurrentSaved(false);
      setElapsed(0);
      onRecordingChange?.(true);
    } catch (e) {
      captureRef.current.stop(false);
      if (mounted.current) setError((e as Error).message || "音源準備失敗，請檢查網路後重試");
    } finally {
      startLock.current = false;
      if (mounted.current) setStarting(false);
    }
  };

  const stop = () => {
    recorder.stop();
    captureRef.current.stop(true);
    setElapsed(recorder.elapsed());
    onRecordingChange?.(false);
  };

  const saveCurrent = () => {
    try {
      saveRecording(name, recorder.song());
      setCurrentSaved(true);
      refreshLibrary();
      setError("作品已儲存");
    } catch (e) { setError((e as Error).message); }
  };

  const rename = (item: SavedRecording) => {
    const next = window.prompt("修改作品名稱", item.name);
    if (next === null) return;
    try { setLibrary(renameRecording(item.id, next)); setError(""); }
    catch (e) { setError((e as Error).message); }
  };

  const remove = (item: SavedRecording) => {
    if (!window.confirm(`確定刪除「${item.name}」？此操作無法復原。`)) return;
    try { setLibrary(deleteRecording(item.id)); setError(""); }
    catch (e) { setError((e as Error).message); }
  };

  const activeSong = recorder.notes.length ? recorder.song() : null;
  const canPlayCurrent = !isRecording && !!activeSong?.notes.length;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <section className="recording-controls" aria-label="錄製自己的演奏" data-version={version}>
      <header className="recording-heading">
        <strong><span className={isRecording ? "record-dot recording" : "record-dot"} />個人練習室</strong>
        <span className="recording-clock" aria-label="錄音時長">{formatTime(elapsed)}</span>
      </header>
      <button type="button" className={isRecording ? "recording-start enabled" : "recording-start"} disabled={starting} onClick={() => isRecording ? stop() : void start()}>
        {isRecording ? "■ 結束錄製" : starting ? "準備音源…" : "● 開始錄製"}
      </button>
      <label className="recording-audio-option">
        <input type="checkbox" checked={recordAudio} disabled={isRecording || starting} onChange={(e) => setRecordAudio(e.target.checked)} />
        同時錄製音訊檔
      </label>
      <span className="recording-status" role="status">
        {isRecording ? "正在錄製；請在琴鍵演奏" : `已錄下 ${recorder.notes.length} 個音符`}
        {currentSaved && " · 已儲存"}{error && ` · ${error}`}
      </span>
      <div className="recording-actions">
        <button type="button" className="recording-play" disabled={!canPlayCurrent} onClick={() => activeSong && onPlay(activeSong)}>▶ 播放最近錄音</button>
        <button type="button" disabled={!canPlayCurrent} onClick={() => activeSong && void exportMidi(activeSong, name)}>匯出 MIDI</button>
        {referenceSong && onCompareOriginal && <button type="button" disabled={isRecording} onClick={onCompareOriginal}>返回原曲</button>}
      </div>
      {canPlayCurrent && !currentSaved && (
        <div className="recording-save-row">
          <input aria-label="作品名稱" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" onClick={saveCurrent}>儲存作品</button>
        </div>
      )}
      <section className="recording-library" aria-label="已儲存的作品">
        <h3>作品收藏 <span>{library.length}</span></h3>
        {library.length === 0 ? <p className="recording-empty">儲存後，作品會留在這台裝置。</p> : (
          <ul>{library.map((item) => (
            <li key={item.id}>
              <div className="recording-item-info"><strong>{item.name}</strong><small>{formatTime(item.song.duration)} · {item.song.notes.length} 音符</small></div>
              <div className="recording-item-actions">
                <button type="button" disabled={isRecording || starting} aria-label={`播放 ${item.name}`} onClick={() => onPlay({ ...item.song, title: item.name })}>▶</button>
                <button type="button" disabled={isRecording || starting} aria-label={`匯出 ${item.name} MIDI`} onClick={() => void exportMidi(item.song, item.name)}>MIDI</button>
                <button type="button" disabled={isRecording || starting} aria-label={`重新命名 ${item.name}`} onClick={() => rename(item)}>改名</button>
                <button type="button" disabled={isRecording || starting} aria-label={`刪除 ${item.name}`} onClick={() => remove(item)}>刪除</button>
              </div>
            </li>
          ))}</ul>
        )}
      </section>
      <small className="recording-footnote">最多保留 25 段作品於此瀏覽器；音訊檔會另存至下載資料夾。</small>
    </section>
  );
}
