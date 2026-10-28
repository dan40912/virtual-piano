import type { Note, Song } from "../music/model";
export class LiveRecorder {
  recording = false;
  notes: Note[] = [];
  pedals: Song["pedals"] = [];
  held = new Map<string, { midi: number; time: number; velocity: number }>();
  origin = 0;
  duration = 0;
  onChange = () => {};
  constructor(private clock = () => performance.now() / 1000) {}
  start() {
    this.notes = [];
    this.pedals = [];
    this.held.clear();
    this.origin = this.clock();
    this.duration = 0;
    this.recording = true;
    this.onChange();
  }
  elapsed() {
    return this.recording ? Math.max(0, this.clock() - this.origin) : this.duration;
  }
  attack(id: string, midi: number, velocity: number) {
    if (!this.recording || this.held.has(id)) return;
    this.held.set(id, { midi, time: this.clock() - this.origin, velocity });
    this.onChange();
  }
  release(id: string) {
    const n = this.held.get(id);
    if (!this.recording || !n) return;
    this.notes.push({
      id: `r${this.notes.length}`,
      midi: n.midi,
      startTime: n.time,
      duration: Math.max(0.03, this.clock() - this.origin - n.time),
      velocity: n.velocity,
      trackId: 0,
    });
    this.held.delete(id);
    this.onChange();
  }
  pedal(down: boolean) {
    if (!this.recording) return;
    if (this.pedals.at(-1)?.down === down) return;
    this.pedals.push({ time: this.clock() - this.origin, down, trackId: 0 });
  }
  stop() {
    if (!this.recording) return;
    for (const id of [...this.held.keys()]) this.release(id);
    this.pedal(false);
    this.duration = Math.max(0.1, this.clock() - this.origin);
    this.recording = false;
    this.onChange();
  }
  song(): Song {
    return {
      title: "我的演奏",
      source: "本機錄製 · 真實按鍵與和弦事件",
      tempo: 120,
      timeSignature: [4, 4],
      notes: [...this.notes].sort((a, b) => a.startTime - b.startTime),
      duration: this.duration,
      tracks: ["我的演奏"],
      pedals: [...this.pedals],
      tempos: [{ time: 0, bpm: 120 }],
      signatures: [],
    };
  }
}
export const recorder = new LiveRecorder();
