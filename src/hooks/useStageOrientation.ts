import { useEffect, useState } from "react";

type OrientationState = {
  touch: boolean;
  portrait: boolean;
  phoneWidth: boolean;
};

function readOrientationState(): OrientationState {
  return {
    touch: window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    portrait: window.matchMedia("(orientation: portrait)").matches,
    phoneWidth: window.matchMedia("(max-width: 767px)").matches,
  };
}

/** Tracks when the mobile stage needs its CSS landscape presentation. */
export function useStageOrientation(
  stage: "poster" | "playing",
  suspendRotation = false,
  mobileOrientation: "portrait" | "landscape" = "portrait",
) {
  const [orientation, setOrientation] = useState(readOrientationState);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)");
    const portrait = window.matchMedia("(orientation: portrait)");
    const phoneWidth = window.matchMedia("(max-width: 767px)");
    const update = () => setOrientation({
      touch: touch.matches,
      portrait: portrait.matches,
      phoneWidth: phoneWidth.matches,
    });
    touch.addEventListener("change", update);
    portrait.addEventListener("change", update);
    phoneWidth.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    const onFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      setFullscreen(isFullscreen);
      update();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    update();
    return () => {
      touch.removeEventListener("change", update);
      portrait.removeEventListener("change", update);
      phoneWidth.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return {
    rotate:
      stage === "playing" &&
      orientation.touch &&
      orientation.phoneWidth &&
      orientation.portrait &&
      mobileOrientation === "landscape" &&
      !suspendRotation,
    fullscreen,
  };
}
