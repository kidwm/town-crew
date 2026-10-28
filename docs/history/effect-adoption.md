# Effect 採用與驗證歷史

本檔保存原分階段計畫及全部十二段實作／驗證紀錄，封存來源為 `8a74bce:docs/effect-usage.md`（2026-10-24）。
搬移只調整相對連結；原日期、任務範圍、測試數、bundle 數據、修正與未驗證限制完整保留。
當時的「目前」「本批」「其餘七關」只描述該次工作，不代表最新狀態；原八關結果不能推定為第九關已驗證。

現行規則見 [Effect 架構與維護指南](../effect-usage.md)，重跑方法與覆蓋範圍見 [驗證指南](../effect-verification.md)。
舊紀錄缺少個別驗證 commit 時，不以封存來源冒充當時執行版本；後續紀錄應附來源版本與工作目錄差異。
歷史資料不隨新關卡增加而改寫；需要更正時追加註記，新的結果另開日期段落。

## 分階段實作與驗收

| 階段 | 範圍／狀態 | 完成條件 |
| --- | --- | --- |
| 1 | E01、E02，八個任務已完成 | renderer 掛載後、connect 中途、最後存檔、audio close 失敗仍執行後續清理；錯誤分類；取消、切換與 HMR 不重複掛載。 |
| 2 | E03、E04，八個任務已完成 | rAF 拋錯能結束並清理任務；正常取消不顯示錯誤；音效同步拋錯／非同步拒絕仍可遊玩；解鎖在手勢內發生。 |
| 3 | E05、E06，八個任務已完成 | storage getter／get／set／remove 失敗、損壞 JSON、拒絕舊格式及矛盾狀態皆有測試；目前版本續玩、記憶體 fallback、刪除遮蔽與 pagehide 同步保存。 |
| 4 | E07、E08，八個任務已完成 | 可替換存檔／audio，正確 scope 與同步保存；啟動 spans 保留並行與正常取消語意，清理後關聯錯誤紀錄；比較 bundle 並保留懶載入。 |
| 5 | E09，八任務及全站導航／PWA 已完成 | 停止 rAF 仍可保存；隱藏跳過定期寫入；互相監督與中斷清理；保留各關 700／800 ms 間隔；快速導航／HMR 等待舊資源；PWA 1／2 秒 backoff、三次上限與取消。 |

### 2026-10-22 修路試點驗證（第一批）

第一批 `npm run check` 通過：**276 個測試（263 個 domain + 13 個生命週期／資源測試）**、TypeScript 檢查與正式建置。
新增測試使用 Node runner 與 DOM／renderer 替身，沒有另啟瀏覽器：

- [mission-lifecycle.test.ts](../../src/runtime/mission-lifecycle.test.ts)：模組／場景／session 錯誤分類與原始 cause、延遲載入中斷、初始化中斷、音效關閉拒絕後繼續清理、混合 Cause 診斷、多項資源與材質清理。
- [lifecycle.test.ts](../../src/missions/road-repair/lifecycle.test.ts)：真實 createScene 在 canvas 掛載後／observer 設定中途失敗，真實 connect 在監聽建立中途失敗，最後存檔拋錯仍取消 rAF／移除提示／解除監聽，以及存檔順序與 pointer capture 釋放。

互動驗證使用 **Codex 內建瀏覽器**、Vite 開發模式；已確認：

- 真實拖曳壓路機完成回程，整平趟數由 `1 / 2` 到 `2 / 2`，進度達 100%。
- 重載與 main.ts HMR 後，完成狀態及調整後的 `90 px` 參數保留。
- 修路 → 選關 → 蓋房子，以及連續上一頁／下一頁／上一頁切換正常。
- 選單 canvas 數為 0，任務與 HMR 後為 1；回選關再選修路從新回合開始，未出現 console error。

### 2026-10-22 E01、E02 推廣至其餘七個任務（第二批）

`npm run check` 通過：**307 個測試（263 個 domain + 44 個生命週期／資源測試）**、TypeScript 檢查與正式建置。
新增 [全任務 lifecycle.test.ts](../../src/missions/lifecycle.test.ts)，並將 DOM／renderer 替身集中在
[tests/helpers/lifecycle.ts](../../tests/helpers/lifecycle.ts)，由 Node runner 執行：

- 七個任務各驗證四條路徑：canvas 掛載後失敗且 renderer dispose 拋錯；observer 設定失敗且 geometry dispose 拋錯；connect 在監聽註冊中途失敗；取消時最後存檔與音效關閉同時失敗。
- 逐任務確認原始原因與任務 ID、事件取消、提示移除、rAF 取消、observer 斷開、canvas 移除，以及 session → audio → scene 的清理順序。
- 共用場景圖驗證 Mesh／Line／Points 資源去重與逐項釋放；救火另驗證停止水聲失敗仍清理，以及 noise.stop 與 AudioContext.close 同時失敗時保留兩個原因。
- 修路原有測試保留並改用共用測試替身；原有中斷／延遲載入／錯誤分類回歸通過。

Codex 內建瀏覽器在 Vite 開發模式逐關驗證，未啟動外部瀏覽器。每列皆完成進入任務、變更階段、重載、main.ts HMR、返回選單：

| 任務 | 重載／HMR 驗證階段與操作 | 結果 |
| --- | --- | --- |
| 蓋房子 | 水泥車 · 澆灌地基 | 階段保留 |
| 救火 | 消防車 · 幫忙滅火；真實按壓熄滅一個火點 | HMR 保留 `1 / 4` 火點進度 |
| 交通救援 | 拖吊車 · 接上掛鉤 | 階段保留 |
| 警察 | 重機 · 分路包抄 | 階段保留 |
| 碼頭 | 吊車 · 卸貨到岸上 | 階段保留，貨箱線框正常 |
| 山路 | 挖土機 · 搬走大石頭 | 階段保留 |
| 轉運站 | 公車 · 打開車門；真實拖曳開門、乘客下車 | HMR 保留後續「公車 · 離站」進度 |

每個任務重載／HMR 後 canvas 數為 1，返回選單為 0，console error 為空。
另確認修路重新進入正常，以及連續上一頁／下一頁／上一頁後仍只有一個任務 canvas，最後返回選單沒有殘留。
本次瀏覽器涵蓋生命週期與代表互動，沒有逐關完整通關或驗證所有配置。

### 2026-10-22 E03、E04 修路試點（第三批）

`npm run check` 通過：**321 個測試（263 個 domain + 58 個生命週期／資源測試）**、TypeScript 檢查與正式建置。
本批新增 14 個測試，既有修路清理測試配合 connect 回傳 runner 的契約更新：

- [frame-loop.test.ts](../../src/runtime/frame-loop.test.ts)：正常時間戳與單幀排程、取消與過期回呼、回呼拋錯、首次／後續排程失敗、取消 rAF 本身拋錯仍關閉外層 scope。
- [audio-unlock.test.ts](../../src/runtime/audio-unlock.test.ts)：同步啟動、pending 合併與後續重試、同步拋錯／非同步拒絕、開發診斷一次、正式模式安靜降級、診斷自身失敗，以及 unlock 內／等待中取消後的晚到拒絕。
- [修路 lifecycle.test.ts](../../src/missions/road-repair/lifecycle.test.ts)：真實 scene/session 的 renderer 與 HUD 更新失敗會回報原始原因並釋放事件、提示、音效、observer 和 renderer；真實音效按鈕遇到同步／非同步失敗仍保留 loop，離開後解除監聽。

互動驗證使用 **Codex 內建瀏覽器**與 Vite；新增獨立的
[手動故障測試頁](../../tests/manual/effect-runtime.html)，載入真實 `main.ts`，正式入口與建置不包含這些測試控制：

1. 執行 `npm run dev`，在內建瀏覽器開啟該伺服器的 `/tests/manual/effect-runtime.html`。測試頁預設修路並自動啟用開發模式；若已有開發快照，可用直達階段切到「壓路機 · 回程」。
2. 音效測試前重載，先按「下一次音效同步失敗」或「下一次音效非同步失敗」，再按遊戲音效鍵或拖曳車輛。測試頁會一次性替換 AudioContext constructor／resume，觸發後還原；每種情境重新載入後再測。
3. 「下一幀排程失敗」一次性令 rAF 排程拋錯；確認錯誤提示、canvas 移除，再返回選關並重新進入修路。

已驗證同步音效失敗與 Promise 拒絕各記錄一次 `AudioUnlockError` warning，兩種情境都能真實拖曳完成回程，整平趟數從 `1 / 2` 到 `2 / 2`、進度達 100%。
rAF 故障後記錄預期的 `Mission failed`，顯示執行失敗提示，canvas 數為 0；返回選關後可重新進入新回合，canvas 數為 1。
正常重載與 `main.ts` HMR 保留完成狀態與參數，canvas 仍為 1，沒有新增任務錯誤。
正常遊戲入口另確認 canvas 數為 1，console warning／error 為空；renderer／HUD 故障由上述 Node 整合測試覆蓋，瀏覽器故障注入針對排程與音效。
第三批僅完成修路試點；其餘七關的推廣與驗證記錄於下節。

### 2026-10-22 E03、E04 推廣至其餘七個任務（第四批）

全部八個 session 現在都回傳 frame-loop Effect，入口在 connect 初始化 wrapper 之外直接等待。
七個任務移除各自的 rAF 排程／取消 finalizer 與音效 unlock catch，改用同一組 runtime helper；
救火保留獨立的停止水聲 finalizer。逐幀計算、互動規則、快照格式與音符排程維持原行為。

