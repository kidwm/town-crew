# Repository 工作指引

## 關卡維護與設計必讀

修改既有關卡、討論新關卡玩法或新增關卡實作前，先讀：

1. [關卡設計原則](docs/mission-design.md)：固定視角、四邊取景與主體大小、重玩配置、幼兒選擇與續玩行為。
2. [Effect 架構與維護指南](docs/effect-usage.md)：受影響的共用契約、任務差異，以及[維護與新增清單](docs/effect-usage.md#維護與新增關卡清單)。
3. [Effect 驗證指南](docs/effect-verification.md#按變更選擇驗證)：依改動選擇測試與瀏覽器案例，確認該關實際列入哪些測試入口。

新關卡從提案階段填寫[設計清單](docs/mission-design.md#每個新關卡提案必填)，列明資源所有權、取消、部分進度、存檔與可選音效，不能等完成玩法後才補 Effect 整合。
維護既有關卡也適用；純幾何或文案修改可註明沒有生命週期變更，再依驗證指南縮小檢查範圍。
提案或修改場景／相機／車型／動線時，填寫[四邊取景檢查](docs/mission-design.md#四邊取景與主體大小)，以全流程必要範圍判斷上、下、左、右可裁部分，分別核對桌面與手機的主體大小。
改共用 `app/`、`runtime/` 或 `main.ts`，另讀[架構邊界](docs/architecture.md)，核對所有受影響關卡，不能只驗修路。
新增或修改模型前另讀[建模清單](docs/model-catalog.md)，先查既有模型與外觀。

## 實作與完成條件

- 沿用 Effect 指南中的 E01～E09 契約；domain 與逐幀計算保持普通 TypeScript。需要例外時先交代原因、所有權、取消及失敗行為，並同步寫入指南。
- 目前只接受完整當前版本存檔；不要自行補回舊版遷移。狀態變更須一起核對 Schema、domain resume、不變量及 fixtures。
- 新關須登記共用測試 adapters、fixtures、runner 與適用瀏覽器入口；缺少入口或未執行的案例不得宣稱已覆蓋。
- 本機瀏覽器測試、畫面檢查、互動與手動故障驗證，直接使用 Codex 內建瀏覽器；這是專案既定授權，不必再詢問使用哪個瀏覽器或是否改用內建瀏覽器。
- 不為本機驗證另啟 Chrome／Playwright 瀏覽器、下載瀏覽器或要求相關權限。保留並維護既有 Playwright 測試供 CI 使用；只有使用者明確要求執行該自動化套件時才另行執行。
- 完成時核對受影響的驗證入口及設計文件。只有新增／修改 Effect 整合、E01～E09 契約、資源所有權／取消／錯誤傳播／存檔／排程策略，或專門驗證這些機制時，才同步 Effect 任務差異表並將結果追加到 [Effect 採用歷史](docs/history/effect-adoption.md)，寫明版本、範圍與限制；不要改寫既有歷史數字。
- 一般玩法、動畫、模型、視覺、提示與文案的修改，若只是沿用既有 Effect 邊界，不必寫入 Effect 歷史；將必要驗證摘要記在對應關卡設計文件或專項紀錄。純設計討論及一般文件維護也不另追加 Effect 歷史。判斷依實際契約影響，不依檔名、是否引用 Effect 或是否執行全套測試。
- 純文件整理核對來源、連結、章節錨點與歷史完整性即可，不因此強制重跑全部遊戲；程式變更依驗證指南執行必要檢查。

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
