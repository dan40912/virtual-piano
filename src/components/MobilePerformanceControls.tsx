import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { BookOpen, Keyboard, Pause, Play, Settings2, X } from "lucide-react";
import { StageSlider } from "./StageSlider";

export function MobilePerformanceControls({
  playing,
  hasSong,
  visibleWhiteKeys,
  keyboardSwipeScroll,
  octave,
  rotate,
  onOpenTracks,
  onTogglePlayback,
  onEnterKeyboardOnly,
  onVisibleWhiteKeysChange,
  onKeyboardSwipeScrollChange,
  onOctaveChange,
}: {
  playing: boolean;
  hasSong: boolean;
  visibleWhiteKeys: number;
  keyboardSwipeScroll: boolean;
  octave: number;
  rotate: boolean;
  onOpenTracks: () => void;
  onTogglePlayback: () => void;
  onEnterKeyboardOnly: () => void;
  onVisibleWhiteKeysChange: (value: number) => void;
  onKeyboardSwipeScrollChange: (value: boolean) => void;
  onOctaveChange: (value: number) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (settingsOpen) {
      wasOpen.current = true;
      closeButton.current?.focus();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setSettingsOpen(false);
      };
      window.addEventListener("keydown", onKeyDown, true);
      return () => window.removeEventListener("keydown", onKeyDown, true);
    }
    if (wasOpen.current) settingsButton.current?.focus();
  }, [settingsOpen]);

  const keepFocusInDialog = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [role="slider"][tabindex="0"]',
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeSettings = () => setSettingsOpen(false);

  return (
    <div className="mobile-performance-controls">
      <button type="button" className="mobile-performance-action" onClick={onOpenTracks}>
        <BookOpen size={16} aria-hidden="true" />
        <span>曲目</span>
      </button>
      <button
        type="button"
        className="mobile-performance-action"
        onClick={onTogglePlayback}
        disabled={!hasSong}
        aria-label={playing ? "暫停播放" : "播放曲目"}
      >
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        <span>{playing ? "暫停" : "播放"}</span>
      </button>
      <button
        ref={settingsButton}
        type="button"
        className="mobile-performance-action mobile-performance-settings-toggle"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((open) => !open)}
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>設定</span>
      </button>
      <button type="button" className="mobile-performance-action mobile-performance-pure" onClick={onEnterKeyboardOnly}>
        <Keyboard size={16} aria-hidden="true" />
        <span>純鍵盤</span>
      </button>
      {settingsOpen && (
        <div className="mobile-performance-settings-layer">
          <button
            type="button"
            className="mobile-performance-settings-scrim"
            aria-label="關閉鍵盤設定"
            onClick={closeSettings}
          />
          <section
            className="mobile-performance-settings"
            role="dialog"
            aria-modal="true"
            aria-label="鍵盤設定"
            data-piano-shortcuts="blocked"
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={keepFocusInDialog}
          >
            <header>
              <strong>鍵盤設定</strong>
              <button ref={closeButton} type="button" aria-label="關閉鍵盤設定" onClick={closeSettings}>
                <X size={17} aria-hidden="true" />
              </button>
            </header>
            <label className="mobile-performance-key-size">
              <span>顯示白鍵數</span>
              <output>{visibleWhiteKeys}</output>
              <StageSlider
                aria-label="調整顯示白鍵數"
                min={14}
                max={28}
                step={1}
                value={visibleWhiteKeys}
                onChange={onVisibleWhiteKeysChange}
                rotate={rotate}
              />
            </label>
            <button
              type="button"
              className="mobile-performance-swipe-toggle"
              aria-pressed={keyboardSwipeScroll}
              onClick={() => onKeyboardSwipeScrollChange(!keyboardSwipeScroll)}
            >
              <span>滑動瀏覽琴鍵</span>
              <span>{keyboardSwipeScroll ? "開啟" : "關閉"}</span>
            </button>
            <div className="mobile-performance-octave" role="group" aria-label="八度">
              <span>八度</span>
              <button type="button" aria-label="降低八度" disabled={octave <= -2} onClick={() => onOctaveChange(Math.max(-2, octave - 1))}>−</button>
              <output>{octave > 0 ? `+${octave}` : octave}</output>
              <button type="button" aria-label="提高八度" disabled={octave >= 2} onClick={() => onOctaveChange(Math.min(2, octave + 1))}>＋</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
