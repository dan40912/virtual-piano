// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { player } from "../audio/PlaybackScheduler";
import type { Song } from "../music/model";
import { Roll } from "./Visuals";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const song: Song = {
  title: "test", source: "test", tempo: 120, timeSignature: [4, 4],
  notes: [], duration: 20, tracks: [], pedals: [], tempos: [], signatures: [],
};

it("keeps one resize observer across position ticks and draws the latest position when shown", async () => {
  let resize: (() => void) | undefined;
  const observerInstances: unknown[] = [];
  class FakeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this as unknown as ResizeObserver);
      observerInstances.push(this);
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  const labels: string[] = [];
  const lineWidths: number[] = [];
  const alphas: number[] = [];
  const textAlignments: CanvasTextAlign[] = [];
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), fillText: vi.fn((text: string) => labels.push(text)),
    roundRect: vi.fn(), fill: vi.fn(),
  };
  Object.defineProperties(context, {
    lineWidth: { set: (value: number) => lineWidths.push(value) },
    globalAlpha: { set: (value: number) => alphas.push(value) },
    textAlign: { set: (value: CanvasTextAlign) => textAlignments.push(value) },
  });
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  let width = 0;
  let height = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "offsetWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLCanvasElement.prototype, "offsetHeight", "get").mockImplementation(() => height);

  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => root.render(
    <Roll song={song} transpose={0} count={61} zoom={60} muted={[]} scroll={0} mapping={{}} octave={0} manual={false} />,
  ));
  expect(observerInstances).toHaveLength(1);
  expect(getContext).not.toHaveBeenCalled();

  await act(async () => { player.setPosition(8); });
  expect(observerInstances).toHaveLength(1);
  expect(getContext).not.toHaveBeenCalled();

  width = 240;
  height = 120;
  await act(async () => resize?.());
  expect(observerInstances).toHaveLength(1);
  expect(getContext).toHaveBeenCalledTimes(1);
  expect(labels).toContain("8.0s");

  await act(async () => root.render(
    <Roll song={song} transpose={0} count={61} zoom={60} muted={[]} scroll={0} mapping={{}} octave={0} manual={false} loopRange={{ enabled: true, a: 8, b: 10 }} />,
  ));
  expect(lineWidths).toContain(1.5);
  const widthsBeforeNextFrame = lineWidths.length;
  const alphasBeforeNextFrame = alphas.length;
  const alignmentsBeforeNextFrame = textAlignments.length;
  await act(async () => { player.setPosition(9); });
  expect(lineWidths.slice(widthsBeforeNextFrame)).toContain(1);
  expect(alphas.slice(alphasBeforeNextFrame)).toContain(1);
  expect(textAlignments.slice(alignmentsBeforeNextFrame)).toContain("start");

  await act(async () => root.unmount());
  container.remove();
});

afterEach(() => {
  player.setPosition(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
