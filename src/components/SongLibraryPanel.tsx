import { useEffect, useState } from "react";
import { player } from "../audio/PlaybackScheduler";
import type { Song } from "../music/model";
import { recentSongs, rememberSong, type RecentSong } from "../library/songLibrary";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function SongLibraryPanel({ song, onLoad }: {
  song: Song | null;
  onLoad: (song: Song, position: number) => void;
}) {
  const [items, setItems] = useState<RecentSong[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { try { setItems(recentSongs()); } catch { setItems([]); } }, [song]);
  return (
    <div className="recent-songs">
      <div className="recent-head">
        <h4>最近練習 <span>{items.length}</span></h4>
        <button type="button" className="quiet" disabled={!song} onClick={() => {
          if (!song) return;
          try { setItems(rememberSong(song, player.position)); setMessage("已保存目前曲目與位置。"); }
          catch (error) { setMessage((error as Error).message); }
        }}>儲存目前曲目與位置</button>
      </div>
      {items.length ? (
        <ul>
          {items.map((entry) => (
            <li key={entry.id}>
              <span>
                <strong>{entry.song.title}</strong>
                <small>{entry.song.notes.length} 個音符 · 從 {clock(entry.position)} 繼續</small>
              </span>
              <button type="button" onClick={() => onLoad(entry.song, entry.position)}>繼續練習</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">匯入的曲子會留在這台裝置，下次接著練。</p>
      )}
      {message && <p className="hint" role="status">{message}</p>}
    </div>
  );
}
