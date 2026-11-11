# 幼兒關卡語音

## 目前進度

2026-11-11：本版完成消防 19 句、修路 13 句與蓋房子 10 句，共 42 個 Gemini／Sulafat 預錄語音條目。全部綁定台詞、配音設定、cue、音檔雜湊及獨立轉錄紀錄，已接上 Effect 播放與 PWA 預快取。其他關卡仍分批製作，完成核對後再納入發佈；不把候選音檔或空 manifest 當作完成。

| 關卡 | 台詞條目 | 核對範圍 |
| --- | ---: | --- |
| [消防](../src/missions/fire-rescue/domain/narration.ts) | 19，已核對 | 介紹、所有階段、閒置教學、剩餘對象、滅火及上籃完成 |
| [修路](../src/missions/road-repair/domain/narration.ts) | 13，已核對 | 介紹、挖起／裝車、拖曳／點選、清運、車斗上拉、壓平及完成 |
| [蓋房子](../src/missions/house-build/domain/narration.ts) | 10，已核對 | 介紹、澆灌、送貨、吊鉤取貨／放置、各區填滿、材料安裝、停車及完成 |

相同台詞與配音設定可重用已核對的錄音，每個關卡仍保留自己的 cue 來源雜湊；重用證據應標明原始來源，不能冒充新做了一次轉錄。

## 設計規則

- 孩子不必識字，也不必等旁白播完才能操作。開場用一句話說明要幫誰；每個可操作狀態用一句話說清楚「抓哪個物件、往哪裡移、是否要放開或停一下」。語音與主要畫面提示取自同一份 `domain/narration.ts`。
- 說明自由選擇時不能暗示只有示範的那個物件能選。左右鏡像優先說「沿著箭頭」，有不同來源／目的地或不同車種時依目前 domain 狀態選句，不能從階段名稱猜車種。
- 成功只對已提交的結果發聲，例如真的放好材料、門已開到底、裝載動畫完成。游標靠近、取消、每幀重畫及重載快照都不是成功事件；一般計數仍可維持視覺呈現，不必逐幀朗讀。
- 每個階段必須列入 `cues`，以 `satisfies Record<Stage, readonly Id[]>` 檢查。空陣列明確表示自動進出場／動畫交接期間保持安靜，等到下一個可操作提示；若該動畫本身有必要回饋，另列成功 `events`。不要為每個短動畫堆積待播句子。
- 同一時刻只播一段。介紹或短成功回饋可跨自動交接念完，後面只接最新操作；孩子開始新操作就丟棄過時的介紹／回饋。靜音、背景與離頁期間不累積成功訊息，回來只說目前可做的事。
- 喇叭按鈕至少 44×44，沿用共用音效偏好；按喇叭會開啟聲音並重播目前提示。缺檔、解碼失敗、自動播放受阻都不可卡住任務。一般自動交接沒有提示時，不重播上一個已完成的指令。
- 主要操作文案由語音資料提供；額外計數、對準輪廓及自動動畫文字可以保留，但不能把新的必要操作只寫在未配音的輔助文字裡。

## 製作與接續補錄

沿用 Gemini `gemini-3.8-flash-tts`、`Sulafat`、臺灣華語、溫柔成人聲線與三至五歲幼兒語氣。配音指令共用 [voice-script.ts](../src/runtime/voice-script.ts)；消防保留原「幼兒消防遊戲」背景，其餘關卡使用「幼兒城市遊戲」，其餘語氣指令相同。消防既有來源雜湊保持不變。

Key 放在本機 `.env.local` 的 `GEMINI_API_KEY`，不使用 `VITE_` 前綴，不提交、不放入前端或 CI。額度可用後執行：

```sh
npm run voice:generate -- all
```

指令依序補缺少或來源已過期的條目，每次通過即保存；每日額度耗盡就停止，下一次重跑跳過完成項目。不會排程自動呼叫 API，免費額度可能需要分多日補齊。可以限定關卡／句子：

```sh
npm run voice:generate -- road-repair
npm run voice:generate -- road-repair haul
npm run voice:generate -- road-repair haul --regenerate
npm run voice:generate:fire -- stretcher
```

指定句子會重用相同來源／音檔雜湊的錄音或候選，並重新做獨立轉錄；真的需要重新合成時用 `--regenerate`。它只對指定範圍生效。候選與每次原始轉錄保存在 `output/voice-candidates/<mission>/`，不通過就不加入正式 manifest。不要手改逐字稿或雜湊以繞過核對。

錄音後用獨立 `gemini-3.1-flash-lite` 只聽音檔轉錄：提供一般幼兒遊戲背景與繁體逐字稿要求，**不提供原台詞、cue 名稱、讀音提示或期待答案**。最多核對兩次，不一致即保留候選供判讀；只忽略標點、空白與 Unicode NFC 差異，不修正繁簡、同音字或語助詞。必要時可明確指定 `VOICE_REVIEW_PROVIDER=openai`，沿用本機 `OPENAI_API_KEY` 的 `gpt-transcribe` 複核；不自動換服務。配音仍是 Gemini。

