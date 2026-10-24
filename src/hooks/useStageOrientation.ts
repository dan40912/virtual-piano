import { useCallback, useEffect, useState } from "react";

type OrientationState = {
  touch: boolean;
  portrait: boolean;
};

function readOrientationState(): OrientationState {
  return {
    touch: window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    portrait: window.matchMedia("(orientation: portrait)").matches,
  };
}

/** Tracks when the mobile stage needs its CSS landscape presentation. */
export function useStageOrientation(stage: "poster" | "playing", suspendRotation = false) {
  const [orientation, setOrientation] = useState(readOrientationState);
  const [landscapeLocked, setLandscapeLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const releaseOrientationLock = useCallback(() => {
    try {
      screen.orientation.unlock();
    } catch {
      // Unlock is unavailable in some browsers and when no lock is active.
    }
    setLandscapeLocked(false);
  }, []);

  useEffect(() => {
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)");
    const portrait = window.matchMedia("(orientation: portrait)");
    const update = () => setOrientation({ touch: touch.matches, portrait: portrait.matches });
    touch.addEventListener("change", update);
    portrait.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    const onFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      setFullscreen(isFullscreen);
      if (!isFullscreen) releaseOrientationLock();
      update();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    update();
    return () => {
      touch.removeEventListener("change", update);
      portrait.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [releaseOrientationLock]);

  const requestLandscape = useCallback(async (target: HTMLElement) => {
    if (!/Android/i.test(navigator.userAgent)) return false;
    try {
      if (!document.fullscreenElement) {
        if (!target.requestFullscreen) throw new Error("Fullscreen unavailable");
        await target.requestFullscreen();
      }
      const screenOrientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: "landscape") => Promise<void>;
      };
      if (!screenOrientation.lock) throw new Error("Orientation lock unavailable");
      await screenOrientation.lock("landscape");
      setLandscapeLocked(true);
      return true;
    } catch {
      setLandscapeLocked(false);
      return false;
    }
  }, []);

  return {
    rotate: stage === "playing" && orientation.touch && orientation.portrait && !landscapeLocked && !suspendRotation,
    fullscreen,
    requestLandscape,
    releaseOrientationLock,
  };
}