`npm run check` 通過：**342 個測試（263 個 domain + 79 個生命週期／資源測試）**、TypeScript 檢查與正式建置。
[全任務 lifecycle.test.ts](../../src/missions/lifecycle.test.ts) 新增 21 個測試，七個任務各覆蓋：

- 真實 scene/session 的 renderer 拋錯，回報含正確任務 ID 與原始 cause 的 `FrameLoopError`；停止排程並清理音效、事件、提示、observer 與 renderer。
- 真實 HUD 更新拋錯，仍走同一清理與錯誤提示路徑；救火確認最後停止持續水聲。
- 真實音效按鈕的同步拋錯與非同步拒絕，後續 frame 仍正常渲染；正常取消不回報任務錯誤，取消後舊 frame 與事件皆不再執行。

既有七任務「最後存檔／音效 close 同時失敗」測試改為等待實際 runner，確認 frame 先停止且其餘 finalizer 照常執行。
共用 helper 的 pending 合併、晚到拒絕、診斷與排程失敗測試，以及修路試點測試全部保留。

[手動故障頁](../../tests/manual/effect-runtime.html) 已增加八關選單。切換測試任務會重載文件並重設故障控制；
各音效案例仍須先重載、設定故障，再按遊戲音效鍵或操作車輛。測試頁僅供 Vite 開發驗證，正式建置不包含它。
以下驗證全部使用 **Codex 內建瀏覽器**，每關皆完成音效同步失敗／Promise 拒絕、階段切換、重載、main.ts HMR、
rAF 排程失敗、返回選關與重新進入：

| 任務 | 重載／HMR 驗證階段 | 代表互動或觀察 |
| --- | --- | --- |
| 蓋房子 | 水泥車 · 澆灌地基 | 階段保留 |
| 救火 | 消防車 · 幫忙滅火 | 音效拒絕後真實按壓熄滅火點；重載／HMR 保留 `1 / 4` |
| 交通救援 | 拖吊車 · 接上掛鉤 | 階段保留 |
| 警察 | 重機 · 分路包抄 | 階段保留 |
| 碼頭 | 吊車 · 卸貨到岸上 | 階段保留 |
| 山路 | 挖土機 · 搬走大石頭 | 階段保留 |
| 轉運站 | 公車 · 離站 | 音效拒絕後拖開車門、乘客下車；重載／HMR 保留後續階段 |

七關故障後均顯示執行失敗提示，canvas 數為 0；返回選關仍為 0，重新進入與 HMR 後為 1。
整輪記錄符合注入次數：14 次音效 warning、7 次預期的 `Mission failed`、7 次 HMR 更新，沒有額外 warning／error。
另確認正常返回選關、修路重新進入與瀏覽器上一頁／下一頁切換沒有新增錯誤；正常轉運站入口的 canvas 為 1，console warning／error 為空。
瀏覽器覆蓋排程與音效故障；renderer／HUD 故障由 Node 整合測試覆蓋。本批沒有逐關完整通關或測試全部配置。

本次未執行 Playwright 瀏覽器套件或八任務完整通關／離線驗證。
既有 [development.spec.mjs](../../tests/e2e/development.spec.mjs) 與 [pwa.spec.mjs](../../tests/e2e/pwa.spec.mjs) 保留作 CI 回歸。
未來程式變更仍執行 `npm run check` 與受影響的回歸測試；互動驗證使用 Codex 內建瀏覽器。
音效手勢限制與真實觸控體驗仍以 iPad／手機測試為準。

### 2026-10-22 E05、E06 修路試點（第五批歷史紀錄）

此節記錄當時結果；舊版遷移政策與測試預期已由第六批取代，以下並非目前相容承諾。

`npm run check` 通過：**358 個測試（263 個 domain + 79 個生命週期／資源 + 16 個儲存／persistence 測試）**、TypeScript 檢查與正式建置。
新增測試皆由 Node runner 執行：

- [storage.test.ts](../../src/runtime/storage.test.ts)：getter／get／set／remove 拒絕、原始 cause、損壞 JSON、循環引用／BigInt／undefined 編碼失敗、正常同步存取、開發診斷去重與正式安靜降級。
- [progress.test.ts](../../src/app/progress.test.ts)：共用正式進度的記憶體複本、讀取損壞資料、儲存遭拒、刪除遮蔽、任務／徽章／靜音 key 隔離及偏好保留。
- [修路 persistence.test.ts](../../src/missions/road-repair/persistence.test.ts)：每個直達階段、有限值與型別、來源版本、矛盾貨物／車輛狀態、舊版遷移、開發 memory／HMR、正式與開發 key 分離、真實 connect 的兩種 pagehide 同步保存、上一回合記憶體優先。

新增獨立的 [儲存故障測試頁](../../tests/manual/effect-storage.html)，在 Vite 啟動後以 **Codex 內建瀏覽器**開啟
`/tests/manual/effect-storage.html`。頁面載入真實 main.ts；正式／開發模式、存檔案例與故障皆由可見控制選擇，
按「載入測試案例」建立新的隔離 run。所有遊戲 storage key 都映射至測試前綴，不覆寫一般遊戲的存檔／徽章／偏好。
「觸發 pagehide 並檢查存檔」在事件返回的同一個同步呼叫中讀回寫入次數與資料，無須注入瀏覽器腳本。

| 內建瀏覽器案例 | 實際結果 |
| --- | --- |
| 有效開發存檔 | 真實拖曳完成回程，`1 / 2` → `2 / 2`、100%；pagehide 同步寫入一次。重載與 main.ts HMR 保留進度及 `90 px` 參數。 |
| 有效正式存檔 | 完成回程、同步保存、重載接續，靜音保留；完成徽章出現在選單，再玩一次從新局開始且偏好保留。 |
| 損壞 JSON、錯誤數字型別、矛盾貨物 | 各有預期 SnapshotDecodeError 診斷，安全從挖土機新局開始，canvas 為 1，沒有任務錯誤畫面。 |
| 舊版搬運中 | 保留已送達 `[0]`、鏟斗載料 `1`，取消舊拖曳為 carrying；同步保存為 version 1，重載後仍保留載料。 |
| storage getter／讀取拒絕 | 正常開啟新局；getter 拒絕時切到壓路機回程後，main.ts HMR 仍保留記憶體中的階段。 |
| 寫入與刪除拒絕 | 返回選單後重新選關從 0 開始，即使持久存檔仍是舊壓路機回程；HMR 保留新局及靜音，不讀回舊局。 |

整輪只有注入故障對應的可選儲存 warning，沒有 console error 或額外 Mission failed；週期存檔沒有重複刷出相同診斷。
任務與 HMR 後 canvas 為 1，返回選單為 0。瀏覽器使用 Vite 開發建置，`dev=0` 驗證正式存檔路徑；正式建置靜默診斷由 Node 測試覆蓋。
本批沒有執行外部 Playwright 瀏覽器或其餘七關的完整通關；它們的既有 domain／生命週期回歸全部通過。

與第四批建置相比，precache 仍為 55 個項目，總量由 **1036.31 → 1086.46 KiB（+50.15 KiB）**。
修路 session lazy chunk 由 17.93 → 63.61 kB（gzip 6.75 → 21.74 kB），包含新的 Schema 驗證；入口仍以動態 import 載入它。
共用 Effect chunk 由 33.74 → 38.14 kB、入口 JS 由 34.01 → 35.19 kB，故不是零入口成本。
既有 Three.js／geometry 大型 chunk 警告仍存在；手動故障頁不包含在正式入口或建置中。

### 2026-10-22 E05、E06 八任務推廣與目前版本限定（第六批歷史紀錄）

`npm run check` 通過：**409 個測試（263 個 domain + 79 個生命週期／資源 + 67 個儲存／persistence）**、TypeScript 檢查與正式建置。
本批新增 51 個測試，原有舊版遷移測試改為拒絕舊格式，並保留目前版本部分進度的斷言，沒有停用測試。

- [七關 persistence 整合測試](../../src/missions/persistence.test.ts) 共 48 個：每關全部直達階段與配置、代表性部分工作、型別／數字／不變量、版本與逐一缺少根欄位、正式／開發舊檔開新局、pagehide 同步保存、儲存拒絕時的 memory fallback；六關另驗證上一回合寫入失敗後連續新局不受舊 storage 覆蓋。
- [snapshot.test.ts](../../src/runtime/snapshot.test.ts) 共 2 個：先檢查原始鍵、錯誤路徑、拒絕無效輸入、domain 拋錯與恢復後不合法資料的分類。
- [development.test.ts](../../src/app/development.test.ts) 共 1 個：複製快照、key 隔離、記憶體優先及 storage getter 拒絕。
- 第五批既有 16 個儲存／persistence 測試中的修路版本案例改成拒絕缺少 version、round、gate、hauler、control、cargo 等目前必要欄位；domain 測試同樣不再預期遷移。
- 既有 [traffic.spec.mjs](../../tests/e2e/traffic.spec.mjs) 改為舊檔開新局；[development.spec.mjs](../../tests/e2e/development.spec.mjs) 的拖吊動畫案例改用完整版本 3 fixture。兩檔語法檢查通過，該 fixture 亦直接通過 Schema／domain decoder；本批未執行外部瀏覽器套件。

