# 完整功能說明（技術細節）

使用 React 19、TypeScript、Vite、Tone.js、@tonejs/midi、Zustand 與 OpenSheetMusicDisplay 建立的純前端鋼琴工作室。預設繁體中文，無後端、帳號、資料庫或秘密金鑰。

## 啟動

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

`dist/` 是可部署的靜態網站。開發時開啟終端顯示的 localhost 網址；首次演奏須點擊琴鍵或「Grand Piano」啟動音訊並下載取樣。

## 操作

- 61 鍵 C2–C7 / 88 鍵 A0–C8；滑鼠、實體鍵盤與多點 Pointer Events，支援按住、滑奏、失焦釋放。
- 預設 `A W S E D F T G Y H U J K O L P ;` 依半音對應 C4–E5。Page Up / Page Down 切換八度，Space 延音。文字輸入與瀏覽器 Ctrl/Meta 快捷鍵不觸發演奏。
- 鍵盤設定：點選音符後按實體鍵，重複按鍵會警告；可解除、恢復預設、儲存多組配置、匯出 / 匯入 JSON。小型設定儲存在 localStorage。
- 音訊設定：Grand Piano、音量、殘響、固定觸鍵力度、手動轉調。實體電腦鍵盤沒有 velocity 感測器，不推測力度。
- 播放器：播放、暫停、停止、重播、Seek、0.25–2 倍速、±12 半音轉調、節拍器、A/B 循環與個別音軌開關。
- MIDI 在本機解析，多音軌、和弦、原始秒時間、力度、變拍、變速及 CC64 都保留；非鋼琴樂器音軌也以鋼琴演奏。超出 A0–C8 的音符明確提示並略過。
- 等待練習：同時按住當組全部音符才前進。節奏練習：按播放開始，主旋律靜音，以實際事件計算正確、錯誤、遺漏、完成率及平均時間誤差。容許誤差 ±100/200/300ms。音軌不推測左右手。
- Canvas Piano Roll 與音訊使用相同時間軸，支援音軌色彩、長度、轉調、縮放、水平位置同步。窄螢幕以鍵盤下方水平位置滑桿選擇音域。
- 未壓縮 partwise MusicXML 支援基本和弦、休止、變速、拍號、升降記號、連結線及多聲部。保留原始五線譜與同步游標，樂譜只在需要時載入。轉調後切換為準確的 Piano Roll，不展示未轉調的原譜。
- 拖放 MIDI / XML 至頁面或使用匯入按鈕。上限 20MB。

## hymnal.net

範例：`https://www.hymnal.net/zh/hymn/ch/471`

僅允許 HTTP(S)、明確的 hymnal.net 網域與詩歌路徑；拒絕帳密及偽冒網域。依序嘗試讀取公開 HTML 與其中的 MIDI 連結，設有逾時與失敗處理。沒有 Proxy、Cookie、憑證或批量抓取。

第三方跨來源讀取可能被 CORS 阻擋；此時顯示「需要手動上傳」並提供原站連結。請自行合法下載 MIDI 再匯入，其他功能持續可用。沒有取得資料時不推測歌名、調性或樂譜，不從圖片 / SVG 假造音符。這不是保證能直接讀取 hymnal.net 的服務。

## 測試素材

- `public/examples/studio-test.mid`：本專案原創八音練習，兩音軌、和弦、變速、延音 CC64。
- `public/examples/studio-study.musicxml`：本專案原創雙譜表練習，可驗證原始記譜與游標。
- 頁面內建「小星星」：公版旋律，本專案簡單編曲。

## 架構

- `src/audio/PianoEngine.ts`：取樣載入、音符持有者、物理按鍵與延音分離、輸出 limiter。
- `src/audio/PlaybackScheduler.ts`：Tone Transport Web Audio look-ahead 排程，requestAnimationFrame 僅用於畫面。
- `src/music/`：資料模型、MIDI、MusicXML、hymnal URL 驗證及讀取。
- `src/components/`：實體琴鍵與 Canvas / 五線譜顯示。
- `src/store.ts`：Zustand 持久化偏好。
- `src/App.tsx`：匯入、播放與練習互動介面。

## GitHub Pages

1. 將完整專案推送至 GitHub repository 的 `main`。
2. Repository → Settings → Pages → Source 選擇 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 會安裝、測試、建置並部署 `dist/`。
4. Vite 使用相對 `base: './'`，可支援 repository 子路徑；網站不使用需要 fallback 的前端路由。

本交付包含部署工作流程，沒有建立遠端 repository 或實際發布。

## 音源與授權

Salamander Grand Piano v3 — **Alexander Holm**，**CC BY 3.0**。

- 原始專案：https://github.com/sfzinstruments/SalamanderGrandPiano
- 授權：https://creativecommons.org/licenses/by/3.0/
- 網頁使用 Tone.js 提供的 MP3 版本：https://tonejs.github.io/audio/salamander/

本網站採小三度間隔的 28 個樣本，其他音高由取樣器插值；沒有完整還原原 SFZ 的 16 層力度、共振與踏板噪音。首次互動才下載取樣，後續依瀏覽器 HTTP cache；第三方離線時提供失敗重試。非離線 PWA。音源作者不為本網站背書。介面沒有使用外部圖片。Google Fonts 的 Manrope 與 Noto Sans TC 為 SIL OFL 字型，無網路時使用系統字型。

