// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { Song } from "../music/model";
import { PersistentSheetHost } from "./PersistentSheetHost";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("opensheetmusicdisplay", () => ({
  OpenSheetMusicDisplay: class {
    cursor = {
      reset: vi.fn(),
      show: vi.fn(),
      next: vi.fn(),
      Iterator: {
        EndReached: true,
        CurrentSourceTimestamp: { RealValue: 0 },
      },
      cursorElement: document.createElement("div"),
    };
    load = vi.fn(async () => {});
    render = vi.fn();
    clear = vi.fn();
  },
}));

const xmlSong = (title: string): Song => ({
  title, source: "imported", tempo: 100, timeSignature: [4, 4],
  notes: [], duration: 10, tracks: [], pedals: [], tempos: [], signatures: [],
  xml: `<score-partwise><work><work-title>${title}</work-title></work></score-partwise>`,
});
const midiSong: Song = {
  title: "MIDI", source: "imported", tempo: 100, timeSignature: [4, 4],
  notes: [], duration: 10, tracks: [], pedals: [], tempos: [], signatures: [],
};

it("does not mount a hidden sheet early and preserves its DOM through view and transpose changes", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const firstSong = xmlSong("first");
  await act(async () => root.render(
    <PersistentSheetHost visible={false} song={firstSong} transpose={0} />,
  ));
  expect(container.querySelector(".sheet")).toBeNull();

  await act(async () => root.render(
    <PersistentSheetHost visible song={firstSong} transpose={0} />,
  ));
  const sheet = container.querySelector(".sheet");
  expect(sheet).not.toBeNull();

  await act(async () => root.render(
    <PersistentSheetHost visible={false} song={firstSong} transpose={0} />,
  ));
  expect(container.querySelector(".sheet")).toBe(sheet);
  expect(container.querySelector(".sheet-host")?.hasAttribute("hidden")).toBe(true);

  await act(async () => root.render(
    <PersistentSheetHost visible song={firstSong} transpose={1} />,
  ));
  expect(container.querySelector(".sheet")).toBe(sheet);
  expect(container.querySelector(".sheet-host")?.hasAttribute("hidden")).toBe(true);

  await act(async () => root.render(
    <PersistentSheetHost visible song={xmlSong("second")} transpose={0} />,
  ));
  expect(container.querySelector(".sheet")).toBe(sheet);
  expect(container.querySelector(".sheet-host")?.hasAttribute("hidden")).toBe(false);

  await act(async () => root.render(
    <PersistentSheetHost visible={false} song={midiSong} transpose={0} />,
  ));
  expect(container.querySelector(".sheet")).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});

afterEach(() => vi.clearAllMocks());