[手動測試頁](../../tests/manual/effect-storage.html) 已擴為八任務，可選正式／開發存檔、有效部分進度、損壞 JSON、數字型別、矛盾狀態、舊版與 storage 故障。
它載入真實 main.ts，使用 [共用純 fixtures](../../tests/helpers/snapshots.ts)，所有 key 都映射到隔離 run；診斷面板記錄 warning 分類與 error 數。
救火、警察本來沒有歷史舊格式，舊版案例使用不支援的 version 0；其他有歷史格式的任務使用先前真實舊格式，修路使用缺少版本／配置的舊結構。

本批以 **Codex 內建瀏覽器** 操作可見測試控制與遊戲，驗證結果如下：

| 案例 | 覆蓋與結果 |
| --- | --- |
| 有效目前版本 | 七關各自正式／開發模式的 pagehide 都同步寫入一次；整頁重載後 #app 的進度資料完整一致、canvas 1、error 0。修路目前版本可正常載入。 |
| 部分工作 | 蓋房子澆灌 `[0.4,0,1]`；救火已滅一處；交通選車與拖吊車型；警察已完成 bike1；碼頭懸吊第 2 箱；山路已交付 0、挖斗載 2；轉運站公車門開 0.4。 |
| 舊版本／矛盾狀態／損壞 JSON／數字字串 | 八關各自正式路徑都開新局，分別有一次 schema／invariant／json／schema 診斷；canvas 1、error 0。開發舊檔路徑另由 Node 整合測試覆蓋。 |
| getter／get 拒絕 | 七關開發模式皆可開新局與同步嘗試保存；只有預期 StorageUnavailable、error 0。 |
| set 拒絕與 main.ts HMR | 七關先讀入部分進度，再用可見開發階段切到 complete；磁碟仍停在原部分進度。main.ts HMR 後仍為 complete，#app 資料一致、canvas 1、每個 key/op 診斷不重複、error 0。 |
| set／remove 拒絕與重選 | 七關正式模式由部分進度回選單再進入，磁碟仍是舊局但畫面為新局；靜音維持 true，選單 canvas 0、任務 canvas 1、error 0。轉運站再驗證 main.ts HMR 仍保留新局與靜音。 |
| 真實操作 | 轉運站從 0.4 開門進度用拖曳完成開門，進入自動下車，再保存與重載接續。 |

HMR 驗證期間的一次原始碼註解修改觸發測試頁整頁重載，因此該次警察結果不算 HMR 通過；停止原始碼修改後重新觸發 main.ts HMR 已通過。
記憶體只能保留同頁導航／main.ts HMR：storage 寫入拒絕時，整頁重載仍只能讀到先前磁碟資料。
本批沒有跑外部 Playwright、逐關完整通關、全部配置的瀏覽器流程或離線安裝；Node 覆蓋全部直達配置與既有規則。
Vite 的 dev=0 代表正式存檔路徑，正式建置安靜降級由 Node 測試覆蓋。

相較第五批，precache **55 → 56 項、1086.46 → 1087.65 KiB（+1.19 KiB）**；入口 JS **35.19 → 35.24 kB**，
共用 Effect chunk **38.14 → 38.20 kB**。新增 Schema 共用後分包重新分配，因此不以個別 session chunk 相加推論入口成本。
建置入口仍有 18 個動態 import；靜態依賴為共用 Effect 與兩個車輛圖案 chunk，任務模組保持懶載入。
既有 Three.js／geometry 大型 chunk 警告仍在；手動測試頁未進入正式建置。

### 2026-10-22 E07、E08 修路試點（第七批歷史紀錄）

`npm run check` 通過：**423 個測試**、TypeScript 檢查與正式建置；原有 409 個測試維持通過，本批新增 14 個。

- [修路 services.test.ts](../../src/missions/road-repair/services.test.ts) 共 10 個：可注入完全隔離的存檔／偏好與開發記憶體、HMR 優先與完整目前格式、正式／開發真實 session 的同步 pagehide、Layer 資源存活到 connection 結束、prepare／scene／audio／connect 故障的原始 cause 與清理、重複進入取得獨立音效、等待非同步 audio close 且拒絕後仍清理 scene。
- [mission-startup.test.ts](../../src/runtime/mission-startup.test.ts) 共 4 個：真正並行的三個載入、NativeSpan 父子關係／attributes／結束時機、取消後晚到的 Promise 不啟動 scene、原始載入 cause 與 logger annotations、scope 清理後只記一次失敗、混合 cleanup defect 與壞掉的摘要／logger。

新增 [effect-startup.html](../../tests/manual/effect-startup.html)，在 Vite 開啟 `/tests/manual/effect-startup.html` 即可用可見控制選擇正式／開發存檔、正常啟動、場景／控制器故障與 storage getter 拒絕。
它載入真實 main.ts，將 storage key 映射到隔離 run；顯示最近三次啟動的階段結果與時間，另可觸發 pagehide、rAF 故障。
此頁不包含在正式建置，不在產品流程加入診斷控制。

本批全部瀏覽器操作使用 **Codex 內建瀏覽器**：

| 案例 | 實際結果 |
| --- | --- |
| 正常啟動 | 根摘要與七個階段皆 success，canvas 1；啟動摘要不隨遊玩持續增加。 |
| 真實拖曳與重載 | 開發／正式存檔路徑皆從壓路機回程完成 `1 / 2 → 2 / 2`、100%；pagehide 同步寫入一次，完成後重載的 #app 資料一致。開發調校參數 90 px 保留。 |
| main.ts HMR | 完成進度與單一 canvas 保留，startupId 遞增、每次多一份成功摘要，沒有 Mission failed 或未處理錯誤。 |
| 返回選關／重進入 | 選單 canvas 0、再進入 canvas 1 且為新局；靜音保留。正式完成徽章顯示，切到蓋房子也保留靜音且未增加修路啟動紀錄。 |
| 場景初始化失敗 | `scene` failure；一筆帶 SceneInitError／原始錯誤與 span 路徑的 Mission failed；canvas 0，可回選關重試成功。 |
| 控制器連接失敗 | audio 已取得、`connect` failure；一筆 SessionInitError，canvas 0，可回選關重試成功。沒有未處理拒絕。 |
| 啟動後 rAF 失敗 | 已成功的啟動摘要維持 success，不新增啟動；另記一次 FrameLoopError 並清理為 canvas 0，顯示既有執行期錯誤提示。 |
| storage getter 拒絕 | 啟動成功，僅預期去重 warning；改到 complete 後磁碟仍為回程一趟，HMR 保留記憶體的兩趟完成狀態與 canvas 1。 |
| 正式建置預覽 | 正式 dist 在本機 preview 啟動修路，canvas 1、無開發面板、無 Mission startup 摘要、無 console warning/error。 |

修路故障紀錄經 Effect 預設 logger 輸出 ERROR 等級（瀏覽器 console 方法是 log）；驗證依訊息與 Cause 判斷，不以 console.error 次數代替失敗數。
啟動取消與模組拒絕／晚到由 Node 測試覆蓋；本批沒有逐關完整通關、執行外部 Playwright 或驗證離線安裝。
保留原本 E05／E06 的限制：持久寫入被拒時，記憶體只能支援同頁導航與 main.ts HMR，無法保證整頁重載續玩。
第七批當時尚未推廣其他七關；後續推廣與驗證見第八批。全專案既有 409 個測試與蓋房子切換 smoke check 在當批維持通過。

與第六批相比，precache **56 → 55 項、1087.65 → 1104.93 KiB（+17.28 KiB）**。
入口 JS **35.24 → 36.23 kB**，共用 Effect chunk **38.20 → 58.26 kB**；新 progress chunk 2.98 kB，修路 startup lazy chunk 20.02 kB。
Layer 與 tracing 改變共用 chunk 分配，**不是零入口成本**；入口仍有 18 個動態 import，靜態依賴為 progress 與 Effect，修路場景／控制器／音效保留 lazy 路徑。
既有 Three.js／geometry 大型 chunk 警告仍存在。這批建立可替換邊界與可觀測性，不宣稱載入加速。

### 2026-10-22 E07、E08 推廣其餘七關（第八批歷史紀錄）

`npm run check` 通過：**479 個測試**、TypeScript 檢查與正式建置。新增 [services.test.ts](../../src/missions/services.test.ts) **56 個測試**（每關八個），原有 423 個保留。
測試涵蓋隔離的快照／偏好／開發記憶體、目前格式與舊版拒絕、刪除遮蔽、正式與開發真實 session 的同步 pagehide、儲存拒絕後續玩、prepare／scene／audio／connect 原始 cause 與回收、重進入的獨立音效，以及等待非同步關閉後才釋放場景。救火另外確認保存 → 停止水聲 → audio → scene 的順序。
既有 tracing 測試持續涵蓋並行載入、父子 spans、取消／晚到 Promise、清理後 annotations 與診斷 sink 失敗。

[effect-startup.html](../../tests/manual/effect-startup.html) 已擴為八關；七關與 Node 共用 [snapshotFixtures](../../tests/helpers/snapshots.ts)。所有瀏覽器操作使用 **Codex 內建瀏覽器**，測試入口的 storage keys 保持隔離。

