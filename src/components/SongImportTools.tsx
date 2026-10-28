import { useRef } from "react";
import { Link2, Music2, Upload } from "lucide-react";
import type { Song } from "../music/model";
import { SongLibraryPanel } from "./SongLibraryPanel";

export function SongImportTools({
  song,
  url,
  loading,
  status,
  rotate,
  urlInputActive,
  onUrlChange,
  onUrlInputActiveChange,
  onChooseFile,
  onFetchSong,
  onLoadDefault,
  onLoadDemo,
  onClearSong,
  onLibraryLoad,
  onSharePractice,
  onRestoreOriginal,
  shareNotice,
  hasOriginalComparison,
}: {
  song: Song | null;
  url: string;
  loading: boolean;
  status: string;
  rotate: boolean;
  urlInputActive: boolean;
  onUrlChange: (url: string) => void;
  onUrlInputActiveChange: (active: boolean) => void;
  onChooseFile: (accept: string) => void;
  onFetchSong: () => void;
  onLoadDefault: () => void;
  onLoadDemo: () => void;
  onClearSong: () => void;
  onLibraryLoad: (song: Song, position: number) => void;
  onSharePractice: () => void;
  onRestoreOriginal: () => void;
  shareNotice: string;
  hasOriginalComparison: boolean;
}) {
  const urlInputRef = useRef<HTMLInputElement>(null);
  const activateUrlInput = () => onUrlInputActiveChange(true);
  const fetchSong = () => {
    onUrlInputActiveChange(false);
    onFetchSong();
  };

  return (
    <section className="midi-desk" aria-label="MIDI 放置區">
      <span className="eyebrow">MIDI PLAYER</span>
      <h3>把演奏檔放在這裡</h3>
      <p className="mobile-current-song">目前曲目：{song?.title || "自由演奏"}</p>
      <button className="midi-drop-slot" onClick={() => onChooseFile(".mid,.midi")}>
        <Upload size={25} />
        <strong>放入 MIDI 檔案</strong>
        <span>點擊選擇，或將 .mid 拖進此區</span>
        <small>{song ? "目前：" + song.title : "尚未放入 MIDI"}</small>
      </button>{" "}
      <section
        className="import-box"
        onBlurCapture={(event) => {
          if (
            urlInputActive &&
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) onUrlInputActiveChange(false);
        }}
      >
        <div
          className="url-row"
          onClickCapture={() => {
            if (rotate && !urlInputActive) activateUrlInput();
          }}
        >
          <Link2 size={18} />
          <input
            aria-label="詩歌網址"
            ref={urlInputRef}
            value={url}
            onFocus={() => { if (rotate) activateUrlInput(); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") fetchSong();
              if (event.key === "Escape") onUrlInputActiveChange(false);
            }}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="貼上 hymnal.net 詩歌網址"
          />
          <button
            className="primary"
            disabled={loading}
            onClick={() => {
              if (rotate && !urlInputActive) {
                activateUrlInput();
                requestAnimationFrame(() => urlInputRef.current?.focus());
                return;
              }
              fetchSong();
            }}
          >
            {loading ? "載入中…" : "載入樂譜"}
            <span>↗</span>
          </button>
        </div>
        {urlInputActive && <div className="portrait-input-notice" role="status">
          已暫時轉回直向
          <button type="button" onClick={() => onUrlInputActiveChange(false)}>取消</button>
        </div>}
        <div className="import-bottom">
          <div className="import-actions">
            <button onClick={() => onChooseFile(".mid,.midi")}>
              <Upload size={14} /> 匯入 MIDI
            </button>
            <button onClick={() => onChooseFile(".xml,.musicxml")}>
              <Music2 size={14} /> 匯入 MusicXML
            </button>
            <span className="separator" />
            <button onClick={onLoadDefault}>載入預設曲</button>
            <button onClick={onLoadDemo}>小星星測試</button>
            <button onClick={onClearSong}>清除</button>
          </div>
          <span className="local-badge"><span />檔案僅在瀏覽器處理</span>
        </div>
        <div className="status" role="status">
          {status}
          {status.includes("手動") && <a href={url} target="_blank" rel="noreferrer">開啟原網站 ↗</a>}
        </div>
        <SongLibraryPanel song={song} onLoad={onLibraryLoad} />
        {song && <div className="practice-share-row">
          <button type="button" onClick={onSharePractice}>分享練習設定</button>
          {hasOriginalComparison && <button type="button" onClick={onRestoreOriginal}>返回原曲</button>}
          {shareNotice && <span className="practice-share-notice" role="status">{shareNotice}</span>}
        </div>}
      </section>
    </section>
  );
}