正式紀錄位於各關 `voice-assets.json`，包含台詞雜湊、配音設定及 cue 的 `sourceHash`、音檔 `audioHash`，以及綁定來源與音檔的獨立轉錄證據。音檔放在 `public/voice/<mission>/<id>.<hash>.wav`，正式 PWA 預快取 WAV。重用相同台詞的錄音會驗證原設定、台詞、轉錄與實際 bytes，再記錄重用來源；不因換了事件對應就聲稱重新錄製。

ASR 輔助核對內容，不保證口音、聲調、音量或幼兒理解度。補錄完成後仍需實際試聽代表句、長句、多音字及短成功回饋，並驗證瀏覽器與離線播放。

## Effect 與驗證入口

修路與蓋房子由 [voice-controls.ts](../src/runtime/voice-controls.ts) 用 `Effect.acquireRelease` 取得單一播放器；[mission-narration.ts](../src/runtime/mission-narration.ts) 選取目前提示及一次性事件，沿用消防的 [narration.ts](../src/runtime/narration.ts) 播放與獨立清理。DOM listener 沿用 connection 的 AbortSignal；不另開 timer／Fiber，不改存檔 Schema。重玩與開發重設走 `restart`，狀態推進走 `update`，不能把載入快照當作進度變化。

`npm run voice:check` 只做本機核對：全部註冊 ID、台詞／設定／cue／WAV 雜湊、路徑、檔名與轉錄紀錄。CI 的 `npm run check` 先跑它，**不連 API、不生成、不自動更新 manifest、不需秘密金鑰**。新增語音關卡必須同步登記 registry、manifest 與適用的測試入口。沒有錄音時不可放寬檢查或把空 manifest 當通過。

- [關卡 cue 測試](../src/missions/narration.test.ts)：修路與蓋房子階段、拖曳／點選及帶貨提示、重載與已提交成功條件。
- [共用控制器測試](../src/runtime/mission-narration.test.ts)：介紹交接、最新提示、單次回饋、手勢打斷、靜音／背景／重載／缺檔及晚到結果。
- [共用 lifecycle](../src/missions/lifecycle.test.ts)／[修路 lifecycle](../src/missions/road-repair/lifecycle.test.ts)：部分初始化、取消與 frame 故障後釋放語音。
- [離線雜湊測試](../scripts/voice-assets.test.mjs)：台詞、設定、bytes、缺檔、跨關路徑與過期／提供答案的轉錄紀錄不得通過。
- [瀏覽器 CI](../tests/e2e/narration.spec.mjs) 與既有 fire spec：各關重播、靜音與離場；[PWA](../tests/e2e/pwa.spec.mjs) 對消防、修路與蓋房子核對未開啟關卡的離線播放。登記不等於已執行，實際結果另記。

## 新增關卡必做

