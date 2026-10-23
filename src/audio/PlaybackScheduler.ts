import * as Tone from "tone";
import { engine } from "./PianoEngine";
import type { Note, Song } from "../music/model";

/** All note timing and loop boundaries run on Tone's audio-clock transport. */
export class PlaybackScheduler {
  playing = false;
  position = 0;
  speed = 1;
  transpose = 0;
  muted: number[] = [];
  noteFilter: ((note: Note) => boolean) | null = null;
  loop = false;
  a = 0;
  b = 0;
  metronome = false;
  silent = false;
  origin = 0;
  from = 0;
  raf = 0;
  onFrame = (_p: number) => {};
  onEnd = () => {};
  private positionListeners = new Set<() => void>();
  private activeNoteListeners = new Set<() => void>();
  private scheduledNotes = new Map<string, number>();
  private activeNoteSnapshot = new Set<number>();
  subscribePosition = (listener: () => void) => {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
  };
  subscribeActiveNotes = (listener: () => void) => {
    this.activeNoteListeners.add(listener);
    return () => this.activeNoteListeners.delete(listener);
  };
  getPositionSnapshot = () => this.position;
  getActiveNotesSnapshot = () => this.activeNoteSnapshot;
  setPosition(position: number) {
    this.position = position;
    this.positionListeners.forEach((listener) => listener());
  }
  private publishPosition() {
    this.positionListeners.forEach((listener) => listener());
  }
  private publishActiveNotes() {
    const next = new Set(this.scheduledNotes.values());
    if (
      next.size === this.activeNoteSnapshot.size &&
      [...next].every((midi) => this.activeNoteSnapshot.has(midi))
    )
      return;
    this.activeNoteSnapshot = next;
    this.activeNoteListeners.forEach((listener) => listener());
  }
  private attackScheduled(
    id: string,
    midi: number,
    velocity: number,
    time: number,
  ) {
    engine.attack(id, midi, velocity, time);
    this.scheduledNotes.set(id, midi);
    this.publishActiveNotes();
  }
  private releaseScheduled(id: string, time: number) {
    engine.release(id, time);
    this.scheduledNotes.delete(id);
    this.publishActiveNotes();
  }
  click?: Tone.MembraneSynth;
  start(song: Song) {
    this.stop(false);
    const looping = this.loop && this.b > this.a;
    const anchor = looping ? this.a : this.position;
    const limit = looping ? Math.min(this.b, song.duration) : song.duration;
    if (looping && (this.position < anchor || this.position >= limit))
      this.position = anchor;
    this.playing = true;
    this.from = this.position;
    this.origin = Tone.now() + 0.08;
    const transport = Tone.getTransport();
    transport.cancel();
    transport.seconds = 0;
    transport.loop = looping;
    transport.loopStart = 0;
    transport.loopEnd = Math.max(0.001, (limit - anchor) / this.speed);
    const offset = (this.position - anchor) / this.speed;
    const initialPedals = new Set<number>();
    for (const p of song.pedals.filter(
      (p) => p.time < anchor && !this.muted.includes(p.trackId),
    ))
      p.down ? initialPedals.add(p.trackId) : initialPedals.delete(p.trackId);
    let pedalTracks = new Set(initialPedals);
    // Restore pedal state after a seek, and on every native audio-clock loop.
    const seekPedals = new Set(initialPedals);
    for (const p of song.pedals.filter(
      (p) =>
        p.time >= anchor &&
        p.time < this.position &&
        !this.muted.includes(p.trackId),
    ))
      p.down ? seekPedals.add(p.trackId) : seekPedals.delete(p.trackId);
    pedalTracks = new Set(seekPedals);
    engine.sustain(seekPedals.size > 0, undefined, "auto");
    transport.schedule((t) => {
      pedalTracks = new Set(initialPedals);
      engine.sustain(pedalTracks.size > 0, t, "auto");
    }, 0);
    // Schedule pedals before note releases at matching timestamps.
    for (const p of song.pedals) {
      if (p.time < anchor || p.time >= limit || this.muted.includes(p.trackId))
        continue;
      transport.schedule(
        (t) => {
          p.down ? pedalTracks.add(p.trackId) : pedalTracks.delete(p.trackId);
          engine.sustain(pedalTracks.size > 0, t, "auto");
        },
        (p.time - anchor) / this.speed,
      );
    }
    for (const n of song.notes) {
      if (
        this.muted.includes(n.trackId) ||
        (this.noteFilter !== null && !this.noteFilter(n)) ||
        n.startTime + n.duration <= anchor ||
        n.startTime >= limit ||
        this.silent
      )
        continue;
      const start = Math.max(0, (n.startTime - anchor) / this.speed),
        end = Math.min(
          (n.startTime + n.duration - anchor) / this.speed,
          (limit - anchor) / this.speed - 0.0001,
        );
      transport.schedule(
        (t) =>
          this.attackScheduled(
            "auto" + n.id,
            n.midi + this.transpose,
            n.velocity,
            t,
          ),
        start,
      );
      transport.schedule(
        (t) => this.releaseScheduled("auto" + n.id, t),
        Math.max(start, end),
      );
      // Notes already sounding at a seek position are re-attacked at the new origin.
      if (start < offset && end > offset)
        transport.schedule(
          (t) =>
            this.attackScheduled(
              "auto" + n.id,
              n.midi + this.transpose,
              n.velocity,
              t,
            ),
          offset,
        );
    }
    if (this.metronome) {
      this.click ??= new Tone.MembraneSynth({ volume: -24 }).toDestination();
      const changes = song.tempos.length
        ? song.tempos
        : [{ time: 0, bpm: song.tempo }];
      changes.forEach((change, i) => {
        const until = Math.min(changes[i + 1]?.time ?? song.duration, limit);
        for (let t = change.time; t < until; t += 60 / change.bpm)
          if (t >= anchor)
            transport.schedule(
              (at) => this.click?.triggerAttackRelease("C6", "32n", at),
              (t - anchor) / this.speed,
            );
      });
    }
    if (looping)
      transport.schedule(
        (t) => engine.sustain(false, t, "auto"),
        Math.max(0, (limit - anchor) / this.speed - 0.00005),
      );
    else
      transport.schedule(
        (t) => {
          engine.sustain(false, t, "auto");
          Tone.getDraw().schedule(() => {
            this.position = song.duration;
            this.publishPosition();
            this.stop(false);
            this.onFrame(this.position);
            this.onEnd();
          }, t);
        },
        Math.max(0, (limit - anchor) / this.speed),
      );
    transport.start(this.origin, offset);
    const tick = () => {
      if (!this.playing) return;
      const elapsed = Math.max(0, Tone.immediate() - this.origin) * this.speed;
      this.position = looping
        ? anchor + ((this.from - anchor + elapsed) % (limit - anchor))
        : Math.min(song.duration, this.from + elapsed);
      this.onFrame(this.position);
      this.publishPosition();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop(reset = true) {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().loop = false;
    engine.panic();
    this.scheduledNotes.clear();
    this.publishActiveNotes();
    if (reset) {
      this.position = 0;
      this.publishPosition();
    }
  }
}
export const player = new PlaybackScheduler();
