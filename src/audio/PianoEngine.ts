import * as Tone from "tone";
import { voiceStyles, styledVelocity, type PianoStyle } from "./styles";
export class PianoEngine {
  style: PianoStyle = "natural";
  filter?: Tone.Filter;
  sampler?: Tone.Sampler;
  reverb?: Tone.Reverb;
  gain?: Tone.Gain;
  pending?: Promise<void>;
  state = "尚未啟動";
  onState = (s: string) => {
    this.state = s;
  };
  held = new Map<string, number>();
  sustained = new Set<number>();
  pedal = false;
  pedals = new Set<string>();
  async ready() {
    await Tone.start();
    if (this.sampler?.loaded) return;
    if (this.pending) return this.pending;
    this.onState("正在載入 Grand Piano…");
    this.pending = new Promise<void>((resolve, reject) => {
      const urls: Record<string, string> = {};
      for (let o = 1; o <= 7; o++)
        for (const n of ["C", "Ds", "Fs", "A"])
          urls[n.replace("s", "#") + o] = n + o + ".mp3";
      this.gain = new Tone.Gain(0.7).connect(
        new Tone.Limiter(-3).toDestination(),
      );
      this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.18 }).connect(
        this.gain,
      );
      this.filter = new Tone.Filter({
        type: "lowpass",
        frequency: voiceStyles[this.style].cutoff,
        rolloff: -24,
      }).connect(this.reverb);
      this.sampler = new Tone.Sampler({
        urls,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        release: voiceStyles[this.style].release,
        attack: voiceStyles[this.style].attack,
        onload: () => {
          this.onState("Grand Piano 已就緒");
          resolve();
        },
        onerror: () => {
          this.onState("音源載入失敗，點此重試");
          this.sampler?.dispose();
          this.pending = undefined;
          reject(Error("鋼琴音源載入失敗，請檢查網路並重試"));
        },
      }).connect(this.filter);
    });
    return this.pending;
  }
  now() {
    return Tone.now();
  }
  attack(id: string, n: number, velocity = 0.75, time?: number) {
    if (n < 21 || n > 108 || !this.sampler?.loaded) return;
    this.held.set(id, n);
    this.sustained.delete(n);
    this.sampler.triggerAttack(
      Tone.Frequency(n, "midi").toFrequency(),
      time,
      styledVelocity(velocity, this.style),
    );
  }
  release(id: string, time?: number) {
    const n = this.held.get(id);
    if (n === undefined) return;
    this.held.delete(id);
    if ([...this.held.values()].includes(n)) return;
    if (this.pedal) this.sustained.add(n);
    else
      this.sampler?.triggerRelease(
        Tone.Frequency(n, "midi").toFrequency(),
        time,
      );
  }
  sustain(down: boolean, time?: number, source = "manual") {
    down ? this.pedals.add(source) : this.pedals.delete(source);
    this.pedal = this.pedals.size > 0;
    if (!this.pedal) {
      for (const n of this.sustained)
        if (![...this.held.values()].includes(n))
          this.sampler?.triggerRelease(
            Tone.Frequency(n, "midi").toFrequency(),
            time,
          );
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