1. 提案先列介紹、所有必要操作、自由選擇、完成回饋及明確保持安靜的自動階段；填入[關卡設計清單](mission-design.md#每個新關卡提案必填)。
2. 建立純資料 `domain/narration.ts`：`lines`、完整階段 `cues`、成功 `events`、`initial`、`interacting`、`instruction`、`feedback`，需要時加多音字 `pronunciation`。
3. 由 session 取得 scoped voice controls，接上所有狀態推進、手勢解鎖、音效偏好、重播、重玩、開發重設；一般畫面提示與配音共用台詞。介紹只在新局播，續玩不重播歷史成功。
4. 加入 [voice-registry.mjs](../scripts/voice-registry.mjs) 及各關 manifest；不要只新增 WAV 而漏掉來源、觸發對應與轉錄核對。
5. 補錄、獨立轉錄、試聽，執行 `voice:check`、相關 cue／controller／lifecycle 測試與建置。新增或更改條件、配置、對象時檢查 cue 是否仍符合情境；雜湊無法理解未反映在 cue 資料裡的玩法語意變動。
6. 登記並實際驗證桌面／手機的重播、取消、續玩、快速換關與正式離線播放；寫清楚已執行範圍與待補驗項目，再宣告語音完成。


## 2026-11-09 修路配音與驗證

使用者另授權最多 10 次額度，改詞試錄以選出可用的裝車成功回饋。本輪實際生成 2 次：第一句「舊路面放進車子裡了！」的獨立轉錄為「九露面放進車子裡囉／九路面放進車子裡嘍」，未放行；第二句「成功了！」第一次轉錄即通過，正式音檔 1.72 秒。配音維持 `gemini-3.8-flash-tts`／`Sulafat` 與共用指令，移除不再適用的「放好囉」個別讀音提示。ASR 仍是 `gemini-3.1-flash-lite`，沒有提供原句或修改核對規則。剩下 8 次授權額度未使用。

原「放好囉！」候選保存在 `output/voice-candidates/road-repair/archive-2026-11-09-fourth-pass/`；本輪第一句在 `archive-2026-11-09-rephrase-01/`，都保留來源、生成及原始轉錄。採用的 `loaded` 是「成功了！」，只在舊路面確實裝車完成後觸發；台詞、讀音設定、來源與音檔雜湊及獨立轉錄證據已同步更新。既有 12 句不重錄、不更改核對證據。

以 `41c5bbd` 為基準整理修路單關提交，包含修路 13 句、共用 scoped 語音控制器、修路 cue／事件、重播與音效偏好、獨立轉錄與離線雜湊核對，另保留已發布的消防 19 句。其他八關的擴充與不完整資產留在工作區。提交版本的 `npm run check` 通過：32 句離線核對（13 ms）、816 tests／816 pass／0 fail、TypeScript 與正式 build；入口 `index-CTNvdV12.js`，預快取 100 項、7037.49 KiB，32 個 WAV 全數列入。narration／PWA CI 測試語法通過；本機未啟動 Playwright。

Codex 內建瀏覽器在正式 preview `127.0.0.1:4177` 驗證新版入口、介紹重播 `playing`、鍵盤挖起／裝車，以及完成時出現「成功了！」後切回挖土提示。首次開頁沿用舊 worker；關閉舊頁再開啟後正常換成新版。停止 preview 伺服器後重載仍保留已裝車進度，提示重播為 `playing`，並能繼續挖起、裝入下一塊。靜音為 `muted`，離場後零 canvas，無 console warning／error。工具在第二次裝車的短回饋觀測時逾時，因此沒有聲稱已捕捉該句與 `playing` 同時存在的離線畫面；成功事件及播放排程另由 Node 測試核對。

限制：本次未重跑整關通關、手機／真實觸控硬體、Safari 媒體政策或人工口音試聽。本次沒有改相機、模型、動線或四邊裁切，新增按鈕沿用 44×44 規格。ASR 與 `playing` 狀態不等同人工聽感驗收。

## 2026-11-11 補齊蓋房子並獨立提交

蓋房子從 8／10 補齊為 10／10。本日使用 3 次 Gemini TTS：吊鉤取貨一次，以及澆灌兩次；沿用 `gemini-3.8-flash-tts`／`Sulafat` 與共用臺灣華語、溫柔幼兒指令。`pickup`「把吊鉤拖到車上的材料，停一下。」為 4.12 秒；`concrete` 最終採用「拖動出料口，對準光圈，慢慢填滿三個地方。」為 5.40 秒，兩句均通過 `gemini-3.1-flash-lite` 的獨立轉錄。

澆灌增加「出料口」第一聲的個別讀音提示，但第一次原句仍被 Gemini 與 OpenAI 轉錄成「打出料口…」，未採用；改成上述拖動句後重新生成、第一次轉錄即通過。讀音提示只給 TTS，不給 ASR；新的台詞、讀音設定、來源雜湊、WAV 與 review 一起更新。11 月 9 日舊候選與本日第一版分別保留於 `output/voice-candidates/house-build/archive-2026-11-09-concrete/`、`archive-2026-11-11-concrete-first/`，沒有修改原始逐字稿或放寬規則。既有八句保留原 generation／review，材料安裝的「成功了！」仍沿用先前核對的錄音。

以 `e715442` 為基準整理蓋房子單關提交，包含 10 句、純 domain 的 cue／成功事件、connection Scope 播放、重播／靜音，以及台詞／配音設定／音檔雜湊與獨立轉錄證據；消防與修路維持原本的 32 句。其他七關的擴充及不完整資產留在工作區，不混入提交。

與提交相同的獨立檔案樹通過 `npm run check`：42 個語音條目離線核對（22 ms）、818 tests／818 pass／0 fail、TypeScript 與正式 build。入口 `index-Blx0CZJ9.js`，預快取 111 項、8843.12 KiB，包含全部 42 個正式 WAV。narration／PWA CI 入口已加入蓋房子並通過語法核對；本機依專案規定未執行 Playwright。

Codex 內建瀏覽器在 Vite `127.0.0.1:5186` 驗證新的澆灌句與吊鉤取貨句重播為 `playing`，靜音為 `muted`，由澆灌切到吊裝後提示正確；390×844 手機的重播按鈕為 44×44 且在畫面內。原 5175 來源載入舊快取，因此改用乾淨測試來源，沒有刪除原來源資料，也沒有把舊畫面當成新版本結果。正式 preview `127.0.0.1:4178` 的 DOM 入口與上述 build 相符，介紹可重播；停止該 preview 伺服器後重載，保留砂石階段並播放先前未播放的操作提示，狀態 `playing`，靜音為 `muted`。開發及正式頁離場後皆零 canvas、無 console warning／error；測試尺寸已還原，測試服務已停止。

限制：本次沒有重跑整關通關、全部房型／配置、快速換關矩陣、四個手動故障入口、實機觸控／喇叭、Safari 媒體政策、PWA 更新生命週期或人工口音試聽。開發跳階不代表完整通關，ASR 與 `playing` 不等同人耳驗收。相機、模型、動線及上／下／左／右裁切未改，桌面與手機主體大小沿用原設計。
