// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { AudioCapture } from "./AudioCapture";

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  static instances: FakeMediaRecorder[] = [];
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly stream: MediaStream) { FakeMediaRecorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; }
  emit(data: Blob) { this.ondataavailable?.({ data } as BlobEvent); }
  finish() { this.onstop?.(new Event("stop")); }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); FakeMediaRecorder.instances = []; });

it("isolates each audio take and prevents another take until the stop event releases its stream", () => {
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  const createObjectURL = vi.fn(() => "blob:take");
  class MockURL extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", MockURL);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const handles = [vi.fn(), vi.fn()];
  const rejectedHandle = vi.fn();
  const capture = new AudioCapture();
  const stream = {} as MediaStream;
  capture.start({ stream, dispose: handles[0] });
  const first = FakeMediaRecorder.instances[0];
  first.emit(new Blob(["first take"]));
  expect(capture.stop()).toBe(true);
  expect(() => capture.start({ stream, dispose: rejectedHandle })).toThrow(/尚未結束/);
  expect(rejectedHandle).toHaveBeenCalledOnce();
  first.finish();
  expect(handles[0]).toHaveBeenCalledTimes(1);

  capture.start({ stream, dispose: handles[1] });
  const second = FakeMediaRecorder.instances[1];
  second.emit(new Blob(["second take"]));
  capture.stop(false);
  second.finish();
  expect(handles[1]).toHaveBeenCalledTimes(1);
  expect(createObjectURL).toHaveBeenCalledTimes(1);
});
