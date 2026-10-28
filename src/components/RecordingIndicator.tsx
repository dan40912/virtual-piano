import { useEffect, useState } from "react";
import { recorder } from "../audio/LiveRecorder";
import "./RecordingIndicator.css";

function formatElapsed(seconds: number) {
  const whole = Math.floor(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

export function RecordingIndicator({ recording }: { recording: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const update = () => setElapsed(recorder.elapsed());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  if (!recording) return null;

  return (
    <span className="recording-live-badge" role="status">
      <i aria-hidden="true" />錄製中 {formatElapsed(elapsed)}
    </span>
  );
}
