export interface RecordingStreamHandle {
  stream: MediaStream;
  dispose(): void;
}

export class AudioCapture {
  private recorder?: MediaRecorder;
  private stopping = false;
  private pendingDownload = true;
  onError: (message: string) => void = () => {};

  static supported() {
    return typeof MediaRecorder !== "undefined";
  }

  start(handle: RecordingStreamHandle) {
    if (!AudioCapture.supported()) {
      handle.dispose();
      throw new Error("此瀏覽器不支援同步錄製音訊");
    }
    if (this.recorder?.state === "recording" || this.stopping) {
      handle.dispose();
      throw new Error("音訊錄製尚未結束");
    }
    try {
      const supportedTypes = typeof MediaRecorder.isTypeSupported === "function"
        ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter((type) => MediaRecorder.isTypeSupported(type))
        : [];
      const mimeType = supportedTypes[0];
      const chunks: Blob[] = [];
      let finished = false;
      const finish = (download: boolean) => {
        if (finished) return;
        finished = true;
        try {
          if (download && chunks.length) {
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            const ext = blob.type.includes("mp4") ? "mp4" : "webm";
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `my-performance.${ext}`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } catch {
          this.onError("音訊檔無法下載；MIDI 演奏仍可使用");
        } finally {
          chunks.length = 0;
          handle.dispose();
          this.stopping = false;
          this.pendingDownload = true;
          if (this.recorder === recorder) this.recorder = undefined;
        }
      };
      const recorder = mimeType
        ? new MediaRecorder(handle.stream, { mimeType })
        : new MediaRecorder(handle.stream);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      this.pendingDownload = true;
      recorder.onstop = () => finish(this.pendingDownload);
      recorder.onerror = () => {
        finish(false);
        this.onError("音訊錄製發生錯誤；MIDI 演奏仍會繼續錄製");
      };
      recorder.start(250);
      this.recorder = recorder;
      return true;
    } catch (error) {
      handle.dispose();
      throw new Error(error instanceof Error ? error.message : "無法啟動音訊錄製");
    }
  }

  stop(download = true) {
    const recorder = this.recorder;
    if (!recorder) return false;
    this.stopping = true;
    this.pendingDownload = download;
    if (recorder.state !== "inactive") recorder.stop();
    else recorder.onstop?.call(recorder, new Event("stop"));
    return true;
  }
}
