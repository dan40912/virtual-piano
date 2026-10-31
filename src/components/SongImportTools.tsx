import { FileMusic, Music2, Share2, Upload } from "lucide-react";
import type { Song } from "../music/model";
import { SongLibraryPanel } from "./SongLibraryPanel";
import { StageSegmented } from "./StageControls";

export type StandView = "roll" | "sheet" | "score";

/** The "曲目" drawer section: pick, resume or import a song, and choose how it is shown. */
export function SongImportTools({
  song,
  url,
  loading,
  status,
  view,
  onViewChange,
  onUrlChange,
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
  view: StandView;
  onViewChange: (view: StandView) => void;
  onUrlChange: (url: string) => void;
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
  return (
    <div className="panel-grid shelf">
      <section className="panel-card">
        <h3>曲庫</h3>
        <div className="shelf-cards">
          <button type="button" className="shelf-card" disabled={loading} onClick={onLoadDefault}>
            <Music2 size={20} aria-hidden="true" />
            <strong>預設練習曲</strong>
            <span>詩歌 · 適合第一次練習</span>
          </button>
          <button type="button" className="shelf-card" disabled={loading} onClick={onLoadDemo}>
            <Music2 size={20} aria-hidden="true" />
            <strong>小星星</strong>
            <span>單手旋律 · 1 分鐘上手</span>
          </button>
        </div>
        <SongLibraryPanel song={song} onLoad={onLibraryLoad} />
      </section>

      <section className="panel-card">
        <h3>匯入自己的曲子</h3>
        <button type="button" className="drop-target" onClick={() => onChooseFile(".mid,.midi,.xml,.musicxml")}>
          <Upload size={22} aria-hidden="true" />
          <strong>選擇 MIDI 或 MusicXML 檔案</strong>
          <span>也可以直接把檔案拖進視窗任何地方 · 檔案只在你的瀏覽器處理</span>
        </button>
        <div className="button-row">
          <button type="button" onClick={() => onChooseFile(".mid,.midi")}>
            <Upload size={15} aria-hidden="true" /> 匯入 MIDI
          </button>
          <button type="button" onClick={() => onChooseFile(".xml,.musicxml")}>
            <FileMusic size={15} aria-hidden="true" /> 匯入 MusicXML
          </button>
          {song && <button type="button" className="quiet" onClick={onClearSong}>清除目前曲目</button>}
        </div>
        <details className="disclosure">
          <summary>從 hymnal.net 取得詩歌</summary>
          <p>
            瀏覽器通常無法直接讀取其他網站的檔案。請先在原網站下載 MIDI，再用上方按鈕匯入；
            也可以在這裡試試直接載入。
          </p>
          <div className="url-row">
            <input
              aria-label="詩歌網址"
              value={url}
              inputMode="url"
              onKeyDown={(event) => { if (event.key === "Enter") onFetchSong(); }}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://www.hymnal.net/zh/hymn/ch/471"
            />
            <button type="button" disabled={loading} onClick={onFetchSong}>
              {loading ? "載入中…" : "試著載入"}
            </button>
          </div>
          <a href={url} target="_blank" rel="noreferrer">開啟原網站下載 MIDI ↗</a>
        </details>
      </section>

      <section className="panel-card">
        <h3>顯示方式</h3>
        <StageSegmented<StandView>
          label="譜架內容"
          value={view}
          options={[
            { value: "roll", label: "音符瀑布" },
            { value: "sheet", label: "五線譜" },
            { value: "score", label: "琴譜圖片" },
          ]}
          onChange={onViewChange}
        />
        <p className="hint">五線譜需要 MusicXML；琴譜圖片可放 PDF、PNG 或 JPG 對照。</p>
        {song && (
          <>
            <h3>分享練習設定</h3>
            <div className="button-row">
              <button type="button" onClick={onSharePractice}>
                <Share2 size={15} aria-hidden="true" /> 複製分享連結
              </button>
              {hasOriginalComparison && <button type="button" onClick={onRestoreOriginal}>返回原曲</button>}
            </div>
            {shareNotice && <p className="hint" role="status">{shareNotice}</p>}
          </>
        )}
        <p className="status-line" role="status">{status}</p>
      </section>
    </div>
  );
}
