import { Midi } from "@tonejs/midi";
import { useEffect, useState } from "react";
import { recorder } from "../audio/LiveRecorder";
import type { Song } from "../music/model";
export function RecordingControls({ onLoad }: { onLoad: (s: Song) => void }) {
  const [version, refresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    recorder.onChange = () => refresh((v) => v + 1);
    return () => {
      recorder.onChange = () => {};
      recorder.stop();
    };
  }, []);
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
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "my-performance.mid";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section
      className="recording-controls"
      aria-label="錄製自己的演奏"
      data-version={version}
    >
      <div>
        <strong>
          <span
            className={
              recorder.recording ? "record-dot recording" : "record-dot"
            }
          />
          我的演奏
        </strong>
        <small>錄下你的單音、和弦與延音；不錄製自動播放的歌曲。</small>
      </div>
      <button
        className={recorder.recording ? "enabled" : ""}
        onClick={() => {
          if (recorder.recording) recorder.stop();
          else {
            recorder.start();
            setError("");
          }
        }}
      >
        {recorder.recording ? "結束錄製" : "開始新錄製"}
      </button>
      <span role="status">
        {recorder.recording ? "錄製中" : `${recorder.notes.length} 個音符`}
        {error}
      </span>
      <button
        disabled={recorder.recording || !recorder.notes.length}
        onClick={() => onLoad(recorder.song())}
      >
        載入回放
      </button>
      <button
        disabled={recorder.recording || !recorder.notes.length}
        onClick={() => void exportMidi()}
      >
        匯出 MIDI
      </button>
      <small>
        新錄製會取代上一段；匯出的是演奏事件，音色不包含在 MIDI 裡。
      </small>
    </section>
  );
}
