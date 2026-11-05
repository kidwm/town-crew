# PWA 圖示：積木路環

2026-11-05 選定 **E 第七版**，用於正式 PWA 與 Safari 主畫面；favicon 使用獨立小車版。
以 B 的積木小鎮結合 C 的城市路環；灰藍小車置於前景，後方小屋採鼠尾草綠屋頂。
四個主體放大 10%，右側吊車建築往上、往右移，兩棟主建築保留間隔。
完整 logo 與 favicon 的小車皆在右側車頭底下露出部分遠側前輪。

## 原稿與匯出

- 可編輯原稿：[public/icons/town-crew.svg](../public/icons/town-crew.svg)。保留向量形狀，沒有嵌入點陣圖、字型或外部資源。
- 一般安裝圖示：`icon-192.png`、`icon-512.png`。
- 可裁切圖示：`icon-maskable-512.png`，完整不透明背景，圖案位於中央直徑 80% 的安全圓內。
- Safari 主畫面：`apple-touch-icon.png`（180 px）。
- 網頁 favicon：獨立的 [favicon.svg](../public/icons/favicon.svg)，以及 `favicon-16.png`、`favicon-32.png`。

PWA 圖示沿用既有資產路徑；favicon 的 HTML 引用指向獨立小車原稿與 16／32 px PNG。
所有圖示由正式建置的 Workbox 預快取修訂雜湊更新。
Manifest、註冊控制器與遊戲生命週期沒有變更。

## 來源

原始素材透過 Images API 的 `gpt-image-2.6-sunburst` 產生，輸出格式為原生 SVG，
`svg.model` 指定 `gpt-6.1-sol`。E 後續版本直接編輯向量群組，保留建築細節與道路幾何。

| 素材 | API request ID |
| --- | --- |
| B 積木小鎮 | `req_fd546bd8294f4c9899b9251e5571989e` |
| C 城市路環 | `req_1bbbd48a5c0b407db4faa826b7252319` |
| 前景積木小車 | `req_598b68a3c3cd45d68d2dffeba7101079` |

E 第七版選稿 SVG 的 SHA-256：`90d769bd92fdb23f83feeecc20774732808823a1cfe9509f3682471ee77524d1`。
補上遠側前輪後，正式 PWA SVG 的 SHA-256：`ac6ee8985ba8e7c0aab50475e67c75b7040103bf1bfd89c4fa70ad0fd2254006`。

## 驗證

本次 PNG 由本機既有 `sharp` 0.35.4 直接從 SVG 匯出，沒有另啟瀏覽器。
已確認六份 PNG 的格式與尺寸、四份 PWA／Safari PNG 的不透明背景，並逐像素檢查 maskable 安全圓。

只包含本次圖示與文件變更的隔離版本已通過 `npm run build`（TypeScript、Vite 與 PWA 產物生成）。
確認八份正式圖示與原始檔一致，Workbox 的預快取修訂雜湊皆對應新版資產。
Codex 內建瀏覽器已確認正式首頁十關選單可開啟、manifest／favicon／Apple 圖示連結正確，
並檢視正式 PNG、大圖、圓形裁切、Safari 圖示與 32 px favicon。

本次沒有修改 Effect 契約或關卡玩法，未重跑遊戲完整流程、PWA 離線／更新生命週期、
Playwright 套件或實體裝置安裝。建置保留既有共用 Three.js chunk 大於 500 kB 的提醒。

## 2026-11-05：獨立小車 favicon

瀏覽器分頁改用 E 中的灰藍積木小車，放大置中於奶油色圓角底上，移除道路與建築，
讓 16／32 px 下仍可辨識車頂、深色車窗與車輪。
原生 SVG 直接沿用 `town-crew.svg#toy-car` 的向量群組與配色，沒有重新呼叫圖像 API。
另在車身後方補上遠側前輪，只在畫面右側車頭底下露出胎面下緣；原有車身與兩個近側輪胎不變。
同一個小車向量群組同步放回完整 E 原稿，並重新匯出 PWA 與 Safari 主畫面 PNG。
建築、路環、標線、主體比例與位置均保留。
`npm run icons` 已分別讀取城鎮與小車兩份原稿，避免重新匯出時覆蓋 favicon 設計。

此版通過隔離版本的 `npm run build` 與產生腳本語法檢查；三份 favicon 的 HTML 引用、
正式產物與 Workbox 修訂雜湊一致。內建瀏覽器已檢視 16／32／48 px，
以及淺色、深色分頁背景下的實際 16 px 對比；完整 PWA 圖示另確認與 favicon
使用相同小車群組、建築與路環未變，並檢視圓形裁切。未重跑遊戲流程或實體裝置安裝。
