import { describe, expect, it } from "vitest";
import { shouldIgnorePianoShortcut } from "./shortcutTarget";

function target({
  input = false,
  type = "text",
  editable = false,
  control = false,
}: { input?: boolean; type?: string; editable?: boolean; control?: boolean } = {}) {
  return {
    tagName: input ? "INPUT" : undefined,
    type,
    matches: (selector: string) => input && selector.includes("input"),
    closest: (selector: string) => {
      if (selector.includes("contenteditable") && editable) return {} as Element;
      if (selector.includes("stage-slider") && control) return {} as Element;
      return null;
    },
    isContentEditable: editable,
  } as unknown as EventTarget;
}

describe("piano shortcut target filtering", () => {
  it("lets ordinary mapped keys play while segmented controls have focus", () => {
    expect(shouldIgnorePianoShortcut(target({ control: true }), "KeyD")).toBe(false);
    expect(shouldIgnorePianoShortcut(target({ control: true }), "Digit2")).toBe(false);
  });

  it("reserves slider and segmented-control navigation keys", () => {
    for (const key of ["ArrowLeft", "ArrowDown", "Home", "End", "PageUp", " ", "Enter"])
      expect(shouldIgnorePianoShortcut(target({ control: true }), key)).toBe(true);
    expect(shouldIgnorePianoShortcut(target({ control: false }), "ArrowLeft")).toBe(false);
  });

  it("lets mapped letters play from checkbox, radio, and range inputs", () => {
    for (const type of ["checkbox", "radio", "range"]) {
      const focused = target({ input: true, type });
      expect(shouldIgnorePianoShortcut(focused, "KeyZ")).toBe(false);
      expect(shouldIgnorePianoShortcut(focused, "ArrowLeft")).toBe(true);
      expect(shouldIgnorePianoShortcut(focused, " ")).toBe(true);
    }
  });

  it("never steals keys from text/form or editable content", () => {
    for (const input of ["KeyA", "ArrowUp", " "])
      expect(shouldIgnorePianoShortcut(target({ input: true }), input)).toBe(true);
    expect(shouldIgnorePianoShortcut(target({ editable: true }), "KeyA")).toBe(true);
  });
});
