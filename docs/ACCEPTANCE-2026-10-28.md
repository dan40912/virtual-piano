# 2026-10-28 收尾驗收紀錄

本紀錄只列本次已取得的證據，不取代 Android 真機驗收。

- 使用者已授權：全部完成後推送 GitHub 與 GPT Sites；目前尚未發布。
- 來源測試：`npx vitest run --exclude "site-publish/**" --exclude ".sites-stage/**"`，35 個檔案、128 項通過。
- 原規格僅排除 site-publish 的指令也已執行；它額外掃入 .sites-stage 發布副本，該副本有 9 項 React 重複實例相關失敗。沒有修改副本來掩蓋失敗。
- `npm run build` 通過。入口 JS 652.29 kB，gzip 187.50 kB；入口 CSS 183.63 kB，gzip 27.16 kB。首次 JS 小於改版前的目標仍未達到。
- 五線譜切換的持續掛載修正已存在來源程式，新增測試涵蓋首次隱藏不掛載、切換與轉調保留 DOM、更換 MIDI 清除舊譜。尚待正式建置瀏覽器走查確認實際 OSMD SVG 保留。
- 手動輸入程式路徑 8 次量測見 manual-input-latency-2026-10-28.json：0.6–2.2 ms，中位數 0.9 ms。這不是觸控到喇叭的實際延遲；AudioContext baseLatency 10 ms，outputLatency 未提供。
- 面板組合證據見 panel-combinations-2026-10-28.json；純鍵盤幾何證據見 pure-keyboard-geometry.json。這些是瀏覽器尺寸驗證，不能作為多指真機通過證據。

## 尚待完成

1. 最新建置的 MusicXML → Piano Roll → MusicXML 瀏覽器回歸已完成：Studio Study 五線譜 SVG 數量依序為 1、1、1，切到 Roll 時 host hidden=true，返回後 hidden=false、SVG 寬 1115.02px。截圖：screenshots/persistent-sheet-2026-10-28.jpg。此驗證證明 SVG 保留；沒有把它當成真機或所有版面切換的證據。
2. Samsung A55 純鍵盤只剩琴鍵與退出 X 的正向真機回覆，以及多指、滑奏、旋轉、返回後播放狀態。
3. 首次載入 JS 體積目標的實際改善。
4. iOS 與實體 MIDI 的裝置測試、桌機前後畫面比對等既定驗收缺口。
5. 完成來源審查、提交、GitHub 推送與 GPT Sites 發布。

## 最新純鍵盤補驗

正式建置 IAB 視窗 360×800 → 800×360：兩者可見的非琴鍵按鈕都只有「退出純鍵盤模式並返回原畫面」，可見 range 滑桿 0，頁面無水平溢出。退出後 data-keyboard-only=false，原本五線譜 SVG 仍為 1 且 host 可見。截圖 pure-latest-360-2026-10-28.jpg、pure-latest-800-2026-10-28.jpg。此工具的指標仍是 fine pointer，不能代表 Samsung 的 coarse pointer 旋轉路徑或多指觸控。

本機預覽已重新啟動於 4174；區網入口 http://192.168.1.117:4174/。

## Android 最新回覆（失敗）

使用者重新測試回覆「仍有工具列或滑桿」，再具體指出「上方琴蓋／播放工具列」。因此純鍵盤 Android 驗收仍為失敗；上述 fine pointer 尺寸結果不能覆蓋此結果。已交 Luna High 追查觸控／旋轉路徑，另待確認殘留當下是否有退出 X。

後續使用者再回報「現在開啟純鍵盤之後，看不到任何按鍵了」。此為更嚴重的最新失敗結果，優先級高於所有過往尺寸通過紀錄。目前仍需定位裝置／方向下的實際尺寸與可見性，不宣稱已修復。

## 初始體積調查

Luna High 在暫存輸出進行 sourcemap／build-only 變換：將 MembraneSynth 改成可選 factory 動態入口，主包仍約 652.46 kB / gzip 187.58 kB，factory 反向從主包引用 MembraneSynth，沒有有效減少初始載入。故未將這項實驗套用來源程式或正式 dist；不以 chunk 數量增加冒充體積改善。

Luna High 實作代理本次遇到用量限制而停止；依使用者先前指定維持相同模型，未改由其他模型繼續實作。

## 本次發布版本（2026-10-28）

使用者另行明確要求「更新目前資訊上 GitHub 還有 GPT Site」，因此發布目前可建置版本，不將發布解讀為五路線與真機驗收全部完成。

- 最終來源測試：37 檔、133 項通過；正式建置成功。
- 純鍵盤暫停有效 rotate（包含 Piano 觸控座標），退出恢復原方向偏好；stage 使用實體視窗，不強制 CSS 旋轉。方向狀態測試通過。Android 原回報的空白琴鍵仍需真機複驗，尚未確認根因。
- 正式建置桌面 UI：預設曲可載入 241 音／38 秒，進入純鍵盤後 keys 尺寸1558×884、有效 rotate=false，可見非琴鍵按鈕只有退出；退出可恢復。
- 預設曲改為非同步 chunk；併發請求共用，失敗可重試，使用者選曲／清除優先於背景載入。入口 JS592.86kB/gzip176.25kB，預設曲chunk61.40kB/gzip10.27kB。曲目仍於無近期曲目時背景下載，不能把入口變小等同總下載變小。
- 曲目識別改為完整內容 v2 指紋，避免同名但時值／力度不同的修訂曲套用錯誤配置。舊 v1 分享與偏好鍵無法安全辨識，不自動遷移。
- 發布前畫面：screenshots/release-2026-10-28.jpg。
