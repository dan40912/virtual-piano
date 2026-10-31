import type * as ToneModule from "tone";
import { voiceStyles, styledVelocity, type PianoStyle } from "./styles";

type Tone = typeof ToneModule;
const SAMPLE_BASE = "https://tonejs.github.io/audio/salamander/";
/** Four samples per octave across seven octaves; the sampler repitches between them. */
export const SAMPLE_FILES: [string, string][] = Array.from({ length: 7 }, (_, i) => i + 1).flatMap(
  (octave) => ["C", "Ds", "Fs", "A"].map((n): [string, string] => [n.replace("s", "#") + octave, `${n}${octave}.mp3`]),
);

export class PianoEngine {
  style: PianoStyle = "natural";
  /** Tone.js loads on demand so it stays out of the first paint. */
  tone?: Tone;
  private toneLoading?: Promise<Tone>;
  filter?: ToneModule.Filter;
  sampler?: ToneModule.Sampler;
  reverb?: ToneModule.Reverb;
  gain?: ToneModule.Gain;
  pending?: Promise<void>;
  state = "尚未啟動";
  volume = 0.7;
  reverbWet = 0.18;
  onState = (s: string) => {
    this.state = s;
  };
  /** Sample download progress, so the page can say "12 / 28" instead of "loading". */
  onProgress = (_loaded: number, _total: number) => {};
  held = new Map<string, number>();
  sustained = new Set<number>();
  pedal = false;
  pedals = new Set<string>();
  /** Fetch the audio library ahead of the first tap, ideally while the browser is idle. */
  preload() {
    this.toneLoading ??= import("tone").then((tone) => (this.tone = tone));
    return this.toneLoading;
  }
  async ready() {
    // Resume audio synchronously inside the gesture when the library is already
    // loaded; iOS only unlocks audio from within the tap itself.
    await (this.tone ? this.tone.start() : this.preload().then((tone) => tone.start()));
    const tone = this.tone!;
    if (this.sampler?.loaded) return;
    if (this.pending) return this.pending;
    this.pending = this.loadSamples(tone).catch(() => {
      this.onState("音源載入失敗，點此重試");
      this.pending = undefined;
      throw Error("鋼琴音源載入失敗，請檢查網路並重試");
    });
    return this.pending;
  }
  private async loadSamples(tone: Tone) {
    const total = SAMPLE_FILES.length;
    let loaded = 0;
    this.onState(`正在載入鋼琴音源 0 / ${total}`);
    this.onProgress(0, total);
    const buffers = await Promise.all(
      SAMPLE_FILES.map(async ([note, file]) => {
        const buffer = await new tone.ToneAudioBuffer().load(SAMPLE_BASE + file);
        loaded++;
        this.onProgress(loaded, total);
        this.onState(`正在載入鋼琴音源 ${loaded} / ${total}`);
        return [note, buffer] as const;
      }),
    );
    if (!this.gain) {
      this.gain = new tone.Gain(this.volume).connect(new tone.Limiter(-3).toDestination());
      this.reverb = new tone.Reverb({ decay: 2.5, wet: this.reverbWet }).connect(this.gain);
      this.filter = new tone.Filter({
        type: "lowpass",
        frequency: voiceStyles[this.style].cutoff,
        rolloff: -24,
      }).connect(this.reverb);
    }
    this.sampler?.dispose();
    this.sampler = new tone.Sampler({
      urls: Object.fromEntries(buffers),
      release: voiceStyles[this.style].release,
      attack: voiceStyles[this.style].attack,
    }).connect(this.filter!);
    this.onState("Grand Piano 已就緒");
  }
  now() {
    return this.tone?.now() ?? 0;
  }
  private frequency(n: number) {
    return this.tone!.Frequency(n, "midi").toFrequency();
  }
  /** Tap the existing instrument output without replacing its speaker path. */
  async createRecordingStream() {
    await this.ready();
    const context = this.tone!.getContext().rawContext as AudioContext;
    if (typeof context.createMediaStreamDestination !== "function" || !this.gain)
      throw Error("這個瀏覽器不支援音訊錄製，仍可錄製與匯出 MIDI。");
    const gain = this.gain;
    const destination = context.createMediaStreamDestination();
    gain.connect(destination);
    let disposed = false;
    return {
      stream: destination.stream,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        try { gain.disconnect(destination); }
        finally { destination.stream.getTracks().forEach((track) => track.stop()); }
      },
    };
  }
  audioLatency() {
    if (!this.tone) return { baseLatencyMs: null, outputLatencyMs: null };
    const context = this.tone.getContext().rawContext as AudioContext & {
      outputLatency?: number;
    };
    return {
      baseLatencyMs: Number.isFinite(context.baseLatency)
        ? Number((context.baseLatency * 1000).toFixed(2))
        : null,
      outputLatencyMs: Number.isFinite(context.outputLatency)
        ? Number((context.outputLatency! * 1000).toFixed(2))
        : null,
    };
  }
  attack(id: string, n: number, velocity = 0.75, time?: number) {
    if (n < 21 || n > 108 || !this.sampler?.loaded || !this.tone) return;
    this.held.set(id, n);
    this.sustained.delete(n);
    this.sampler.triggerAttack(
      this.frequency(n),
      time ?? this.tone.immediate(),
      styledVelocity(velocity, this.style),
    );
  }
  release(id: string, time?: number) {
    const n = this.held.get(id);
    if (n === undefined) return;
    this.held.delete(id);
    if ([...this.held.values()].includes(n)) return;
    if (this.pedal) this.sustained.add(n);
    else if (this.tone) this.sampler?.triggerRelease(this.frequency(n), time ?? this.tone.immediate());
  }
  sustain(down: boolean, time?: number, source = "manual") {
    down ? this.pedals.add(source) : this.pedals.delete(source);
    this.pedal = this.pedals.size > 0;
    if (!this.pedal) {
      for (const n of this.sustained)
        if (this.tone && ![...this.held.values()].includes(n))
          this.sampler?.triggerRelease(this.frequency(n), time ?? this.tone.immediate());
      this.sustained.clear();
    }
  }
  panic() {
    this.held.clear();
    this.sustained.clear();
    this.sampler?.releaseAll();
    this.pedal = false;
    this.pedals.clear();
  }
  settings(v: number, r: number, style: PianoStyle = "natural") {
    this.style = style;
    this.volume = v;
    this.reverbWet = r;
    const preset = voiceStyles[style];
    if (this.filter) this.filter.frequency.rampTo(preset.cutoff, 0.08);
    if (this.sampler) {
      this.sampler.attack = preset.attack;
      this.sampler.release = preset.release;
    }
    if (this.gain) this.gain.gain.rampTo(v, 0.05);
    if (this.reverb) this.reverb.wet.rampTo(r, 0.05);
  }
}
export const engine = new PianoEngine();
