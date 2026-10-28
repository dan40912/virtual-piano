import { useCallback, useEffect, useRef, useState } from "react";

/** Temporary presentation state; it deliberately does not control playback or layout preferences. */
export function useKeyboardOnly() {
  const [active, setActive] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const enter = useCallback(() => {
    activeRef.current = true;
    setActive(true);
  }, []);
  const exit = useCallback(() => {
    activeRef.current = false;
    setActive(false);
  }, []);

  // Keep this listener registered before the focus view's Escape listener. When
  // pure keyboard mode is active, Escape must leave only this mode.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeRef.current || event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activeRef.current = false;
      setActive(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return { active, enter, exit };
}
