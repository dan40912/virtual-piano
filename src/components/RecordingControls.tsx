import { Midi } from "@tonejs/midi";
import { useEffect, useState } from "react";
import { recorder } from "../audio/LiveRecorder";
import type { Song } from "../music/model";

export function RecordingControls({
  onPlay,
  onRecordingChange,
}: {
  onPlay: (song: Song) => void;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [version, refresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    recorder.onChange = () => refresh((v) => v + 1);
    return () => {
      recorder.onChange = () => {};
      recorder.stop();
      onRecordingChange?.(false);
    };
  }, [onRecordingChange]);

  const exportMidi = async () => {
    try {
      const song = recorder.song();
      const midi = new Midi();
      midi.header.name = "My performance";
      const track = midi.addTrack();
      track.name = "My performance";
      song.notes.forEach((n) =>
        track.addNote({
          midi: n.midi,
          time: n.startTime,
          duration: n.duration,
          velocity: n.velocity,
        }),
      );
      song.pedals.forEach((p) =>
        track.addCC({ number: 64, time: p.time, value: p.down ? 1 : 0 }),
      );
      const data = midi.toArray();
      const blob = new Blob([new Uint8Array(data)], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-performance.mid";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="recording-controls" aria-label="錄製自己的演奏" data-version={version}>
      <header className="recording-heading">
        <strong>
          <span className={recorder.recording ? "record-dot recording" : "record-dot"} />
          我的演奏
        </strong>
        <small>開始錄製後直接彈琴；結束後可播放剛才的演奏。</small>
      </header>
      <button
        type="button"
        className={recorder.recording ? "recording-start enabled" : "recording-start"}
        onClick={() => {
          if (recorder.recording) {
            recorder.stop();
            onRecordingChange?.(false);
          }
          else {
            recorder.start();
            onRecordingChange?.(true);
            setError("");
          }
        }}
      >
        {recorder.recording ? "■ 結束錄製" : "● 開始錄製"}
      </button>
      <span className="recording-status" role="status">
        {recorder.recording ? "正在錄製，請在下方琴鍵演奏" : `已錄下 ${recorder.notes.length} 個音符`}
        {error && ` · ${error}`}
      </span>
      <div className="recording-actions">
        <button
          type="button"
          className="recording-play"
          disabled={recorder.recording || !recorder.notes.length}
          onClick={() => onPlay(recorder.song())}
        >
          ▶ 播放錄音
        </button>
        <button
          type="button"
          disabled={recorder.recording || !recorder.notes.length}
          onClick={() => void exportMidi()}
        >
          匯出 MIDI
        </button>
      </div>
      <small className="recording-footnote">開始新錄製會取代上一段；錄音暫存在目前瀏覽器分頁。</small>
    </section>
  );
}