| 案例 | 實際結果 |
| --- | --- |
| 七關 × 正式／開發續玩 | 共 14 組：部分工作與配置重載保留，失效 dragging 正常取消；pagehide 同步寫入一次，canvas 1，零 warning／Mission failed／未處理錯誤。比較快照工作欄位，排除正常流逝的 elapsed。 |
| 保留的部分工作 | 房屋 pours `[0.4,0,1]`；消防一火點已熄；交通第一台拖車選擇與 x=-9；警察 bike1 到位；碼頭貨箱 1 已吊起；山路 delivered `[0]`／carried 2；轉運站公車門 0.4。 |
| 分段追蹤 | 救火七階段、其餘六關六階段，每次啟動一份 success。原修路七階段另 smoke check 通過。 |
| 七關 × scene／connect 故障 | 共 14 組：對應階段 failure、一次 Mission failed、canvas 0，沒有未處理錯誤。轉運站由錯誤頁回選關重試成功，startupId 遞增。 |
| 七關啟動後 rAF 故障 | 各記一次執行期錯誤並清理 canvas；原 startup 摘要仍為 success，沒有多記一次啟動。 |
| 七關 storage getter 拒絕與 HMR | 透過開發選單設為 complete、切換靜音；pagehide 磁碟零寫入且仍是舊部分快照。main.ts HMR 後完成進度／靜音保留、canvas 1、startupId 遞增；僅預期去重 storage warnings，零 Mission failed／未處理錯誤。 |
| 正式建置 preview | 七關逐一選入／回選關；canvas 1 → 0、共享靜音保留、沒有開發面板、沒有 Mission startup／Mission failed 或 console warning/error。 |

與第七批相比，precache 維持 **55 項，1104.93 → 1109.52 KiB（+4.59 KiB）**。
入口 JS 94.44 kB（gzip 32.50 kB）：bundler 已把先前分開的 Effect 程式合併進入口，不能直接用舊入口 36.23 kB 當作總量比較。
共用 mission-persistence lazy chunk 為 1.39 kB；八關 startup 與 scene 仍走 lazy 路徑，入口維持 18 個動態 import，靜態依賴為兩個小型車輛插圖模組。
既有 578.24 kB geometry chunk 警告仍存在，本批不宣稱啟動加速。

驗證範圍是服務生命週期、續玩、診斷與切換，沒有重跑七關完整手勢通關、外部 Playwright 或離線安裝。
HMR 的完成狀態由開發控制選擇，非手勢通關。storage 被拒時，同頁記憶體仍不能保證整頁重載續玩；此限制不變。

### 2026-10-22 E09 修路試點與全站共用部分（第九批歷史紀錄）

`npm run check` 通過：**499 個測試**、TypeScript 檢查與正式建置。新增 20 個測試：

- [runtime/autosave.test.ts](../../src/runtime/autosave.test.ts) 五個：799／800 ms 邊界、無動畫仍保存、隱藏跳過、無追補突發、取消、worker／frame 互相監督、原始 cause、重進入與 cleanup defect。
- [修路 autosave.test.ts](../../src/missions/road-repair/autosave.test.ts) 兩個：正式／開發真實 session，隔離存檔服務，最新狀態、同步 pagehide／visibilitychange、寫入拒絕後記憶體優先，以及保存 → audio → scene 清理。
- [navigation.test.ts](../../src/app/navigation.test.ts) 五個：快速連續導航保留最早的清理等待、HMR 交接、晚到模組忽略、混合 cleanup defect 診斷順序、選單 disposer 一次。
- [pwa.test.ts](../../src/app/pwa.test.ts) 八個：1／2 秒 backoff 與三次上限、成功恢復、SecurityError／SyntaxError 不重試、等待 load／backoff 時取消、晚到拒絕與診斷拋錯。

瀏覽器操作全部使用 **Codex 內建瀏覽器**。[effect-autosave.html](../../tests/manual/effect-autosave.html) 匯入真實 main，存檔 key 以 run 隔離；[effect-pwa.html](../../tests/manual/effect-pwa.html) 呼叫真實註冊控制器，register 使用可控替身，不註冊測試 Service Worker。

| 案例 | 實際結果 |
| --- | --- |
| 修路正式／開發：凍結 rAF | 2.6 秒內仍有 3～4 次存檔，動畫回呼為 0，canvas 1；寫入時間約隔 800 ms。首次 800 ms 的精確邊界由 TestClock 驗證。 |
| 模擬 document.hidden | visibilitychange 先同步保存；接著 2.6 秒定期寫入為 0，pagehide 仍同步寫入 1 次；恢復可見後按間隔寫入，沒有追補。這是測試控制項模擬隱藏狀態，不宣稱測過所有作業系統背景節流。 |
| 拒絕寫入與開發 HMR | 開發控制切到 complete／兩趟；磁碟仍是原本 roller／一趟，同頁與 HMR 保留最新記憶體。恢復寫入、pagehide、重載後保留完成；僅預期去重 warning，無任務失敗。 |
| 快速切關與非同步音效關閉 | 將真實 audio close 後續等待延長 600 ms，連續切房屋／消防／修路；只有最新修路啟動，舊音效關閉一次，觀察到的最大 canvas 為 1，無錯誤。精確清理順序另由 Node gates 驗證。 |
| 正式 HMR／重載 | 部分整平一趟／88% 與靜音保留，HMR 等待 audio close；startupId 遞增，2.6 秒 3 次存檔、canvas 1，沒有重複 worker 或錯誤。 |
| worker／frame 故障 | 快照複製與 rAF 排程各注入一次拋錯：對應存檔／執行錯誤提示、每次一筆 Mission failed、canvas 0；清理後 2.6 秒存檔／動畫／待執行幀均 0，無未處理錯誤。startup 仍為 success，錯誤頁可回選關再進入。 |
| 選單清理 | 離開修路後 2.6 秒存檔／動畫／待執行幀均 0，canvas 0。 |
| PWA 重試 | 約 0／1005／3009 ms 嘗試，第三次成功；持續失敗也只嘗試三次並警告一次。SecurityError 僅一次嘗試；backoff 取消後沒有第二次，load 前取消後零嘗試，晚到 Promise 拒絕無警告或未處理拒絕。 |
| 正式建置八關導航 | 八關逐一進入／回選關，canvas 1 → 0、無開發 UI、無 Mission startup／Mission failed／console warning 或 error；瀏覽器上一頁恢復轉運站、下一頁回選單也正常。 |

與第八批相比，precache 維持 **55 項，1109.52 → 1114.62 KiB（+5.10 KiB）**；入口 **94.44 → 99.65 kB**，gzip **32.50 → 34.41 kB**。修路 startup 20.01 kB、共用 mission-persistence 1.39 kB。保留 18 個動態 import 與各關 scene／startup 懶載入；既有 geometry 578.24 kB 大 chunk 警告仍存在。此批為生命週期與排程改造，不宣稱載入加速。

本批沒有把其餘七關的定期存檔改成 Schedule，也未重跑八關完整手勢通關、真實斷網／離線安裝或 BFCache 往返。PWA 的故障與時間驗證使用上述替身；正式 preview 僅確認遊戲與導航沒有回歸。存檔拒絕時，未寫入的記憶體進度仍可能在整頁重載後遺失。

### 2026-10-22 E09 自動存檔推廣其餘七關（第十批歷史紀錄）

`npm run check` 通過：**527 個測試**、TypeScript 檢查與正式建置。[services.test.ts](../../src/missions/services.test.ts) 新增 **28 個測試**（七關各四個），原有 499 個保留；[lifecycle.test.ts](../../src/missions/lifecycle.test.ts) 的 loop 契約同步加入 `AutosaveError`。

逐關以真實 startup／session 與隔離存檔服務驗證：正式／開發各一組 TestClock 測試，確認第一個 699／799 ms 不寫入、700／800 ms 才保存、沒有 rAF 回呼仍保存最新 session 狀態；隱藏跳過定期寫入、visibilitychange／pagehide 同步寫入、恢復可見不追補、寫入拒絕後新記憶體優先。每關另有 autosave／frame 兩種失敗案例，保留 mission 與原始 cause，停止兩個工作，再依序保存、關閉音效與釋放場景；消防另確認最後保存後停止水聲。取消／失敗後推進十個間隔，皆沒有殘留保存。

[effect-autosave.html](../../tests/manual/effect-autosave.html) 擴為八關，沿用 [snapshotFixtures](../../tests/helpers/snapshots.ts) 的部分進度，並以 run 分隔所有測試存檔。所有瀏覽器操作使用 **Codex 內建瀏覽器**。

| 案例 | 實際結果 |
| --- | --- |
| 七關 × 正式／開發，動畫凍結 | 14 組皆在 2.6 秒內保存 3～4 次、動畫回呼 0、canvas 1。房屋／消防／交通沿用 800 ms，警察／碼頭／山路／轉運站沿用 700 ms；精確首次邊界另由 TestClock 驗證。 |
| 七關正式存檔與重載 | pagehide 同步寫入一次；重載保留 concrete、ground-fire、tow-exit、bikes、unload、excavate、bus-door 等部分快照，零 warning／Mission failed／未處理錯誤。 |
| 七關模擬隱藏與離場 | visibilitychange 同步保存一次，之後 2.6 秒定期寫入 0；隱藏時 pagehide 仍寫入一次。回選單後觀察 2.6 秒，存檔／動畫／待執行幀均 0、canvas 0。 |
| 七關 × 存檔／動畫故障 | 共 14 組：快照複製拋錯顯示進度無法保存，rAF 排程拋錯顯示執行失敗；每次一筆 Mission failed、canvas 0，接著 2.6 秒存檔／動畫／待執行幀均 0，沒有未處理錯誤。 |
| 消防／碼頭寫入拒絕與 HMR | 代表 800／700 ms 兩種間隔。用開發選單切到 complete，磁碟仍停在舊部分快照；HMR 等待延長 600 ms 的真實 audio close，完成狀態與靜音保留，canvas 1、audio 關閉一次。2.6 秒僅 3／4 次寫入嘗試，沒有重複 worker；各一個去重 storage warning，零任務失敗。恢復寫入、pagehide、重載後仍為 complete。 |
| 新版正式 preview | 先確認入口資產為本次 `index-K5vjTO_2.js`；舊 Service Worker 控制的分頁關閉後，新分頁載入新版。八關逐一選入／返回，canvas 1 → 0，沒有開發 UI、Mission startup／Mission failed 或 console warning/error。 |

