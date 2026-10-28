import { useEffect, useState } from "react";
import type { Song } from "../music/model";
import { Sheet } from "./Visuals";

export function PersistentSheetHost({
  visible,
  song,
  transpose,
}: {
  visible: boolean;
  song: Song | null;
  transpose: number;
}) {
  const [mounted, setMounted] = useState(false);
  const available = Boolean(song?.xml && transpose === 0);

  useEffect(() => {
    if (visible && available) setMounted(true);
  }, [visible, available]);

  return (
    <div className="sheet-host" hidden={!visible || !available}>
      {mounted && song?.xml && (
        <>
          <p className="sheet-note">
            MusicXML 原始記譜 · 游標依原始音符位置同步追蹤。
          </p>
          <Sheet song={song} />
        </>
      )}
    </div>
  );
}
