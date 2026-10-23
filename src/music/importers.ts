import { Midi } from "@tonejs/midi";
import type { Song, Note } from "./model";
export function importedTitle(name: string, fallback: string) {
  if (/steinway\s+piano\s+stage/i.test(name)) {
    return /steinway\s+piano\s+stage/i.test(fallback)
      ? "匯入的鋼琴曲"
      : fallback.replace(/\.midi?$/i, "");
  }
  return name || fallback;
}
export function parseMidi(data: ArrayBuffer, title: string): Song {
  const m = new Midi(data);
  const notes: Note[] = m.tracks.flatMap((t, i) =>
    t.notes.map((n, j) => ({
      id: `${i}-${j}`,
      midi: n.midi,
      startTime: n.time,
      duration: n.duration,
      velocity: n.velocity,
      trackId: i,
    })),
  );
  if (!notes.length) throw Error("MIDI 沒有可演奏音符");
  return {
    title: importedTitle(m.name, title),
    source: "本機 MIDI · 檔案留在瀏覽器",
    tempo: m.header.tempos[0]?.bpm || 120,
    timeSignature: (m.header.timeSignatures[0]?.timeSignature as [
      number,
      number,
    ]) || [4, 4],
    notes: notes.sort((a, b) => a.startTime - b.startTime),
    duration: m.duration,
    tracks: m.tracks.map((t, i) =>
      /steinway\s+piano\s+stage/i.test(t.name)
        ? "鋼琴"
        : t.name || `音軌 ${i + 1}`,
    ),
    pedals: m.tracks.flatMap((t, i) =>
      (t.controlChanges[64] || []).map((c) => ({
        time: c.time,
        down: c.value >= 0.5,
        trackId: i,
      })),
    ),
    tempos: m.header.tempos.map((t) => ({
      time: m.header.ticksToSeconds(t.ticks),
      bpm: t.bpm,
    })),
    signatures: m.header.timeSignatures.map((t) => ({
      time: m.header.ticksToSeconds(t.ticks),
      value: t.timeSignature,
    })),
  };
}
export { parseMusicXml as parseXml } from "./MusicXml";
export function validateHymnal(raw: string) {
  const u = new URL(raw);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !["hymnal.net", "www.hymnal.net"].includes(u.hostname) ||
    !/^\/(?:[a-z]{2}\/)?hymn\/[a-z]+\/\d+\/?$/.test(u.pathname) ||
    u.username ||
    u.password
  )
    throw Error("請輸入有效的 hymnal.net 詩歌網址");
  return u;
}
export async function importHymnal(raw: string): Promise<Song> {
  const u = validateHymnal(raw);
  const r = await fetch(u.href, {
    signal: AbortSignal.timeout(12000),
    credentials: "omit",
  });
  if (!r.ok) throw Error("來源無法讀取");
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  const links = Array.from(doc.querySelectorAll("a[href]"));
  const link = links.find((a) =>
    /\.mid(i)?(?:\?|$)/i.test(a.getAttribute("href") || ""),
  );
  if (!link) throw Error("來源未提供可直接讀取的 MIDI");
  const midiUrl = new URL(link.getAttribute("href")!, u);
  if (
    !["https:", "http:"].includes(midiUrl.protocol) ||
    !["hymnal.net", "www.hymnal.net"].includes(midiUrl.hostname)
  )
    throw Error("MIDI 不在支援的來源網域");
  const mr = await fetch(midiUrl, {
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
  });
  if (!mr.ok) throw Error("MIDI 下載失敗");
  const song = parseMidi(await mr.arrayBuffer(), doc.title);
  return { ...song, source: u.href };
}
