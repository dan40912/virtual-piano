// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSettings } from "../store";
import { useLidHint } from "./useLidHint";
import { PianoLid } from "../components/PianoLid";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
function Fixture() {
  const hint = useLidHint();
  const [open, setOpen] = useState(false);
  return createElement(
    "div",
    null,
    createElement("button", { onClick: hint.noteAttacked }, "note"),
    createElement(PianoLid, {
      open,
      onToggle: () => {
        if (!open) hint.dismiss();
        setOpen((value) => !value);
      },
      hintActive: hint.active,
      hintPulse: hint.pulse,
      onHintDismiss: hint.dismiss,
      onHintOpen: () => {
        hint.dismiss();
        setOpen(true);
      },
      activeTab: "stand",
      onTabChange: () => undefined,
      tabs: [{ id: "stand", label: "譜架", content: createElement("span", null, "score") }],
    }),
  );
}

beforeEach(async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  localStorage.clear();
  useSettings.setState({ lidHintSeen: false });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(Fixture)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("shows after three notes, closes when the lid opens, and stays dismissed after remount", async () => {
  const note = host.querySelectorAll("button")[0];
  await act(async () => {
    note.click();
    note.click();
    note.click();
  });
  expect(host.querySelector('.lid-hint[role="status"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".lid-cover")!.click());
  expect(host.querySelector(".lid-hint")).toBeNull();
  expect(useSettings.getState().lidHintSeen).toBe(true);
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(Fixture)));
  await act(async () => {
    const remountedNote = host.querySelectorAll("button")[0];
    remountedNote.click();
    remountedNote.click();
    remountedNote.click();
  });
  expect(host.querySelector(".lid-hint")).toBeNull();
});

it("opens the lid and marks the hint seen when the hint body is clicked", async () => {
  const note = host.querySelectorAll("button")[0];
  await act(async () => {
    note.click();
    note.click();
    note.click();
  });

  await act(async () => host.querySelector<HTMLDivElement>(".lid-hint")!.click());

  expect(host.querySelector(".lid-cover")?.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector(".lid-hint")).toBeNull();
  expect(useSettings.getState().lidHintSeen).toBe(true);
});
