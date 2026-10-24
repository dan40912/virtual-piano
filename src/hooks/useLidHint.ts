import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../store";

/** One-time, first-use nudge for the piano lid. */
export function useLidHint() {
  const seen = useSettings((state) => state.lidHintSeen);
  const set = useSettings((state) => state.set);
  const [active, setActive] = useState(false);
  const [pulse, setPulse] = useState(0);
  const count = useRef(0);
  const started = useRef(false);
  const activeRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const show = useCallback(() => {
    if (useSettings.getState().lidHintSeen || activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    setPulse(1);
    timers.current.push(setTimeout(() => setPulse(2), 1500));
  }, []);
  const noteAttacked = useCallback(() => {
    if (useSettings.getState().lidHintSeen || activeRef.current) return;
    count.current += 1;
    if (!started.current) {
      started.current = true;
      timers.current.push(setTimeout(show, 5000));
    }
    if (count.current >= 3) {
      cancelTimers();
      show();
    }
  }, [cancelTimers, show]);
  const dismiss = useCallback(() => {
    cancelTimers();
    activeRef.current = false;
    setActive(false);
    set({ lidHintSeen: true });
  }, [cancelTimers, set]);
  useEffect(() => {
    if (seen) {
      cancelTimers();
      activeRef.current = false;
      setActive(false);
    }
  }, [seen, cancelTimers]);
  useEffect(() => cancelTimers, [cancelTimers]);
  return { active: active && !seen, pulse, noteAttacked, dismiss };
}