與第九批相比，precache 維持 **55 項，1114.62 → 1114.70 KiB（+0.08 KiB）**；入口仍為 **99.65 kB**，gzip **34.41 → 34.42 kB**，共用 mission-persistence 1.39 kB。18 個動態 import 與各關 scene／startup 懶載入保留；geometry 578.24 kB 的既有大 chunk 警告不變。直接匯入 Effect 的正式檔案仍是 52 個。

驗證集中於保存、失敗監督與資源生命週期，沒有重跑七關完整手勢通關。隱藏狀態由測試控制項模擬，未涵蓋所有背景節流策略；瀏覽器 HMR 本批抽驗消防與碼頭，其餘關的取消／失敗清理由逐關 Node 與上述瀏覽器案例覆蓋。導航與 PWA 實作未變，相關測試納入完整回歸，本批未重做 PWA 故障替身、離線安裝或 BFCache 驗證。寫入拒絕時，尚未持久化的記憶體仍可能在整頁重載後遺失。

### 2026-10-22 E01～E09 八關全面檢查（第十一批，原八關稽核）

檢查全部八關的 scene／session／persistence／services／startup、修路 devtools，以及共用 storage、frame loop、audio unlock、startup diagnostics、autosave、navigation 與 PWA。正式程式直接匯入 Effect 的檔案維持 52 個，未發現漏接某一關的 E01～E09 路徑；故障注入找到並修正以下四項邊界問題。

| 項目 | 重現問題與修正 |
| --- | --- |
| E01／E04 消防水聲 | context 建立後，若水聲節點初始化失敗，後續 unlock 原本只檢查 context，無法重新建立水聲。現在回滾部分 source／filter／gain，下一次手勢重新建圖，完成後不重複建立；離場明確釋放 filter。 |
| E02／E08 音效關閉診斷 | audio.dispose 拒絕且 console.error 同時拋錯時，原本把正常取消變成 defect。現在隔離診斷失敗，仍嘗試回報含原始 cause 的 AudioCloseError，並繼續場景清理。 |
| E05 注入的 storage reporter | 預設 reporter 原已隔離 logger，但直接注入會拋錯的 reporter 仍可破壞同步降級。現在 boundary 本身也隔離 reporter；讀、寫、刪除及 JSON 失敗維持既定 fallback。 |
| E08 啟動計時 | 注入的 now 在開始／階段結束拋錯，原本可能阻止啟動或替換原始 Exit；非有限值也會產生 NaN 時間。現在隔離計時錯誤，無法取得有效時間時以 0 表示，保留階段結果、原始失敗及取消語意。 |

這些是測試注入所重現的邊界問題，不代表一般瀏覽器的 performance.now 或 console 已發生故障。計時與診斷降級只處理觀測功能，不吞掉遊戲、存檔複製或資源本身的非預期缺陷。

| 檢查範圍 | 八關一致性結論 |
| --- | --- |
| E01 資源所有權 | 八個 scene 都登記 renderer、scene graph、陰影、材質快取及 observer；八個 connection 都獨立登記輸入、提示、拖曳取消與最後存檔。救火多一個停止水聲 finalizer，屬必要差異。 |
| E02 錯誤分類 | 八關都使用共用 module／scene／session／audio close 邊界；純取消安靜，真正失敗在清理後記錄，舊導航不覆蓋新畫面。 |
| E03 動畫監督 | 八關都回傳等待中的共用 frame-loop Effect，排程、render 與 HUD 失敗都能終止任務並清理。 |
| E04 手勢音效 | 八關都使用同步開始、合併 pending、觀察拒絕與 signal 取消的 unlocker；消防額外補齊水聲部分初始化後的重試。 |
| E05／E06 存檔 | 八關正式／開發路徑都有同步 storage 降級及目前版本 Schema；保留記憶體優先、部分工作及取消失效輸入。消防沒有上一回合配置；修路有自己的 envelope、調校與 HMR 優先序。 |
| E07 服務 | 八關都從各自 Context／Layer 取得 persistence 與 scoped audio，場景先取得、connection 先釋放；沒有額外內層 scope 提早關閉音效。 |
| E08 追蹤 | 八關都有根 span 與 prepare／scene／audio／connect；修路／救火三個模組載入共七階段，其他六關兩個載入共六階段。診斷不延伸到每一幀。 |
| E09 排程與全站 | 八關都以 withAutosave 共同監督 loop，hidden 跳過定期寫入，pagehide／最後存檔仍同步。共用導航保留清理等待，PWA 有界重試與取消維持原契約。 |

保留的任務差異如下；版本與間隔不同是既有設計，沒有為了統一表面數字而改動。

| 任務 | 當前存檔版本 | 定期存檔 | 啟動階段 |
| --- | --- | --- | --- |
| 修路 | 1 | 800 ms | 7 |
| 蓋房子 | 6 | 800 ms | 6 |
| 救火 | 1 | 800 ms | 7 |
| 交通救援 | 3 | 800 ms | 6 |
| 警察 | 1 | 700 ms | 6 |
| 碼頭 | 3 | 700 ms | 6 |
| 山路 | 3 | 700 ms | 6 |
| 轉運站 | 4 | 700 ms | 6 |

`npm run check` 通過：**535 個測試**、TypeScript 檢查與正式建置。新增八個測試先確認原實作失敗，再驗證修正：消防 gain／start 部分失敗兩例、音效清理 logger 一例、注入 storage reporter 一例、throw／階段結束 throw／NaN／Infinity 計時四例；計時案例各涵蓋成功、失敗及取消。既有逐關資源清理、正式／開發服務、Schema、TestClock、navigation 與 PWA 測試全部通過。

另做一次 domain → JSON → decoder 稽核：各關預設配置的每個入口階段以 0.1 秒推進，最多 150 步或到狀態不變，合計 **5,234 個快照**（修路 652、房屋 1,153、消防 1,684、交通 338、警察 189、碼頭 246、山路 465、轉運 507）皆能解碼。這是自動演進取樣，不等同窮舉所有手勢組合。

所有瀏覽器操作使用 **Codex 內建瀏覽器**；[effect-runtime.html](../../tests/manual/effect-runtime.html) 新增水聲節點及音效關閉／logger 雙故障控制與計數，沿用 [effect-autosave.html](../../tests/manual/effect-autosave.html) 的隔離存檔案例。

| 瀏覽器案例 | 本批實際結果 |
| --- | --- |
| 消防部分初始化與重試 | 第一次 createGain 故障：context 1、水聲啟動 0、filter 釋放 1、解鎖警告 1，遊戲繼續。第二次手勢：context 仍 1、水聲啟動 1；離場後 filter 累計釋放 2、context 關閉 1。 |
| 八關音效關閉／logger 雙故障 | 使用真實 AudioContext，close 完成後注入拒絕，再讓關閉診斷拋錯。八關皆正常返回選單、canvas 0、context 關閉 1、關閉診斷嘗試 1，Mission failed／未處理錯誤皆 0。真正 close 拒絕且未完成的情況由 Node 測試覆蓋。 |
| 八關正式存檔與動畫凍結 | 前四關在 2.6 秒內寫入 3 次、後四關 4 次，動畫回呼皆 0；每關 pagehide 同步寫入 1 次。精確 700／800 ms 邊界由 TestClock 驗證。 |
| 八關離場停止 | 每關回選單後再觀察 2.6 秒，存檔嘗試／成功、動畫回呼與待執行幀皆 0；沒有 warning、Mission failed 或未處理錯誤。 |
| 新版正式建置 | 關閉舊 Service Worker 控制的分頁，再核對入口為本批 index-DdA-rzFX.js。八關逐一選入、操作音效、返回，canvas 1 → 0，無開發 UI 或 console warning/error。 |

與第十批相比，precache 維持 **55 項，1114.70 → 1115.05 KiB（+0.35 KiB）**；入口 **99.65 → 99.80 kB**、gzip **34.42 → 34.45 kB**。保留 18 個動態 import、各關 lazy 邊界及原有 geometry 578.24 kB 大 chunk 警告。

本批未重跑八關完整手勢通關、HMR、PWA 瀏覽器故障替身、離線安裝或 BFCache；相關未修改邊界由既有測試及前批紀錄補充。本次瀏覽器排程測試使用正式存檔模式，開發模式由完整逐關 Node 回歸覆蓋。儲存拒絕後的記憶體無法跨整頁重載保證續玩、原生 import／resume／register 無法被 Effect 實際取消，以及 DOM／ResizeObserver 回呼不屬於 frame-loop 邊界等限制仍然保留。

### 2026-10-24 第九關沿用 E01～E09

新增 `sanitation/scene.ts`、`session.ts`、`persistence.ts`、`services.ts`、`startup.ts` 五個 Effect 使用檔案；
其餘車輛、場地幾何、輸入規則與逐幀計算維持普通 TypeScript。新關使用既有 scene／renderer 所有權、
分類啟動錯誤、可選音效解鎖、Schema／同步儲存邊界、注入 persistence／scoped audio、六階段 startup span，
以及 700 ms 的共用 autosave 與 frame-loop 互相監督。全站導航與 PWA 策略沿用，新增 lazy 關卡入口。

