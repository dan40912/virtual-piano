export type ChordVoicing = "block" | "arpeggio" | "accompaniment";
export type ChordFeel = "gentle" | "bold" | "bright";
export type ChordAttack = (id: string, midi: number, velocity: number) => void;
export type ChordRelease = (id: string) => void;

const feelVelocity: Record<ChordFeel, number> = {
  gentle: 0.42,
  bold: 0.96,
  bright: 0.78,
};

/** Owns all repeating chord timers and note IDs so stop/release is always complete. */
export class ChordPerformance {
  private timers = new Map<string, Set<ReturnType<typeof setTimeout>>>();
  private active = new Map<string, Set<string>>();
  private serial = 0;
  private sessionSerial = 0;
  private sessions = new Map<string, number>();
  constructor(
    private attack: ChordAttack,
    private releaseNote: ChordRelease,
  ) {}

  private later(owner: string, fn: () => void, delay: number) {
    const timer = setTimeout(() => {
      const timers = this.timers.get(owner);
      timers?.delete(timer);
      if (timers && !timers.size) this.timers.delete(owner);
      fn();
    }, delay);
    const timers =
      this.timers.get(owner) || new Set<ReturnType<typeof setTimeout>>();
    timers.add(timer);
    this.timers.set(owner, timers);
    return timer;
  }

  private hit(
    owner: string,
    midi: number,
    velocity: number,
    duration?: number,
  ) {
    const id = `chord-perf:${this.serial++}`;
    const ids = this.active.get(owner) || new Set<string>();
    ids.add(id);
    this.active.set(owner, ids);
    this.attack(id, midi, velocity);
    if (duration !== undefined)
      this.later(owner, () => this.releaseId(owner, id), duration);
  }

  private releaseId(owner: string, id: string) {
    const ids = this.active.get(owner);
    if (!ids?.delete(id)) return;
    this.releaseNote(id);
    if (!ids.size) this.active.delete(owner);
  }

  start(
    owner: string,
    notes: number[],
    voicing: ChordVoicing,
    feel: ChordFeel,
  ) {
    this.release(owner);
    if (!notes.length) return;
    const session = ++this.sessionSerial;
    this.sessions.set(owner, session);
    const velocity = feelVelocity[feel];
    if (voicing === "block") {
      notes.forEach((midi) => this.hit(owner, midi, velocity));
      return;
    }
    let step = 0;
    const tick = () => {
      if (this.sessions.get(owner) !== session) return;
      if (voicing === "arpeggio") {
        this.hit(
          owner,
          notes[step % notes.length],
          velocity,
          feel === "gentle" ? 190 : 125,
        );
        step++;
        this.later(owner, tick, feel === "bright" ? 110 : 145);
      } else {
        // A repeating bass, upper chord, bass, full-chord accompaniment pattern.
        const pattern = [[notes[0]], notes.slice(1), [notes[0]], notes];
        const length = feel === "gentle" ? 510 : feel === "bold" ? 285 : 215;
        pattern[step % pattern.length].forEach((midi) =>
          this.hit(owner, midi, velocity, length),
        );
        step++;
        this.later(owner, tick, feel === "bright" ? 245 : 310);
      }
    };
    tick();
  }

  playProgression(owner: string, progression: number[][], feel: ChordFeel) {
    this.release(owner);
    const session = ++this.sessionSerial;
    this.sessions.set(owner, session);
    const velocity = feelVelocity[feel];
    progression.forEach((notes, chordIndex) => {
      this.later(
        owner,
        () => {
          if (this.sessions.get(owner) !== session) return;
          notes.forEach((midi) =>
            this.hit(owner, midi, velocity, feel === "gentle" ? 650 : 490),
          );
        },
        chordIndex * 720,
      );
    });
    this.later(
      owner,
      () => {
        if (this.sessions.get(owner) === session) this.release(owner);
      },
      progression.length * 720 + 700,
    );
  }

  release(owner: string) {
    this.sessions.delete(owner);
    for (const timer of this.timers.get(owner) || []) clearTimeout(timer);
    this.timers.delete(owner);
    const ids = this.active.get(owner);
    if (ids) for (const id of [...ids]) this.releaseId(owner, id);
  }

  stop() {
    for (const timers of this.timers.values())
      for (const timer of timers) clearTimeout(timer);
    this.timers.clear();
    this.sessions.clear();
    for (const ids of this.active.values())
      for (const id of ids) this.releaseNote(id);
    this.active.clear();
  }
}
