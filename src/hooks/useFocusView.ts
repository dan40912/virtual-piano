import { useCallback, useEffect, useRef, useState } from "react";

type FocusSnapshot = { lidOpen: boolean; lidTab: string; visualView: string };

export function useFocusView({
  lidTab,
  lidOpen,
  visualView,
  setLidOpen,
  setLidTab,
  setVisualView,
}: {
  lidTab: string;
  lidOpen: boolean;
  visualView: string;
  setLidOpen: (open: boolean) => void;
  setLidTab: (tab: string) => void;
  setVisualView: (view: string) => void;
}) {
  const [active, setActive] = useState(false);
  const previous = useRef<FocusSnapshot | null>(null);

  const enter = useCallback(() => {
    if (active) return;
    previous.current = { lidOpen, lidTab, visualView };
    setVisualView("roll");
    setLidTab("stand");
    setActive(true);
  }, [active, lidOpen, lidTab, visualView, setLidOpen, setLidTab, setVisualView]);

  const exit = useCallback(() => {
    if (!active) return;
    setActive(false);
    const snapshot = previous.current;
    previous.current = null;
    if (snapshot) {
      setLidOpen(snapshot.lidOpen);
      setLidTab(snapshot.lidTab);
      setVisualView(snapshot.visualView);
    }
  }, [active, setLidOpen, setLidTab, setVisualView]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      exit();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, exit]);

  return { active, enter, exit };
}