清潔隊版本 2 保留抽選的回收組合與接棒次序、部分行車、兩種升桶高度、兩組裝載順序、物品位置、空桶、單向清掃成果與倒料時鐘；
重載／HMR 清掉舊手指與未提交停留，已完成不重播離場。只接受完整目前格式，不增加遷移分支。

新增 113 個清潔隊檢查及 26 個正式／開發共用整合回歸，`npm run check` 合計 **674 個測試**與正式建置通過。
共用回歸涵蓋部分初始化與清理失敗、frame／HUD 故障、音效解鎖、Schema／不變量、同步離頁保存、服務注入、
音效清理順序、啟動失敗及 TestClock 存檔排程。14 個正式 Playwright 案例通過：兩配置的桌面／直向手機模擬觸控全程、部分升桶與倒料重載、徽章／重玩與九關離線載入；另 2 個開發案例通過兩種升桶、六組回收物、HMR／配置重設及收刷後匯出的整車淨空。
Codex 內建瀏覽器亦對照原清掃車外觀、新車尾／側邊桶架與實際向上拖曳；未宣稱實體 iPad／Android 或可聽音訊已驗證。

### 2026-10-24 文件分拆與九關現況核對

程式基準為 `8a74bce`；本次尚未提交的變更僅涉及八份文件，沒有修改遊戲、測試或依賴。
將原 Effect 文件拆為現行架構／維護指南、驗證指南及本歷史檔。原分階段計畫與十二段實作／驗證紀錄逐段完整保留，
以搬移前內容比對確認僅調整相對連結；未把原八關成果改寫成九關，也未補造舊批次的執行版本。

核對九關的 scene、session、persistence、services、startup、main 載入分支與共用 helper，
確認皆接入 E01～E09；以來源交叉檢查目前 Schema 版本、存檔間隔、六／七啟動階段、開發 key 與必要例外。
現行指南補齊清潔隊版本 2、700 ms 排程、六階段啟動、開發前綴與上一回合 key v2，
修正「修路以外七關」「消防以外七關」等已過時計數，並移除其他文件中重複的 Effect 實作批次與測試總數。

覆蓋核對發現：共用 Node adapters／fixtures 已包含九關，但 runtime／storage／startup／autosave 四個手動故障頁的選單仍只含原八關。
驗證指南明列此差異與補入口要求，沒有聲稱清潔隊已跑過這四頁；本次也未擴充手動頁。
根目錄新增 AGENTS.md，保留 CodeGraph 指引，要求維護既有關卡與新關卡設計先讀設計原則、Effect 契約及驗證指南。
README、architecture、PROJECT_PLAN 與 mission-design 同步導讀，提案及完成清單包含資源／取消／保存、測試登記與文件更新。

本次實際執行 `npm test`：**674 通過、0 失敗、0 跳過**。
八份文件的 189 個本機連結、37 個章節連結、歷史完整性與空白格式檢查通過；九關差異表與來源交叉核對通過。
本次是文件整理，未重跑正式建置、Playwright、Codex 內建瀏覽器或實體裝置；上列既有瀏覽器結果仍只代表各自記錄的版本與範圍。

### 2026-10-24 清潔隊手動故障頁補齊

程式基準 `8a74bce`；工作目錄保留前一批文件整理，本批新增四個 `tests/manual/effect-*.html` 選單入口、
startup／autosave 的九關標題，以及共用快照 fixture 的清潔隊版本 1 拒絕案例。遊戲與 runtime 實作、依賴均未變更。
前一筆「四頁尚未包含清潔隊」是當時狀態，完整保留；本批補齊後九關皆有 Node 與四個手動故障頁入口。

瀏覽器使用 **Codex 內建瀏覽器**，來源為本機 Vite `http://127.0.0.1:5174`，滑鼠操作、556 × 774 視窗。
runtime 頁依既有設計使用 `dev=1`；storage／startup／autosave 均分別驗證 `dev=1` 開發模式與 `dev=0` 正式存檔模式。
`dev=0` 仍是開發服務，不以此宣稱正式 bundle 已完成互動驗證。

| 頁面 | 實際執行案例 | 結果 |
| --- | --- | --- |
| runtime | 同步建構失敗、非同步 resume 拒絕、下一手勢重試、audio close 與診斷同時失敗、rAF 排程失敗及回選單。 | 解鎖失敗各一次 warning 且仍可玩；重試沿用／建立正常 context。close 與 logger 故障仍關閉 context、canvas 歸零，沒有任務失敗；frame 故障清理後只回報一次並顯示返回選單入口。 |
| storage | 兩模式各驗有效部分進度、版本 1、壞 JSON、錯誤數字型別、矛盾完成狀態；getter／get／set／remove／readonly；pagehide、重載、回選單重開及同頁重訪。 | 有效進度保留 bin-lift／版本 2；四種無效輸入分別回報 schema／json／invariant 並開新局。可用時 pagehide 同步寫入一次，getter 拒絕時無底層寫入；寫入失敗仍可玩。刪除拒絕確實觸發 remove 診斷，唯讀磁碟仍是舊 bin-lift 時畫面與同頁重訪仍使用新局記憶體。 |
| startup | 兩模式各驗正常六階段、scene／connect 故障、storage getter 降級，以及啟動成功後的 frame 故障。 | 正常只一筆 success；恢復 travel 0.4、aim 0.4、held null、action ready。scene／connect 分別回報 SceneInitError／SessionInitError、保留注入 cause，清理後零 canvas；storage 故障仍 success。執行期失敗保留已成功的 startup 摘要並只回報一次任務失敗。 |
| autosave | 兩模式各驗凍結 rAF、hidden／pagehide、拒絕寫入、延遲 close 後快速切關、回選單、clone／frame 故障。另實際拖曳開發模式升桶並重載。 | 凍結後 2.6 秒樣本皆寫入四次、動畫零次；hidden 樣本零次定期寫入，隱藏事件及 pagehide 各同步保存一次。拒寫時嘗試仍增加但成功零次且只可選警告。快速導航等待舊音效後才出現第二筆本關 success，最大畫布一個；離場及任一 worker 故障後樣本的嘗試／寫入／動畫／待執行皆為零。 |

clone 故障在動畫凍結時觸發，確認由存檔 worker 回報 AutosaveError；frame 故障為 FrameLoopError。
兩種故障皆只一次 Mission failed、零 canvas，沒有未處理拒絕。其他故障案例亦未出現未處理錯誤。
實際升桶由 travel 0.4 拖至約 0.8118；同步保存後重載保留高度、held 為 null，快速切關再回本關仍保留進度。
真實 timer 的四次寫入是本次樣本結果，不改變「700 ms 首次等待、完成後再等待且不追補」的排程契約。

`npm run check` 通過：**674 個 Node 測試、0 失敗、0 跳過**，TypeScript 與 Vite 正式建置成功。
precache **58 項／1159.33 KiB**；原有 geometry **578.24 kB** 大 chunk 警告仍在。四頁內嵌模組語法、九關選單與 fixture 對照檢查通過；190 個本機連結、38 個章節連結及原十二段歷史完整性檢查通過。
現行指南、驗證指南、README 與 PROJECT_PLAN 同步更新入口覆蓋；驗證指南補充「刪除故障需實際重開」與「快速導航等待新 success」操作條件。

本批未重跑原八關全部故障矩陣、完整手勢通關、HMR、正式 preview 互動、PWA 故障／離線安裝、Playwright 或實體裝置；
消防專屬水聲節點案例不適用清潔隊。可聽音訊、實際觸控與硬體效能仍未驗證，記憶體 fallback 也不保證儲存拒絕後跨整頁重載續玩。

### 2026-10-25 九關取景檢視與設計守則

程式基準 `8a74bce`；開始時工作目錄已有前述文件整理、四個手動故障頁及共用 fixture 的未提交變更，本次保留。
本批僅修改 AGENTS、PROJECT_PLAN、mission-design、effect-verification，新增 [九關取景檢視](../mission-framing-audit.md)，並追加本段歷史；沒有修改遊戲程式、測試、依賴或部署。
無 E01～E09 生命週期、資源所有權、取消、Schema 或排程變更；核對現行九關任務差異表及驗證入口後保持原登記。

讀取對話「規劃第九關垃圾清運」的左側裁減紀錄，並以 `git show 8a74bce` 核對最小投影高度／寬度由 18／23 改為 14.5／18.5，以及固定向右偏移 0.4。
約 24% 放大屬於該次已完成的變更，本批未重複計為新成果。
本次核對九關選單、lazy 入口、相機、主要作業範圍與動線，逐關列出上／下／左／右裁切候選及必留條件。
設計守則新增四邊取捨表、主體大小、全階段與配置範圍、手動／自動進出場、桌面與手機限制軸及取景驗收，並納入新關提案與既有關卡維護入口。

