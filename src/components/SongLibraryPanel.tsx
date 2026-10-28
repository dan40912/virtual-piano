import { useEffect, useState } from "react";
import { player } from "../audio/PlaybackScheduler";
import type { Song } from "../music/model";
import { recentSongs, rememberSong, type RecentSong } from "../library/songLibrary";
import "./song-library.css";
export function SongLibraryPanel({ song, onLoad }: {
  song: Song | null;
  onLoad: (song: Song, position: number) => void;
}) {
  const [items, setItems] = useState<RecentSong[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { try { setItems(recentSongs()); } catch { setItems([]); } }, [song]);
  return <details className="song-library-panel">
    <summary>最近練習 <span>{items.length}</span></summary>
    <button type="button" disabled={!song} onClick={() => {
      if (!song) return;
      try { setItems(rememberSong(song, player.position)); setMessage("曲目與目前位置已保存在這台裝置。"); }
      catch (error) { setMessage((error as Error).message); }
    }}>儲存目前曲目與位置</button>
    {items.length ? <ul>{items.map((entry) => <li key={entry.id}>
      <span><strong>{entry.song.title}</strong><small>{entry.song.notes.length} 音符 · 從 {Math.floor(entry.position / 60)}:{String(Math.floor(entry.position % 60)).padStart(2, "0")} 繼續</small></span>
      <button type="button" onClick={() => onLoad(entry.song, entry.position)}>繼續練習</button>
    </li>)}</ul> : <p>匯入後可保留曲目，下次接著練。</p>}
    <small>最近 8 首保存在此瀏覽器；超過容量時移除較早的最近曲目。請自行保留原始檔案。</small>
    {message && <p role="status">{message}</p>}
  </details>;
}
