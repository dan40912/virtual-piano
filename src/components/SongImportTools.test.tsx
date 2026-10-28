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
  onUrlChange: vi.fn(),
  onUrlInputActiveChange: vi.fn(),
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
      status="需要手動上傳：目前無法從此網址直接取得 MIDI"
      rotate={false}
      urlInputActive={false}
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

it("routes file selection, default/demo/clear, share, and restore actions through explicit callbacks", async () => {
  await clickButton("放入 MIDI 檔案");
  await clickButton("匯入 MIDI");
  await clickButton("匯入 MusicXML");
  expect(callbacks.onChooseFile.mock.calls).toEqual([[".mid,.midi"], [".mid,.midi"], [".xml,.musicxml"]]);

  await clickButton("載入預設曲");
  await clickButton("小星星測試");
  await clickButton("清除");
  await clickButton("分享練習設定");
  await clickButton("返回原曲");
  expect(callbacks.onLoadDefault).toHaveBeenCalledOnce();
  expect(callbacks.onLoadDemo).toHaveBeenCalledOnce();
  expect(callbacks.onClearSong).toHaveBeenCalledOnce();
  expect(callbacks.onSharePractice).toHaveBeenCalledOnce();
  expect(callbacks.onRestoreOriginal).toHaveBeenCalledOnce();
});

it("keeps URL loading, CORS guidance, and recent-song save/load available", async () => {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="詩歌網址"]')!;
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(callbacks.onUrlInputActiveChange).toHaveBeenCalledWith(false);
  expect(callbacks.onFetchSong).toHaveBeenCalledOnce();
  expect(container.querySelector('.status a')?.getAttribute("href")).toBe("https://www.hymnal.net/zh/hymn/ch/471");

  await clickButton("儲存目前曲目與位置");
  await clickButton("繼續練習");
  expect(callbacks.onLibraryLoad).toHaveBeenCalledWith(expect.objectContaining({ title: demo.title }), expect.any(Number));
});

it("requests portrait mode when rotated URL controls are activated", async () => {
  await act(async () => root.render(
    <SongImportTools
      song={demo}
      url="https://www.hymnal.net/zh/hymn/ch/471"
      loading={false}
      status=""
      rotate
      urlInputActive={false}
      shareNotice=""
      hasOriginalComparison={false}
      {...callbacks}
    />,
  ));
  await clickButton("載入樂譜");
  expect(callbacks.onUrlInputActiveChange).toHaveBeenCalledWith(true);
});
