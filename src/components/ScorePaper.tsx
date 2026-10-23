import { useEffect, useRef, useState } from "react";
import { Upload, FileMusic, X } from "lucide-react";
export function ScorePaper({
  onXml,
}: {
  onXml: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [score, setScore] = useState<{
      url: string;
      name: string;
      type: "image" | "pdf";
    } | null>(null),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (score) URL.revokeObjectURL(score.url);
    },
    [score],
  );
  const load = async (file: File) => {
    setError("");
    if (file.size > 20 * 1024 * 1024) {
      setError("琴譜檔案上限 20 MB");
      return;
    }
    if (/\.(musicxml|xml)$/i.test(file.name)) {
      await onXml(file);
      return;
    }
    const pdf = /\.pdf$/i.test(file.name);
    if (!pdf && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setError("請選 PDF、PNG、JPG、WebP 或 MusicXML 琴譜");
      return;
    }
    setScore({
      url: URL.createObjectURL(file),
      name: file.name,
      type: pdf ? "pdf" : "image",
    });
  };
  return (
    <div
      className={"score-paper " + (score ? "has-score" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files[0]) void load(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg,.webp,.musicxml,.xml"
        aria-label="選擇琴譜檔案"
        onChange={(e) => {
          if (e.target.files?.[0]) void load(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {score ? (
        <>
          <div className="score-document-bar">
            <span>{score.name}</span>
            <button onClick={() => input.current?.click()}>更換琴譜</button>
            <button aria-label="移除琴譜" onClick={() => setScore(null)}>
              <X size={13} />
            </button>
          </div>
          {score.type === "pdf" ? (
            <object
              type="application/pdf"
              data={score.url}
              aria-label={score.name}
            >
              <p>
                此瀏覽器無法內嵌 PDF。
                <a href={score.url} target="_blank" rel="noreferrer">
                  開啟琴譜
                </a>
              </p>
            </object>
          ) : (
            <img
              src={score.url}
              alt={score.name}
              onError={() => setError("無法顯示這張圖片，請改用 PNG 或 JPG")}
            />
          )}
        </>
      ) : (
        <button className="place-score" onClick={() => input.current?.click()}>
          <FileMusic size={32} />
          <strong>把琴譜放上譜架</strong>
          <span>點擊或拖放 PDF、圖片、MusicXML</span>
          <span className="paper-upload">
            <Upload size={13} />
            選擇琴譜
          </span>
        </button>
      )}
      <p className="score-file-status" role="status">
        {error || "琴譜供閱讀；可在右側另放 MIDI 演奏。"}
      </p>
    </div>
  );
}
