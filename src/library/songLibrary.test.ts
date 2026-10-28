import { describe, expect, it } from "vitest";
import { demo } from "../music/model";
import { readLastSong, recentSongs, rememberPosition, rememberSong } from "./songLibrary";
function memory() {
  let data = "[]";
  return { getItem: () => data, setItem: (_key: string, value: string) => { data = value; } };
}
describe("recent songs and resume", () => {
  it("restores a complete local song and checkpoint without duplicating it", () => {
    const db = memory();
    rememberSong(demo, 5, db);
    rememberPosition(demo, 9, db);
    expect(readLastSong(db)?.song.notes).toEqual(demo.notes);
    expect(readLastSong(db)?.position).toBe(9);
    rememberSong(demo, 11, db);
    expect(recentSongs(db)).toHaveLength(1);
  });
  it("bounds history, rejects invalid data and reports storage failures", () => {
    const db = memory();
    for (let i = 0; i < 10; i++) rememberSong({ ...demo, title: `曲${i}` }, 0, db);
    expect(recentSongs(db)).toHaveLength(8);
    expect(readLastSong(db)?.song.title).toBe("曲9");
    db.setItem("", '{"broken":true}');
    expect(recentSongs(db)).toEqual([]);
    expect(() => rememberSong(demo, 0, { getItem: () => null, setItem: () => { throw Error("quota"); } })).toThrow("儲存");
  });
});
