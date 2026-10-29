const CONTROL_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End", "PageUp", "PageDown",
  "Enter", " ", "Escape", "Tab", "Backspace", "Delete",
]);

type TargetLike = EventTarget & {
  tagName?: string;
  type?: string;
  matches?: (selector: string) => boolean;
  closest?: (selector: string) => Element | null;
  isContentEditable?: boolean;
};

/** Reserve form editing and a focused control's own navigation keys, while
 * allowing mapped letter/number keys to play from segmented controls. */
export function shouldIgnorePianoShortcut(target: EventTarget | null, key: string) {
  if (!target || typeof target !== "object") return false;
  const element = target as TargetLike;
  if (element.closest?.('[data-piano-shortcuts="blocked"]')) return true;
  const tagName = element.tagName?.toLowerCase();
  const inputType = element.type?.toLowerCase() || "text";
  const shortcutInput = tagName === "input" && ["checkbox", "radio", "range"].includes(inputType);
  if (
    (tagName === "input" && !shortcutInput) ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.matches?.("textarea, select, [contenteditable]") ||
    element.isContentEditable
  ) return true;
  if (element.closest?.('[contenteditable=""], [contenteditable="true"]')) return true;
  return Boolean(
    CONTROL_KEYS.has(key) &&
    (shortcutInput || element.closest?.(".stage-slider, .stage-segmented, .stage-stepper")),
  );
}