瀏覽器為 Codex 內建瀏覽器、本機 Vite `http://127.0.0.1:5174`、`dev=1`；九關均觀察桌面及直向代表階段。
主要 canvas 尺寸為 1280 × 800 與 390 × 844；開發面板另佔右側 300 px 或底部 225 px。
具體階段、配置及未覆蓋項目見[實際觀察表](../mission-framing-audit.md#本次實際觀察與限制)。
發現手機九關均受最小寬度限制，僅裁上下不會放大車輛；山路 `sweep/layout=0` 的清掃車在起點已有左端出框，列為後續動線與取景一起檢查的既有限制。
優先候選為交通救援兩端行程、警察及山路的桌面留白；本批沒有實作裁切或宣稱新取景已通過互動驗證。

文件來源、相對連結、章節錨點與空白格式檢查通過；比對本回合開始前的歷史全文，確認僅在末尾追加，既有日期、數字與結果完整保留。
依純文件變更範圍，未重跑 Node 測試、建置或 Playwright；本次瀏覽器為代表畫面審視，未重跑完整手勢、所有配置／順序、取消／reload／HMR、正式 preview、PWA、橫向手機／平板或實體裝置。

### 2026-10-25 八關固定取景實作與驗證

基準 `8a74bce`。除使用者指定另行重新設計的警察隊外，八關調整固定取景、必要的手動車程與地面覆蓋。
E01～E09、生命週期與目前存檔格式無變更；消防與交通使用顯示／輸入映射保存原有絕對進度。
`npm run check`：682 個測試、TypeScript 與正式建置通過。內建瀏覽器檢查八關代表姿態、部分進度重載及受影響交接。
Playwright 因缺少 Chromium 未成功執行，不計為通過；未完整重玩所有關卡／配置，也未重跑正式 preview、PWA 或手動故障全套。
逐關範圍、四種畫布投影、限制與提交版本見[專項執行紀錄](mission-framing-20261025.md)，取景決策見[九關檢視](../mission-framing-audit.md)。

### 2026-10-28 警察臨檢改版提案（未實作）

程式基準 `2228fe8`。使用者提出將第五關改為臨檢發現通緝犯，以簡化繞行及交接。
新增[討論草案](../police-checkpoint-proposal.md)：五項主要手動操作、兩套直路配置、兩台重機的角色選擇、
四邊取景候選、主體大小目標，以及新版狀態／Effect 整合與驗證計畫。這些尚未確認或實作。

本次核對設計／模型清單、E01～E09、police 的 version 1 Schema／startup、任務差異表、共用 Node adapters／fixtures、
四個手動頁與正式／開發瀏覽器入口。既有入口目前仍對應追捕玩法，新版需更新 fixture 與案例，不能計為已覆蓋。
只新增提案及追加本段歷史，未修改既有未提交文件內容、遊戲程式、存檔格式、資源生命週期或部署。
提案相對連結與文件格式檢查通過；本次沒有遊戲執行結果，未跑 Node／建置、內建瀏覽器、Playwright 或硬體測試。
四邊取景、車身大小及臨檢流程均為待驗證設計，歷史追捕關卡的測試結果不作為此改版證據。

### 2026-10-28 警察五步臨檢首版

基準 `2228fe8` 加本機未提交變更。使用者確認五步流程後，將第五關改為「警車就位 → 自選重機警戒 → 偵防車到站 → 拉開側門 → 押送出發」。查證、陪同下車、上車、重機領行、車隊清場與恢復通車自動銜接；左右兩套直路配置取代舊街區追捕。沿用既有車型、人物、交通錐與路障，新增臨檢牌及查證圖像。固定取景、四邊必要範圍、新舊車身／門把投影見[設計紀錄](../police-checkpoint-proposal.md)。

E01～E09 及 scene／connection 資源所有權無變更；沒有新增背景 timer 或服務。警察快照由 version 1 升為 2，work 改為五項、保存選中重機與兩種配置；同步 Schema、resume、不變量、fixtures、共用 persistence／services adapters 與上一局摘要 key。舊追捕存檔明確拒絕，不補遷移；完成徽章及靜音偏好沿用。README、PROJECT_PLAN、架構、模型、設計現況、任務差異表與驗證入口已同步。

執行結果：

- `npm run check`：**682 tests，682 pass，0 fail**；TypeScript 與正式建置成功。其後只修正查證提示與字幕的間距，`npm run build` 再次成功。既有大於 500 kB 的 Three.js 共用 chunk 建置提醒仍存在。
- 警察 domain 15 項測試包含兩方向 × 兩台重機 × 兩種車型的五步完成、取消／部分工作續玩、點按不開門、舊手指交接隔離、自動計時及版本拒絕。幾何以含車輪的保守車體外框逐段核對交接、離場及等待人物淨空；縮短路線後的最末小段拖動亦經瀏覽器重現修正。
- Codex 內建瀏覽器，Vite `127.0.0.1:5174`、`dev=1`：桌面 1280 × 800（canvas 980 × 800）配置 0／小客車／二號重機，從重機段走至完成；直向 390 × 844（canvas 390 × 619）配置 1／受檢廂型車／一號重機，從警車停靠走至完成與重玩換向。檢查了兩方向側門、等待／上車、領行與清場、五步完成指示、部分車門重載、HMR 保留進度。車門把手偏下 44 px 點按沒有進度，拖動可開門，重載後保留 `0.223544…` 部分進度。
- `effect-storage.html`，警察：開發與正式模式的有效 fixture 均恢復 `guard=0.45`、二號重機，pagehide 各同步寫入一次、版本 2；正式模式 version 1 追捕 fixture 產生預期 Schema 診斷並開新局。正式模式寫入／刪除拒絕仍可拖動至 `guard=0.625712…`，無 error，儲存警告保持有界。這些是隔離測試資料。
- 正式 preview：原 `127.0.0.1:4173` 載入較舊 PWA 快取，因此不計為新版驗證。`127.0.0.1:4175` 確認九張選關卡片及新說明、一般模式警車部分進度重載與重機／查證／接送；另檢視實際 canvas 320 × 568 與 844 × 390 的到站姿態。最後從乾淨來源 `localhost:4175` 載入最終 `/assets/index-DCKf2z6v.js`，與 dist 相符，再走警車／重機／查證，量得查證圖像與字幕間距 12 px。單一 canvas，正常遊玩未見 console warning／error。
- 更新 CI 的 police 與 development Playwright 案例，覆蓋左右配置、直接選重機、查證提示不壓字幕、寬容車門抓取、續玩、上車、完成與重玩；本機依專案規則**沒有執行 Playwright**。

限制：內建瀏覽器使用滑鼠操作與尺寸模擬，未驗證實體手機觸控、幼兒試玩或裝置效能；沒有在最終正式來源重走全部配置完整通關，沒有重跑其他八關完整遊戲、runtime／startup／autosave 故障頁全套或 PWA 離線／更新套件。矮畫面的車體為保留 HUD 淨空而比舊版小，已在設計表列明。這次沒有修改快取策略，沒有 commit、push 或部署；現有未提交的文件整理與手動入口改動保留。

### 2026-10-28 警察車輛與多車臨檢補充提案（未實作）

基準 `2228fe8` 加先前本機臨檢首版及既有未提交變更。本次回應使用者對進度圖示、受檢車與偵防車同型、受檢車數及新增協作車種的意見；核對現行 UI、模型清單、拖吊車／計程車／材料平板車來源及既有設計與 Effect 契約。
在[臨檢設計](../police-checkpoint-proposal.md#下一版討論車輛任務列與多車臨檢待確認)追加待確認方案：車輛任務列、三台依序受檢車、通緝車改用小客車、平板拖吊車收尾，以及交通管制車候選。列明五步自動拖吊與六步手動拖吊的差異，補齊四邊取景、資源、取消、部分進度、存檔版本與驗證規劃。
只追加文件，遊戲與模型尚未修改；本次檢查文件相對連結及格式，沒有重跑 Node、build、內建瀏覽器或 Playwright。首版測試結果不作為新增車流／拖吊已驗收的證據。

### 2026-10-28 警察六步臨檢與平板拖吊

基準 `2228fe8` 加本機未提交變更。使用者確認四組車輛任務列、三台依序受檢車與第六個手動拖吊任務。一般車為既有計程車及載貨平板車，第三台固定為通緝小客車；偵防車與受檢車輪廓分開。幼兒拖平板拖吊車倒車對位，之後自動放板、絞盤裝車、升板固定及離場。相機保留五步版的固定視角，臨檢位偏移以容納原尺寸拖吊車與斜板。設計、四邊取景及實體車寬見[當前設計紀錄](../police-checkpoint-proposal.md)。

警察快照升為 version 3，新增三車查驗索引、一般車順序、第六項 work 與拖吊階段／時鐘；上一局摘要 key v3，版本 1／2 明確拒絕。同步 Schema、resume、不變量、adapters、fixtures 與 CI 案例。E01～E09、資源 scope、700 ms autosave、同步 pagehide、取消與可選音效契約不變。原交通拖吊車、轉運站計程車、碼頭貨物抽成 runtime 純模型，原模組保留匯出；逐一比較 HEAD 原函式內容，三者原樣一致。

執行結果：

- `npm run check`：**688 tests，688 pass，0 fail**，TypeScript 與正式 build 通過；既有 Three.js 共用 chunk 大於 500 kB 的提醒仍存在。`node --check` 通過 police 與 development CI specs。
- 警察 domain／幾何共 **21 項**：八種方向／重機／一般車序組合的六步完成，取消／部分工作／重載、查驗序列不重複放行、版本 1／2 拒絕、四車卡完成時機、拖吊輪胎接地與裝載連續性。新增實際模型外框遍歷車流、交通錐、降低平板／斜板及載車，六種 canvas 尺寸核對全車及全開門取景；原人物／車隊交接粗外框檢查保留。
- Codex 內建瀏覽器正式 preview `127.0.0.1:4176`，載入 `/assets/index-BzP2fjV4.js` 與 dist 相符。桌面 `1280×800`，配置 0／計程車先／bike0，完整六步通關；第二台載貨車查驗中重整後仍為索引 1。門把下方 44 px 單點無進度，拖動後 `door=0.143855…` 重整原值保留。拖吊倒車 `recover=0.251428…` 重整後原值保留，裝載初段重整後接續，完成存檔不重播；再玩換為配置 1／貨車先。
- 同一正式 preview，直向 `390×844`，配置 1／貨車先／bike1，完整六步通關至四車卡勾選及 100%。直接拖第二台重機後重整保留選擇；檢視貨車、通緝小客車、近側門、上車、拖吊倒車與降板，車體完整且未壓住操作 HUD。兩次正式通關未見 console warning／error；使用滑鼠拖拉，未把尺寸模擬視為實體觸控測試。
- Vite 開發模式 `127.0.0.1:5174`：檢查裝車前與小客車爬上斜板姿態，裝載中重整仍在 tow-load 並接續離場。配置 1／貨車先的拖吊部分進度 `0.572000…` 經 `main.ts` HMR 後原值保留，單一 canvas。
- 共用模型原關代表畫面：轉運站 choose 的計程車、碼頭 transport 的六輪貨車／兩箱貨物、交通 hook 的平板拖吊車及降低斜板，模型正常。所有受影響 mission 的共用生命週期、保存、服務與 domain 檢查包含於全套 Node；沒有完整重玩這三關。
- `effect-storage.html` 隔離正式模式：版本 3 有效部分重機 fixture 恢復；pagehide 同步寫入一次，顯示版本 3。版本 2 五步 fixture 產生預期 Schema 診斷並開新局。寫入／刪除拒絕仍可把重機從 `0.45` 拖至 `0.610726…`，error 0，儲存診斷有界。
- README、PROJECT_PLAN、架構、模型清單、Effect 任務差異表、驗證入口與設計現況同步；保留既有歷史紀錄與舊提案錨點。

限制：本機依專案要求沒有執行 Playwright，CI 案例只更新並檢查語法；未驗證實體手機觸控、幼兒試玩、硬體效能、其他八關完整遊戲、runtime／startup／autosave 故障頁全套或 PWA 離線／更新套件。沒有 commit、push 或部署；既有未提交文件整理及手動頁改動保留。

### 2026-10-28 警察重機與偵防車進場動畫

基準 `2228fe8` 加本機六步臨檢與既有未提交變更。警車就位後，兩台重機錯開 0.25 秒從畫外駛入，2 秒後停妥開放選擇與拖動；三車查驗結束後，偵防車沿前側道路由畫外駛入，1.8 秒後停妥才交給玩家。兩段皆沿用固定相機、既有模型與手動起點，不增加第七個操作。[關卡設計原則](../mission-design.md#車輛進出場與交接)新增連續進場、完整入鏡、停妥後交接、續玩與取消要求；[臨檢設計](../police-checkpoint-proposal.md#進場動畫與交接)補齊時間、四邊取景與存檔規則。

新增 `bikes-arrival`、`van-arrival` 自動 phase，沿用 session frame／domain elapsed，沒有新增 timer、服務或資源所有權。E01～E09 不變。快照維持 version 3：沒有新增必要欄位，也沒有改變既有 phase／work 的意義；先前完整有效的 version 3 待命／操作快照直接續玩，不倒退補播，新進場快照保存並接續 elapsed。版本 1／2 仍拒絕，沒有遷移。共用 persistence adapter 新增兩段進場的中途快照；README、PROJECT_PLAN、架構、Effect 差異表及驗證入口同步。

執行結果：

- `npm run check`：**690 tests，690 pass，0 fail**，TypeScript 與正式 build 通過；既有 Three.js 共用 chunk 大於 500 kB 的提醒仍存在。兩份受影響 CI spec 的 `node --check` 通過。
- 警察 domain／幾何共 **23 項**。新增兩方向進場的中途 resume、進場期間拒絕操作、舊手指隔離、停妥前後姿態連續；實際模型在六種 canvas 尺寸核對整車從畫外開始、可見部分避開 HUD、結束時完整入鏡並與手動起點一致。原六步完成、交通錐／人物淨空與拖吊檢查仍通過。
- Codex 內建瀏覽器 Vite：桌面 1280×720（canvas 980×720）檢視配置 0 的兩台重機錯開進場及偵防車左側進場；手機尺寸 390×844（canvas 390×619）檢視配置 1 偵防車從右側進場、停妥後提示才顯示。進場觸發後重整可繼續到待命階段；手機進場後拖動偵防車，重整保留 `arrive=0.3097857142857018`。
- 正式 preview `localhost:4176` 載入 `/assets/index-BBaCwuH8.js`，與 dist 相符；桌面 1280×720，配置 1 從警車停靠自然銜接重機畫外進場、手動警戒、三車查驗、偵防車待命，再手動停靠至開門。單一 canvas，未見 console warning／error。驗證後還原 viewport override，保留本機預覽。
- CI police 案例補上兩段進場的無提示與 reload 交接；development 案例補上凍結時鐘下的進場中途 reload／HMR、elapsed 與 work 保留。本機依專案規則**沒有執行 Playwright**，語法通過不等於瀏覽器案例通過。

限制：本次內建瀏覽器沒有精確凍結兩段進場的中途時鐘，數值相同的中途續玩由 Node 檢查，精確 HMR／reload 瀏覽器案例留待 CI 執行。沒有重跑後半段完整拖吊、所有配置完整通關、其他八關、手動故障頁全套、PWA 離線／更新或實體手機觸控；前次六步驗證保留為前次結果。沒有 commit、push 或部署，既有未提交變更均保留。

### 2026-10-28 警員走向小客車與陪同銜接

基準 `2228fe8` 加本機六步臨檢與進場動畫及其他既有未提交變更。第三台車查驗原先直接將警員從待命點改到車旁，現改為小客車停妥後步行靠近，2.9 秒到位才顯示查驗圖像及舉手；陪同到等候區、等待偵防車與上車也使用連續位置。實際外框檢查發現原候選站位會碰到全開車門，已移至車門外。保留既有模型、固定相機、三車時間、六項手動操作及 version 3；純 `officerPose` 由原 elapsed 推導位移、起伏及擺臂，沒有新欄位、資源、timer、服務或 E01～E09 例外。

- `npm run check`：**692 tests，692 pass，0 fail**，TypeScript 與正式建置成功；原 Three.js 大型 chunk 提醒仍存在。警察 domain／幾何共 **25 項**，新增逐小段位置連續、查驗先後、兩方向中途 resume、等候／上車交接，以及真實人物模型對小客車全開門、兩種重機選擇及六種 canvas 投影的檢查。共用 persistence adapter 增加警員走向車旁、陪同及上車中的有效快照。
- Codex 內建瀏覽器 Vite `127.0.0.1:5174`：桌面 1280×720（canvas 980×720）配置 0 檢視查驗、陪同及等候；手機尺寸 390×844（canvas 390×619）配置 1 在「警員走到車旁」時重整，畫面續接步行，再手動停靠偵防車、開門並檢視上車。手機新站位與路徑皆可見，未見 console warning／error，結束後已還原 viewport override。
- 正式 preview `127.0.0.1:4177` 載入 `/assets/index-BDv6KB1M.js`，與本次 dist 相符；1280×720 由警車停靠、重機警戒自然進入三車查驗並到偵防車待命，正常來源未見 console warning／error。正式版採樣未捕捉到短暫的走向車旁畫面，不將該次正式流程當成步行畫面驗收；步行視覺證據為上述 Vite 檢查。
- development CI 新增第三台查驗的中途 HMR／reload、到位前隱藏查驗圖像與到位後顯示、接回下一項操作；`node --check` 通過，本機依專案規則**沒有執行 Playwright**。一般正式 CI 流程的階段及時間未變，保留既有入口。
- 關卡設計原則補入人物移動／到位後提示規則，臨檢設計補入步行時間、連續等候／上車及四邊取景說明；Effect 差異表與驗證入口已同步。相關相對連結及 `git diff --check` 通過。

限制：精確中途 HMR／reload 的時鐘比較由 Node 與待執行 CI 案例涵蓋，本次瀏覽器沒有凍結時鐘。未重跑六步完整通關、其他八關、故障頁全套、PWA 離線／更新、實體手機或幼兒試玩。沒有 commit、push 或部署，既有未提交變更保留。

### 2026-10-28 重機二選一提示提案（未實作）

基準 `2228fe8` 加目前本機警察改版及既有未提交變更。核對 police session／scene 的 `preferred`、可操作集合與命中規則，以及共用 drag-hint 的完整示範週期；確認兩台皆可選，但未操作時小手預設持續示範一號。
依使用者要求，於[臨檢設計](../police-checkpoint-proposal.md#重機二選一提示提案未實作)記錄「兩台同時標示可選＋單一小手輪流完整示範」建議，包含替代方案取捨、抓取停止輪播、零進度取消／部分進度續玩、減少動態模式、四邊取景及 Effect／驗證計畫；[設計原則](../mission-design.md#多選一的可選提示與手勢示範)新增通用要求及提案清單項目。

本次只改文件，提示尚未實作；E01～E09、Schema、快照與模型均無變更。本次新增／修改段落的相對連結、章節錨點與空白格式檢查通過，核對本回合開始前的 `src/`／`tests/` 內容雜湊未變，歷史僅末尾追加。未執行 Node／build／內建瀏覽器／Playwright 或幼兒試玩；既有執行數字不作為本提示方案已驗收證據。沒有 commit、push 或部署。
