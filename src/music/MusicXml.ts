import type { Note, Song } from "./model";
// MusicXML note durations are converted from quarter-note beats using the complete tempo map.
export function parseMusicXml(text: string, title: string): Song {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("MusicXML 格式錯誤");
  if (!doc.querySelector("score-partwise"))
    throw Error("請使用未壓縮的 partwise MusicXML（.musicxml / .xml）");
  if (
    doc.querySelector(
      "repeat, ending, sound[segno], sound[dacapo], sound[dalsegno]",
    )
  )
    throw Error("MusicXML 包含反覆記號；請先匯出展開反覆的 MIDI。");
  if (doc.querySelector("grace, ornament, tremolo"))
    throw Error("此 MusicXML 包含尚未支援的裝飾演奏；請改用 MIDI 以保留演奏。");
  const raw: Note[] = [];
  const tempos: { beat: number; bpm: number }[] = [];
  const signatures: { beat: number; value: [number, number] }[] = [];
  const tracks: string[] = [];
  let endBeat = 0;
  doc.querySelectorAll("score-partwise > part").forEach((part, trackId) => {
    const id = part.getAttribute("id");
    tracks.push(
      Array.from(doc.querySelectorAll("score-part"))
        .find((p) => p.getAttribute("id") === id)
        ?.querySelector("part-name")?.textContent || `聲部 ${trackId + 1}`,
    );
    let cursor = 0,
      divisions = 1,
      lastStart = 0;
    const ties = new Map<string, Note>();
    part.querySelectorAll("measure").forEach((measure) => {
      const measureStart = cursor;
      let end = cursor;
      Array.from(measure.children).forEach((el) => {
        if (el.tagName === "attributes") {
          divisions =
            Number(el.querySelector("divisions")?.textContent) || divisions;
          const time = el.querySelector("time");
          if (time && trackId === 0)
            signatures.push({
              beat: cursor,
              value: [
                Number(time.querySelector("beats")?.textContent) || 4,
                Number(time.querySelector("beat-type")?.textContent) || 4,
              ],
            });
        }
        if (el.tagName === "direction" && trackId === 0) {
          const bpm =
            Number(el.querySelector("sound[tempo]")?.getAttribute("tempo")) ||
            Number(el.querySelector("per-minute")?.textContent);
          if (bpm > 0)
            tempos.push({
              beat:
                cursor +
                Number(el.querySelector("offset")?.textContent || 0) /
                  divisions,
              bpm,
            });
        }
        const d =
          Number(el.querySelector("duration")?.textContent || 0) / divisions;
        if (el.tagName === "backup") cursor -= d;
        if (el.tagName === "forward") cursor += d;
        if (el.tagName === "note") {
          const chord = !!el.querySelector("chord");
          const start = chord ? lastStart : cursor;
          const pitch = el.querySelector("pitch");
          if (pitch) {
            const step = pitch.querySelector("step")?.textContent || "C";
            const midi =
              (Number(pitch.querySelector("octave")?.textContent) + 1) * 12 +
              ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] || 0) +
              Number(pitch.querySelector("alter")?.textContent || 0);
            const key = `${midi}-${el.querySelector("voice")?.textContent || 1}-${el.querySelector("staff")?.textContent || 1}`;
            const stop = !!el.querySelector('tie[type="stop"]');
            const begins = !!el.querySelector('tie[type="start"]');
            const tied = stop ? ties.get(key) : undefined;
            let note: Note;
            if (tied) {
              note = tied;
              note.duration = start + d - note.startTime;
            } else {
              note = {
                id: `x${raw.length}`,
                midi,
                startTime: start,
                duration: d,
                velocity: 0.7,
                trackId,
              };
              raw.push(note);
            }
            if (begins) ties.set(key, note);
            else ties.delete(key);
          }
          if (!chord) {
            lastStart = cursor;
            cursor += d;
          }
          end = Math.max(end, start + d, cursor);
        }
      });
      cursor = Math.max(measureStart, end);
    });
    endBeat = Math.max(endBeat, cursor);
  });
  if (!raw.length) throw Error("MusicXML 沒有可演奏音符");
  tempos.sort((a, b) => a.beat - b.beat);
  if (!tempos.length || tempos[0].beat > 0)
    tempos.unshift({ beat: 0, bpm: 120 });
  const seconds = (beat: number) => {
    let time = 0;
    for (let i = 0; i < tempos.length; i++) {
      const t = tempos[i];
      if (beat <= t.beat) break;
      time +=
        ((Math.min(beat, tempos[i + 1]?.beat ?? beat) - t.beat) * 60) / t.bpm;
    }
    return time;
  };
  const notes = raw
    .map((n) => ({
      ...n,
      startTime: seconds(n.startTime),
      duration: seconds(n.startTime + n.duration) - seconds(n.startTime),
    }))
    .sort((a, b) => a.startTime - b.startTime);
  return {
    title: doc.querySelector("work-title")?.textContent || title,
    source: "本機 MusicXML · 保留原始記譜",
    tempo: tempos[0].bpm,
    timeSignature: signatures[0]?.value || [4, 4],
    notes,
    tracks,
    duration: seconds(endBeat),
    pedals: [],
    tempos: tempos.map((t) => ({ time: seconds(t.beat), bpm: t.bpm })),
    signatures: signatures.map((t) => ({
      time: seconds(t.beat),
      value: t.value,
    })),
    xml: text,
  };
}
