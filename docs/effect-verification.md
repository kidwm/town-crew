# Effect 驗證指南

核對日期：2026-10-24；程式基準 `8a74bce`，手動入口另含本次清潔隊補齊變更。本文件維護驗證方法、測試入口與覆蓋範圍，**不是本次執行結果**。
現行契約與九關差異見 [架構與維護指南](effect-usage.md)。Effect 整合與契約相關的執行結果、版本、數據及限制追加到 [採用歷史](history/effect-adoption.md)；一般玩法、動畫與視覺的驗證摘要放在對應關卡設計文件或專項紀錄。
維護既有關卡及新增關卡都依本指南選擇檢查，不因沿用共用 helper 就省略整合驗證。

## 按變更選擇驗證

| 變更範圍 | 必要檢查 | 瀏覽器補充 |
| --- | --- | --- |
| 純文件／連結 | 核對來源、相對連結與章節錨點；搬移歷史時比對完整內容。 | 不需要因此重跑遊戲。 |
| domain／幾何／狀態欄位 | 相關 domain 測試、`npm test`；有快照變動時補目前格式／舊格式／矛盾狀態恢復。 | 受影響配置、手勢、取消與部分工作重載；場景變更檢查桌面與直向手機固定視角。 |
| 固定取景／相機範圍／進出場 | 沿用幾何變更檢查，核對全階段與配置的投影範圍、整車／工具極限、手動起終點及自動離場距離；只做文件評估則依純文件列。 | 按[取景驗收](mission-design.md#取景驗收)比較同畫布尺寸前後主體大小，逐邊說明保留／裁減；實際操作、取消、部分工作重載與交接，不能只拍停車畫面。 |
| E01／E02 資源／初始化 | scene、connection 的部分初始化與獨立清理；分類錯誤、純取消與混合 cleanup defect。 | 啟動失敗、離場、單一 canvas、音效 close 失敗後仍清理。 |
| E03／E04 frame／音效 | 首次及後續排程、frame／HUD 拋錯；同步／非同步 unlock 失敗、pending 合併與取消。 | 手勢內解鎖、重試、故障離場；消防另驗水聲部分初始化回滾。 |
| E05／E06 存檔 | storage／snapshot、任務 persistence；正式／開發部分進度、memory 優先、刪除遮蔽、同步 pagehide。 | 當前格式續玩、舊／缺欄位／矛盾格式開新局、storage 拒絕、重新選關與重載。 |
| E07／E08 組裝／診斷 | service 隔離、audio Layer 生命週期、四階段故障、平行載入、summary／logger／clock 失敗。 | success／failure／cancelled 摘要、快速導航、reload／HMR、正式 lazy 載入。 |
| E09 autosave | TestClock 首次等待、正常週期、hidden、取消、save／frame 互相監督；正式／開發 session。 | 凍結 rAF 仍存檔、hidden 不定期寫、pagehide 同步、離場停止、故障清理。 |
| 全站導航／PWA | navigation／PWA 測試；連續取消仍等待最早清理、有界重試、load／backoff／結果觀察取消。 | 快速切關及延遲 close、PWA 故障頁；改快取策略時另驗正式離線／更新。 |
| 新關卡 | 上述適用邊界、任務登記、fixture、共用 adapters 與 runner；核對 [新增清單](effect-usage.md#設計與新增關卡)。 | 新關實際互動、reload／HMR、離場與正式入口；缺少手動測試入口時先補入口才使用該套案例。 |

跨模組、runtime、服務組裝或瀏覽器行為變更執行 `npm run check`（完整 Node 測試、TypeScript 與正式建置）。
共用 helper 變動須涵蓋全部呼叫端；單關修改則驗受影響關卡與共用契約，不機械式重跑無關完整通關。

## 共用測試與任務登記

| 測試入口 | 覆蓋責任 |
| --- | --- |
| [共用 lifecycle](../src/missions/lifecycle.test.ts)／[修路 lifecycle](../src/missions/road-repair/lifecycle.test.ts) | 部分 scene／connection 初始化、清理順序與失敗、frame／HUD 故障及可選音效。 |
| [共用 persistence](../src/missions/persistence.test.ts)／[修路 persistence](../src/missions/road-repair/persistence.test.ts) | 目前 Schema、不變量、部分進度、正式／開發保存、上一回合與同步離頁。 |
| [共用 services](../src/missions/services.test.ts)／[修路 services](../src/missions/road-repair/services.test.ts) | 替換 persistence／audio、scope 所有權、啟動故障與重訪；共用檔也含其他八關的正式／開發 autosave。 |
| [修路 autosave](../src/missions/road-repair/autosave.test.ts) | 修路正式／開發 session 的獨立排程、hidden、取消及 worker／frame 失敗。 |
| [快照 fixtures](../tests/helpers/snapshots.ts) | 修路以外八關的有效部分進度及測試輸入；包含清潔隊。 |
| [runtime 測試](../src/runtime/) | mission-lifecycle、frame-loop、audio-unlock、storage、snapshot、mission-startup、autosave 的共用契約與故障隔離。 |
| [app 測試](../src/app/) | progress／development 記憶體與 storage、navigation 取消屏障、PWA 重試與取消。 |
| 各關 `domain/*.test.ts` | 遊戲規則、配置、幾何、取消及 resume 不變量；不依賴瀏覽器 runtime。 |

**九關皆已列入共用 Node 整合測試或修路專用測試；runtime／storage／startup／autosave 四個手動故障頁也皆可選九關。**
清潔隊沿用共用 fixture：版本 2 的部分升桶進度、明確版本 1 舊檔及矛盾完成狀態；正式／開發 key 與其他關卡隔離。
完整遊玩另有 [正式互動測試](../tests/e2e/sanitation.spec.mjs) 及 [開發測試](../tests/e2e/development.spec.mjs)。
入口登記與實際執行分開記錄；清潔隊本次四頁的模式、故障與結果見[驗證歷史](history/effect-adoption.md#2026-10-24-清潔隊手動故障頁補齊)。
警察臨檢改版沿用上述入口：fixture 為 version 3 的部分重機行程與已選角色，另含明確 version 2 五步舊檔（domain 另拒絕 version 1）及缺少選中重機的矛盾完成狀態。共用 adapters 遍歷左右配置、兩台重機、兩種一般車順序、三個查驗索引、所有階段、兩種自動進場及警員走向車旁／陪同／上車的中途快照；[警察 CI 案例](../tests/e2e/police.spec.mjs) 與 development spec 同步改為六步臨檢／拖吊流程。實際執行見[歷史](history/effect-adoption.md)。
PWA 故障頁測試全站註冊控制器，不按關卡分列。歷史八關瀏覽器結果的範圍保持原樣，不視為每次已重跑九關。

警察二選一提示另有純提示時鐘與六尺寸底圈／箭頭投影測試；police／development CI 維護輪播、直接抓另一台、點按取消、部分續玩、減少動態及提示清理案例。一般提示的實際驗證範圍與限制見[關卡設計紀錄](police-checkpoint-proposal.md#2026-10-28-提示實作與驗證)，不追加 Effect 採用歷史。

新增任務時，同步登記共用 lifecycle／persistence／services adapters、有效部分進度 fixture、任務差異表及適用瀏覽器入口。
檢查 [package.json](../package.json) 的 `test`：目前收錄 app、runtime、各關 domain、共用 missions 測試及修路根目錄測試；
**新關根目錄的 `*.test.ts` 不會自動收錄**，若新增此類檔案須調整 runner 或納入現有共用測試。
登記新 Playwright 檔案時也要核對 [正式設定](../playwright.config.ts) 的 `testMatch`；[開發設定](../playwright.dev.config.ts) 只跑 development spec。

## Node 與建置操作

使用 repository 要求的 Node 版本與 lockfile。先跑受影響測試，再依變更範圍執行完整檢查：

```sh
node --test src/missions/lifecycle.test.ts src/missions/persistence.test.ts src/missions/services.test.ts
node --test src/runtime/autosave.test.ts src/missions/road-repair/autosave.test.ts src/app/navigation.test.ts src/app/pwa.test.ts
npm test
npm run check
```

前兩行是可選的定位範例，不必在完整檢查通過後重複執行。`npm run check` 已包含 `npm test`，以該次實際 runner 輸出記錄總數。
TestClock 適合精準檢查 `interval - 1` 尚未寫入、再前進 1 ms 首次寫入，及取消後零寫入；不以真實 timer 的精準毫秒斷言代替。
時間測試不控制 rAF、performance.now、Web Audio 或真實 storage；這些仍需對應的整合與瀏覽器檢查。

## Codex 內建瀏覽器操作

互動與手動故障驗證使用 Codex 內建瀏覽器。先確認現有服務的來源／port，能沿用就不重啟；新增服務可用：

```sh
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

以下相對路徑在該 Vite 服務開啟，例如 `http://127.0.0.1:5174/tests/manual/effect-runtime.html`。
這些頁面只在開發服務使用，正式遊戲不載入測試替身。
runtime 故障頁使用實際 storage keys，應使用可丟棄的本機測試資料；storage／startup／autosave 頁以各次 run key 隔離進度。
保留來源、mode、關卡、配置、注入故障與觀察結果，勿只記「頁面成功開啟」。
依 [AGENTS.md](../AGENTS.md)，本機瀏覽器測試直接使用 Codex 內建瀏覽器，不必再詢問；不另外啟動或下載 Chrome／Playwright 瀏覽器。既有 Playwright 測試持續維護供 CI，使用者明確要求該套件時才在本機執行。

`dev=0` 表示正式遊玩／存檔模式，**不表示正式 build**。Vite 開發建置仍可能輸出 storage 與 startup 診斷；
音效解鎖警告另受關卡開發工具模式控制。Effect 的 `Mission failed` 可能在一般 console log，檢查全部等級與未處理拒絕，不只看 console.error。

### 資源、frame 與音效

入口：[effect-runtime.html](../tests/manual/effect-runtime.html)。每個案例重新載入後選關，按頁面說明設定故障再操作。

1. 正常進入、實際手勢、回選單；確認一個 canvas、離場後零 canvas，音效 context 關閉且沒有殘留工作。
2. 注入下一幀排程失敗；確認任務停止、清理完成、出現可回選單的錯誤畫面，沒有未處理拒絕。
3. 在首次手勢前設定同步或非同步 unlock 失敗；遊戲仍可操作，後續手勢可重試，pending 不重複建立 context。
4. 同時注入 audio close 與 diagnostic logger 失敗；確認其餘清理仍完成。
5. 消防另測水聲節點部分初始化失敗：首次回滾已建 filter，第二次手勢沿用同一 context 建立 source；離場釋放重建節點及 context。

頁面提供 contexts、source／filter、close、warning、未處理錯誤等計數；以同次案例的增量判斷，勿混用前一輪累積值。
音效 API 成功與節點回收不等於實際可聽輸出已驗證。

### 存檔與恢復

入口：[effect-storage.html](../tests/manual/effect-storage.html)。選任務、正式／開發模式、fixture 與故障後套用，兩種 mode 分別驗證。

- 有效部分快照保留進度／貨物／配置，解除舊手指與未提交停留；legacy、破損 JSON、Schema 或 domain 矛盾輸入安全開新局。
- storage getter、get、set、remove 與唯讀故障各有案例；確認 optional fallback、typed 診斷、記憶體新值優先及刪除遮蔽。
- 操作後觸發 pagehide，立即讀取寫入計數／快照，確認不靠 timer 或 Promise 才完成；再檢查正常 reload 與從選單重開的差別。
- remove／readonly 案例需實際回選單再選同關，確認有刪除嘗試且開新局；只有載入與 pagehide 不會觸發刪除。唯讀時磁碟可仍是舊進度，畫面須使用新局記憶體。
- set 失敗可測同頁導航恢復記憶體，不能把整頁重載後仍續玩列為保證。重訪記憶體時以 hash 切到別關再切回，與「經選單開新局」分開；Schema 增加必要欄位時同步調整 fixture，不能用預設值掩蓋舊格式。

### 組裝、追蹤與導航

入口：[effect-startup.html](../tests/manual/effect-startup.html)。正常、scene／connect／storage 故障及正式／開發模式分別套用。

- 對照 [任務差異表](effect-usage.md#各任務差異) 檢查六／七階段、mission、startupId、mode 與 outcome；平行階段不加總成總時間。
- 啟動故障保留型別／cause，清理後回報；storage 可選失敗不變成啟動失敗。啟動成功後的 frame 故障標為 runtime-or-cleanup。
- 快速 A → B → C、回選單及延遲 audio close，最新畫面須等先前清理；取消的舊 import／audio Promise 不可晚到掛載或產生未處理拒絕。
- 有 HMR 相關變動時，對自己的可還原 source 修改觸發 HMR，確認同局、單一 canvas、舊 worker 停止；不覆寫其他人的改動。

### 自動存檔

入口：[effect-autosave.html](../tests/manual/effect-autosave.html)。選任務與 mode 後套用；使用頁面提供的凍結 rAF、hidden、quota、切關、pagehide、clone／frame 故障控制。

- 凍結 rAF 後觀察約 2.6 秒，frames 不增但定期存檔仍增；實際寫入次數受週期起點與瀏覽器節流影響，不斷言固定次數。
- hidden 後定期寫入停止；隱藏事件本身的一次同步保存要與定期存檔分開計算。pagehide 也須立即保存。
- storage quota 失敗仍可遊玩；clone 或 frame 未處理失敗結束任務，兩項工作都停、canvas 清空且只回報一次任務失敗。
- 快速切換其他關卡再返回，先以遊戲手勢建立 AudioContext，頁面會額外等待 close 600 ms 以放大競態。等待第二次本關 success 摘要再操作；close 計數增加時可能仍在等待，不能只憑舊 canvas／按鈕仍存在判定已重入。確認最大畫布為一、舊 worker 沒有續寫。
- 回選單後再取一段時間樣本，writes／attempts／frames 不再增加，沒有 pending frame 或重複 worker。

### PWA 註冊

入口：[effect-pwa.html](../tests/manual/effect-pwa.html)。使用 recover／exhaust／security／late 案例，以及已載入／等待 load 狀態。
頁面替換 register，執行真實註冊控制器；**不會註冊測試 service worker**。

- waiting-load 狀態未送 load 時零次嘗試；可恢復網路錯誤按 1／2 秒間隔、最多三次，非網路錯誤不重試。
- pagehide 在 load 等待或 backoff 時取消後，不再註冊／重試；未完成 register 晚到拒絕不產生未處理拒絕或過期警告。
- 最終失敗只警告一次且不阻擋遊戲；必要時使用頁面約 3.6 秒的觀察窗口，實際 timer 可較晚。
- 此頁不驗 Workbox 快取、安裝、離線或更新；相關變更另跑 [PWA 瀏覽器套件](../tests/e2e/pwa.spec.mjs) 與正式來源驗證。

## 正式建置與實際遊玩

先建置再開 preview；以 Codex 內建瀏覽器確認選關、受影響互動、部分工作 reload、離場及快速切關。
舊 service worker 可能仍供應前版入口；核對載入的 script hash 與本次 `dist/index.html`，記錄是開發服務還是新版正式輸出。
只在本機測試來源處理快取，不把開發 `dev=0` 的結果當成正式 bundle 驗證。

既有自動化仍供 CI 與重現使用，依改動選取案例；不要因改用內建瀏覽器而移除：

```sh
npm run build
npm run test:e2e -- sanitation.spec.mjs --project=desktop-mouse
npm run test:e2e
npm run test:e2e:dev
```

正式設定預設自行啟動 port 4173 preview，開發設定啟動 port 5174；避免與已使用的服務衝突，不能任意終止其他工作。
實際 iPad／Android 觸控、可聽音訊、冷啟動與長時間效能須另外記錄，滑鼠／觸控模擬不代替硬體驗證。

## 核對現況與記錄結果

每次變更先核對 [維護清單](effect-usage.md#維護與新增關卡清單)。來源盤點時：

1. 依 [AGENTS.md](../AGENTS.md) 判斷是否先用 CodeGraph；沒有 `.codegraph/` 就以 `rg` 查詢，不自行建立索引。
2. 由 MissionId、main 的 lazy 分支及任務資料夾確認關卡集合，再逐關比對 scene、session、persistence、services、startup。
3. 核對 Schema literal、正式／開發 key、上一回合 key、withAutosave 間隔與回傳 loop、audio Layer release、四階段組裝及 module 載入數。
4. 對照共用 adapters／fixtures、runner 與手動頁選單；區分「程式已接入」「Node 已覆蓋」「瀏覽器實際執行」三種證據。

依變更範圍選擇紀錄位置：Effect 整合、E01～E09 契約、所有權／取消／錯誤／存檔／排程策略的變更或專項驗證，追加到 Effect 採用歷史；一般玩法、動畫、模型、提示與文案若沿用既有邊界，記在關卡設計文件或專項紀錄。純設計討論與一般文件維護不另追加 Effect 歷史。實際驗證摘要至少包含以下資訊：

```text
日期／變更主題：
程式基準 commit 與尚未提交的變更範圍：
關卡、配置、模式、建置與瀏覽器／裝置：
執行指令／故障案例及實際結果：
修正或發現的差異：
未執行項目、已知限制與後續補驗入口：
```

測試總數、bundle／precache 大小及歷次成功紀錄放在上述適用的執行紀錄段落，不回填到現行規則、README 或架構摘要。既有 Effect 歷史完整保留；後續一般關卡工作不再追加到該檔。
搬移既有紀錄時只調整相對連結；保留原日期、數字與範圍，不把原八關成果改寫成九關，也不以過去成功代替本次未執行的驗證。
