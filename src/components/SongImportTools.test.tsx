// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SongImportTools } from "./SongImportTools";
import { demo } from "../music/model";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const callbacks = {
  onViewChange: vi.fn(),
  onUrlChange: vi.fn(),
  onChooseFile: vi.fn(),
  onFetchSong: vi.fn(),
  onLoadDefault: vi.fn(),
  onLoadDemo: vi.fn(),
  onClearSong: vi.fn(),
  onLibraryLoad: vi.fn(),
  onSharePractice: vi.fn(),
  onRestoreOriginal: vi.fn(),
};

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(
    <SongImportTools
      song={demo}
      url="https://www.hymnal.net/zh/hymn/ch/471"
      loading={false}
      status="小星星 · 解析成功"
      view="roll"
      shareNotice="分享連結已複製"
      hasOriginalComparison
      {...callbacks}
    />,
  ));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

async function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")].find((entry) => entry.textContent?.includes(label));
  expect(button, `button containing ${label}`).toBeTruthy();
  await act(async () => button!.click());
}

it("routes library, import, clear, view, share and restore actions through explicit callbacks", async () => {
  await clickButton("選擇 MIDI 或 MusicXML 檔案");
  await clickButton("匯入 MIDI");
  await clickButton("匯入 MusicXML");
  expect(callbacks.onChooseFile.mock.calls).toEqual([[".mid,.midi,.xml,.musicxml"], [".mid,.midi"], [".xml,.musicxml"]]);

  await clickButton("預設練習曲");
  await clickButton("小星星");
  await clickButton("清除目前曲目");
  await clickButton("五線譜");
  await clickButton("複製分享連結");
  await clickButton("返回原曲");
  expect(callbacks.onLoadDefault).toHaveBeenCalledOnce();
  expect(callbacks.onLoadDemo).toHaveBeenCalledOnce();
  expect(callbacks.onClearSong).toHaveBeenCalledOnce();
  expect(callbacks.onViewChange).toHaveBeenCalledWith("sheet");
  expect(callbacks.onSharePractice).toHaveBeenCalledOnce();
  expect(callbacks.onRestoreOriginal).toHaveBeenCalledOnce();
});

it("keeps hymnal.net loading as a secondary path and recent-song save/load available", async () => {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="詩歌網址"]')!;
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(callbacks.onFetchSong).toHaveBeenCalledOnce();
  expect(container.querySelector("details a")?.getAttribute("href")).toBe("https://www.hymnal.net/zh/hymn/ch/471");

  await clickButton("儲存目前曲目與位置");
  await clickButton("繼續練習");
  expect(callbacks.onLibraryLoad).toHaveBeenCalledWith(expect.objectContaining({ title: demo.title }), expect.any(Number));
});