## 驗證與限制

詳見 [TESTING.md](../TESTING.md)。

- MIDI 不含可靠的完整樂譜拼寫與分聲部，因此以 Piano Roll 顯示；不推測調號或左右手。
- MusicXML 不支援壓縮 .mxl、反覆展開、裝飾音等完整演奏語意；遇反覆與已辨識的裝飾內容時拒絕播放並引導使用 MIDI。XML 踏板記號與表情術語未轉換成演奏，請用 MIDI CC64。樂譜游標按原始時間點定位，不以圖片辨識推測音符。
- 音源僅 Grand Piano 一種；不假稱多層力度或 Soft Piano。
- 取樣器自然 release 可能在暫停後短暫衰減。極大量 MIDI 尚無虛擬索引 / worker，讀取上限 20MB。
- 手機實機的多點觸控、iOS Safari 及 Android Chrome 音訊延遲仍需要實機驗收；不可將桌面模擬視為實機通過。

## 一鍵和弦與綁定

鋼琴下方的「一鍵和弦」可將一個實體按鍵展開成低音與完整和弦。預設 Z=A、X=D、C=E、V=E7、B=F#m、N=B、M=B7；另有 C 調常用配置。這些是人工設計的常用和弦配置，沒有從 hymnal.net 推測進行或時間。

- 預設按住發聲、放開釋放；勾選「一按保持」，即可按一下保持、換和弦自動放開、再按同鍵停止。
- 「綁定模式」可選和弦種類、改綁英文字母／數字鍵、解除、新增；配置自動儲存。修改期間暫停和弦演奏。
- 檢查與其他和弦、單音及踏板的按鍵衝突。啟用和弦時，和弦鍵優先；其他單音鍵照常可用。
- 觸控和滑鼠亦可使用和弦卡片。失焦、關閉模式、停止或修改配置會釋放和弦。
- 「停止和弦」釋放實體按住的和弦；若延音踏板仍啟用，聲音仍會依踏板狀態延續，放開踏板可結束延音。

## 完整鍵盤、聲音風格與自己的演奏

88 鍵現在都有唯一預設快捷鍵。中央 C4–E5 保留原本 A/W/S 等排列；其餘使用字母、數字、符號與 Shift 組合，琴鍵標示 ⇧ 代表 Shift。舊設定會保留已指定音符並補齊缺少的音域。Shift 供音域使用，踏板可選 Space 或右 Control。

「全鍵盤演奏」使用每個單音綁定；「一鍵和弦伴奏」讓和弦鍵優先，關閉便恢復單音。同一實體鍵可在兩種模式擔任不同角色。音符輸入期間仍保留文字欄位保護，Shift 音符依實體 keyup 釋放。

聲音風格：原聲、柔和、剛強、輕快。它們使用相同的合法真實鋼琴取樣，實際改變低通濾波、起音、release 尾音、力度曲線與殘響，並不宣稱是不同品牌／型號的鋼琴。可在相同和弦上試聽比較；切換適用手動、和弦與 MIDI，已發聲音符的尾音仍依起音當時的包絡結束。

「我的演奏」可錄製手動單音、和弦、延音的真實事件，結束後載入播放器回放或匯出標準 MIDI。不錄製歌曲自動播放或音色試聽，不錄音訊，也不將音源及效果嵌入 MIDI。每次新錄製取代上一段，重新整理會清除未匯出的演奏。

差異化是讓使用者決定按鍵與換和弦時機、選聲音表情、等待式練習並保存自己的版本。僅按自動播放時，本質仍是 MIDI 播放器；不將其宣稱為自動編曲或能從網址可靠推算和弦時間。

## 使用者指定的開站預設曲

預設曲已改為使用者提供的 `e0637_i.mid`。原始檔保存在 `public/music/e0637_i.mid`，建置前以 `scripts/prepare-default-song.mjs` 解析，生成 `src/music/default-song.json` 作為開站與「載入預設曲」的資料。內容為 241 個音符、1 音軌、約 110 BPM、3/4 拍、38.77 秒。原始二進位不修改，顯示曲名採檔名，避免使用不希望出現的內部曲名。原始檔由使用者提供，不宣稱為本專案原創；小星星保留為另一個測試選項。

## 黑金琴蓋入口

介面回到黑色與金色主題。琴蓋位於鋼琴工作區最上方，預設關閉；點擊琴蓋可展開「匯入歌曲、聲音與演奏、我的錄製、功能選單」四類工具。MIDI / MusicXML 上傳、網址匯入、音色及錄製都收進琴蓋，鍵盤、音符預覽、和弦與播放控制留在主畫面。右上「琴蓋選單」可直接打開功能分類。

開關琴蓋不停止播放、不清除歌曲，也不卸載錄製工具。Tab 切換支援左右方向鍵，琴蓋支援 Enter / Space 開合。關閉時工具不再接受焦點；開合採可中斷的臨界阻尼彈簧，支援 reduced-motion。
