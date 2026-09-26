# Town Crew 建模清單

盤點日期：2026-09-26。範圍為目前五個 Web 關卡的程序化 3D 模型、主要道具與場景物件。
Rust／Bevy 歷史版本不作為現行模型來源。模型由 Three.js 程式建立，沒有集中存放的外部模型檔。

**新增關卡或物件前，先查本清單，再搜尋原始碼。**
尚未抽成共用函式的物件也屬於既有模型；不少模型直接寫在各關卡的 `scene.ts` 中。
清單沒列出不代表不存在，必須連同場景程式一起確認。

## 新增或修改模型的流程

1. 把新玩法需要的車輛、人物、道具與場景物件逐項對照本清單，標出「沿用、既有變體、新增」。
2. 搜尋中英文名稱與程式識別字，範圍包含 `src/runtime/`、各關卡的 `vehicles.ts`、`scene.ts` 及圖示程式。
   例如查交通錐：`rg -n -i 'cone|traffic-cone|交通錐' src README.md PROJECT_PLAN.md docs`。
3. 閱讀既有模型的實作與使用位置，查看原關卡畫面，確認外形、配色、比例、朝向、活動零件和互動範圍。
   只讀關卡玩法說明或只查共用目錄，都不足以完成這一步。
4. 已有相同物件時沿用原實作。第二個關卡需要它時，可抽出純渲染的共用建構函式，保留既有外觀；
   關卡狀態、操作流程與存檔規則仍留在各關卡。不要另畫一個近似版本代替沿用。
5. 若玩法確實需要模型變體，記錄具體差異，例如警車的警示燈、事故車的損傷和可變車色。
   「已存在但未共用」與「不存在」要分開記錄，避免把同類物件誤列為全新資產。
6. 新增、搬移或修改模型時，同步更新本清單的來源、使用關卡與共用狀態。
   抽取共用模型後，對照原關卡與新關卡畫面；涉及活動零件或操作範圍時，再跑相關瀏覽器流程。

## 已共用的模型與基礎

| 模型 | 來源／入口 | 使用位置 | 保留特徵與注意事項 |
| --- | --- | --- | --- |
| 交通錐 | [traffic-cone.ts](../src/runtime/traffic-cone.ts) · `createTrafficCone` | 修馬路、交通救援 | 原修馬路模型；方形底座、漸縮中空錐身、開口頂緣、深色內壁與白色反光環。兩關直接呼叫同一函式，維持原尺寸與配色。 |
| 救援車底盤與駕駛室 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `chassis` | 消防車、雲梯車、救護車、拖吊車、清掃車 | 四輪、車窗、後視鏡、警示燈、位移帶動的車輪；上裝由各車型建立。不能因此視為所有工程車底盤都已統一。 |
| 救護車 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createAmbulance` | 消防救援、交通救援 | 奶油白車身、綠色條紋、可開合後門與中空後艙，擔架可實際進入。 |
| 擔架 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createStretcher` | 消防救援、交通救援 | 有輪底架、床墊、枕頭、護欄與乘員／毯子顯示狀態。 |
| 居民與制服人物 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson`、`createOfficer` | 消防救援、交通救援、警察隊 | 共用人物輪廓及可動手臂；警員制服由共用函式設定，救護員由交通場景設定。蓋房子的住戶另有實作。 |
| 天然大石頭 | [rocks.ts](../src/runtime/rocks.ts) · `createBoulder` | 保留供山路等未來關卡使用 | 原修馬路的十二面體大石頭；保留半徑 0.57、原灰褐色材質及旋轉變體。可傳入 0.38 產生原小石頭尺寸。現在市區修路不再擺放天然巨石，模型仍可直接匯入。 |
| 破損瀝青路面塊 | [rocks.ts](../src/runtime/rocks.ts) · `createAsphaltChunk` | 修馬路的待挖區、挖斗及清運車載料 | 新增扁平不規則路面塊，深灰瀝青表面、淺灰碎料斷面與裂紋；與天然石頭是不同模型，不覆蓋原模型。 |
| 修路傾卸車 | [dump-truck.ts](../src/runtime/dump-truck.ts) · `createDumpTruck` | 修馬路的運料車、清運車 | 從原修路場景抽取，保留四輪、後鉸鏈車斗、車斗前端抓取點與原運料車配色。清運變體採綠色車頭、棕色空斗，由關卡加入舊路面載料及設定 0.72 倍大小。 |
| 基本形體、車輪與材質 | [geometry.ts](../src/runtime/geometry.ts) · `createShapes` | 五關 | `box`、`cylinder`、`wheel`、`material` 與透明 `hitbox`。共用基本形體不代表完整物件已共用。 |

## 車輛

| 車輛 | 來源／搜尋入口 | 使用關卡 | 目前狀態與特色 |
| --- | --- | --- | --- |
| 挖土機 | [road-repair/vehicles.ts](../src/missions/road-repair/vehicles.ts) · `createExcavatorVisual` | 修馬路 | 關卡內模型；履帶、固定長度機臂、挖斗與挖取舊路面／裝車的顯示。含修路幾何規則依賴，抽取時需分離。 |
| 運料車／清運車 | [dump-truck.ts](../src/runtime/dump-truck.ts) · `createDumpTruck` | 修馬路 | 共用原修路傾卸車的整車結構；兩種配色區分送入新料與載走舊料。載貨狀態與出料粒子仍由關卡控制。 |
| 壓路機 | [road-repair/vehicles.ts](../src/missions/road-repair/vehicles.ts) · `createRollerVisual` | 修馬路 | 關卡內模型；車身及隨位移轉動的滾筒。 |
| 通行小客車 | [road-repair/vehicles.ts](../src/missions/road-repair/vehicles.ts) · `createCarVisual` | 修馬路 | 關卡內模型；完工後通行。與交通救援的小客車目前是不同實作。 |
| 砂石車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createDump` | 蓋房子 | 關卡內模型；使用蓋房子自己的底盤、活動車斗與載料。與修馬路砂石車尚未共用整車。 |
| 水泥車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createMixer` | 蓋房子 | 旋轉攪拌筒與螺旋條紋；出料槽及水泥流在該關 `scene.ts`。 |
| 材料平板車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createFlatbed` | 蓋房子 | 材料運送車與三層貨物顯示；與交通救援的可傾斜拖吊平板車是不同用途及實作。 |
| 吊車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createCrane` | 蓋房子 | 伸縮吊臂、吊索、吊鉤及可收回支撐腳。 |
| 消防車 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createEngine` | 消防救援 | 共用救援底盤，上裝含器材艙、水管捲盤及可瞄準水砲。 |
| 雲梯車 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createLadder` | 消防救援 | 共用救援底盤；梯架、工作籃、噴嘴、支撐腳與工作籃互動範圍。 |
| 救護車 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createAmbulance` | 消防救援、交通救援 | 已共用，詳見上表。 |
| 事故／通行小客車 | [car.ts](../src/runtime/car.ts) · `createCar` | 交通救援、警察隊 | 已抽為共用；保留可變車色、雙黃燈、損傷與車輪轉動，尚未與修路小客車整合。 |
| 警車 | [car.ts](../src/runtime/car.ts) · `createCar(shapes, true)` | 交通救援、警察隊 | 原交通小客車變體，保留警示燈、藍色車身條紋與徽章。 |
| 平板拖吊車 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createTowTruck` | 交通救援 | 共用救援底盤；保留原可傾斜平板、斜板、絞盤與固定帶。左右進場共用同一模型並旋轉朝向；掛鉤、鋼索在場景內，裝載位置與角度見 `domain/towing.ts`。 |
| 吊掛拖吊車 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createWheelLiftTruck`、`createWheelYoke` | 交通救援 | 沿用救援底盤與平板拖吊車配色；新增低器材車體、後吊臂、液壓桿、吊索與托輪架。托起前輪，後輪接地；不是蓋房子吊車的整車複製。 |
| 道路清掃車 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createSweeper` | 交通救援 | 共用救援底盤；集塵箱、進氣格柵、兩個旋轉圓刷及底部吸入口。 |

## 人物、道具與場景內物件

下列「場景內」項目已經存在，即使沒有可直接匯入的 `create…` 函式，也應先閱讀並評估沿用。

| 物件 | 來源／搜尋入口 | 使用關卡 | 目前狀態 |
| --- | --- | --- | --- |
| 居民、消防員、警員、救護員 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson`；制服變體見 [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) | 消防救援、交通救援、警察隊 | 人物基礎已共用，警員變體已抽為 `createOfficer`，保留原制服配色；其餘制服由場景設定。 |
| 蓋房子住戶與小孩 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `residents` | 蓋房子 | 場景內獨立人物模型，含成人與縮小的孩子；與共用人物尚未整合。 |
| 小貓 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createCat` | 消防救援 | 耳朵、眼睛、腳及可動尾巴。 |
| 交通錐 | [traffic-cone.ts](../src/runtime/traffic-cone.ts) · `createTrafficCone` | 修馬路、交通救援 | 已共用；原本直接寫在修路場景，第四關開發時抽出。 |
| 可移動路障 | [road-repair/scene.ts](../src/missions/road-repair/scene.ts) · `barriers` | 修馬路 | 場景內建立，配合進出場規則移開及關閉。 |
| 天然岩石／破損路面 | [rocks.ts](../src/runtime/rocks.ts) · `createBoulder`、`createAsphaltChunk` | 共用模型庫／修馬路 | 原天然石頭已獨立保留；市區第一關使用扁平路面塊，裝入清運車，不再堆在路旁。詳見共用模型表。 |
| 消防栓、水管接頭、水管 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `hydrant`、`connector`、`hose` | 消防救援 | 場景內模型；消防栓是真實接管目標，水管按曲線更新。 |
| 雲梯工作籃 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createLadder` 的 `basket` | 消防救援 | 雲梯車組件，包含護欄、噴嘴與互動範圍。 |
| 擔架與乘員 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createStretcher` | 消防救援、交通救援 | 已共用；乘員顯示和空擔架由同一模型切換。 |
| 絞盤掛鉤與鋼索 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `hook`、`cable` | 交通救援 | 場景內可拖道具；掛鉤使用彎曲管狀幾何。 |
| 托輪架 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createWheelYoke` | 交通救援 | 兩個輪胎托座與橫桿；可拖工具和車尾固定托架使用同一建構函式。前輪對齊托座，後輪接地的幾何規則在 [domain/towing.ts](../src/missions/traffic-rescue/domain/towing.ts)。 |
| 警員相機 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `cameraProp`、`flash` | 交通救援 | 場景內道具，掛在警員身上。 |
| 水泥出料槽及出口 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `chute`、`chuteTip` | 蓋房子 | 場景內可拖道具，與地面澆灌分區對準。 |
| 兩層樓組件 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `part`、`parts`、`ghosts` | 蓋房子 | 四組 L 形牆板、一塊樓板、一個屋頂；含門窗、屋簷與半透明安裝輪廓。 |
| 房屋地基、砂石及水泥面 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `gravelFill`、`stones`、`slabs`、`completeSlab` | 蓋房子 | 場景內分區表面及填料模型。 |
| 道路坑洞、填料、修補面 | [road-repair/scene.ts](../src/missions/road-repair/scene.ts) · `pit`、`fill`、`fillStones`、`asphalt`、`repairedRoad` | 修馬路 | 場景內道路施工模型。 |
| 事故碎片 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `debris` | 交通救援 | 場景內九組碎片，每組有三片；依清掃進度移除。 |
| 救援建築、陽台與屋頂平台 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `awning`、`balcony`、`second-floor-rescue-balcony` | 消防救援 | 場景內兩層建築及不同高度的救援位置。 |
| 道路、標線、路緣、人行道 | 各關 `scene.ts`：[修馬路](../src/missions/road-repair/scene.ts)、[蓋房子](../src/missions/house-build/scene.ts)、[消防](../src/missions/fire-rescue/scene.ts)、[交通](../src/missions/traffic-rescue/scene.ts) | 五關 | 分別建模，尺寸與車道安排由關卡需求決定；尚未共用完整場景模組。 |
| 樹木與背景建築 | 各關 `scene.ts`，搜尋 `IcosahedronGeometry`、`crown` 或背景房屋的 `box` 區段 | 五關 | 多個場景內實作；已有造型參考，不能當作尚未建模。 |
| 工地圍欄 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `Fences stay behind the site` 區段 | 蓋房子 | 場景內模型，位於施工區後方。 |
| 長椅 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts)、[town-scenery.ts](../src/runtime/town-scenery.ts) | 消防救援、交通救援、警察隊 | 交通原版已抽為 `createTownBench`，與警察關卡共用；消防版本尺寸不同，仍獨立。 |

## 特效與 2D 圖像

| 類型 | 現有來源 | 注意事項 |
| --- | --- | --- |
| 火苗、水柱、水滴、蒸氣及水漬 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `flameGroups`、`water`、`droplets`、`steam` | 由幾何與材質建立的動態效果，不是外部素材。 |
| 倒料／澆灌粒子、掃地揚塵、完工紙花 | 各關 `scene.ts`，搜尋 `gravel`、`particles`、`stream`、`dust`、`confetti` | 多個場景內實作；依實際共用需求抽取。 |
| 小手拖曳示範 | [drag-hint.ts](../src/runtime/drag-hint.ts) · `createDragHint` | 五關共用 SVG 提示，屬於操作介面；警察關卡可提供轉彎路徑，原四關維持直線示範。 |
| 選關插圖 | [menu.ts](../src/app/menu.ts) 的 `roadArt`、`houseArt`；[fire-art.ts](../src/app/fire-art.ts)；[traffic-art.ts](../src/app/traffic-art.ts) | 手寫 SVG，與 3D 模型分開；外觀有辨識性修改時需一起核對。 |
| 車輛圖示、目標光圈及完成畫面插圖 | 各關 `ui.ts` 與 [style.css](../src/style.css) | 介面資產；不能用圖示是否存在判斷 3D 模型是否存在。 |

## 尚未共用的同類模型

目前仍有多份實作的項目包括：修馬路／蓋房子的砂石車、修馬路／交通救援的小客車、
蓋房子住戶／共用居民，以及各場景的樹木、背景建築、長椅與部分特效。
這些是盤點結果，不代表已完成整合，也不要求為了清單一次重構全部模型。
後續任務需要同類物件時，先比較既有版本，選擇來源並記錄沿用或變體的理由。

## 第五關模型沿用與新增（2026-09-26）

| 物件 | 分類與來源 | 保留或新增內容 |
| --- | --- | --- |
| 巡邏警車、犯人小客車 | 沿用／共用：[car.ts](../src/runtime/car.ts) | 原 `traffic-rescue/vehicles.ts` 的 `createCar` 原樣抽出，原關卡保留重新匯出入口。車體、警示燈、徽章、配色與比例不變。 |
| 警員 | 沿用／共用：[emergency-models.ts](../src/runtime/emergency-models.ts) · `createOfficer` | 原交通關卡的人物與制服換色原樣抽出；兩關呼叫同一函式。 |
| 樹木、背景房屋、長椅 | 沿用／共用：[town-scenery.ts](../src/runtime/town-scenery.ts) | 原交通場景三種物件抽出，交通場景保留原位置、幾何、材質與比例。警察關卡將房屋排成四個街角；北側房屋深度為 0.8 倍，前景店面深度為 0.65 倍、高度為 0.58 倍，讓巷道與車輛保持可見。其它關卡的同類模型仍各自存在。 |
| 街道路面與路緣 | 關卡場景：[police-patrol/scene.ts](../src/missions/police-patrol/scene.ts) · `pave` | 外圍道路、中央街道、巷道與警戒灣合併鋪面；各層只有一份不重疊的表面，統一道路底色，避免路口色塊與重疊接縫。 |
| 警用重型機車 | 新增：[police-patrol/vehicles.ts](../src/missions/police-patrol/vehicles.ts) · `createMotorcycle` | 兩輪、前叉、引擎、整流罩、大風鏡、側箱、警示燈、把手及騎警。沿用車輪與制服人物基礎，新增安全帽與乘坐姿勢。兩台以小面積頭盔色標及介面 1／2 區分。 |
| 偵防廂型車 | 新增：同檔 · `createDetectiveVan` | 深藍灰乘用廂型車，長車頭、連續側窗、後窗與尾燈、獨立乘坐艙、座椅、可滑動側門與小型警示燈。車身獨立建構，不採卡車駕駛室。 |
| 一般廂型車 | 既有變體：同檔 · `createDetectiveVan(shapes, false)` | 共用新廂型車車體，取消警徽與警示燈，車身採該局隨機車色。 |
| 犯人 | 既有變體：同檔 · `createSuspect` | 沿用居民基礎，將另一隻手臂改為可動以表現舉手；人物由開場拿包包的行為辨識。 |
| 包包 | 新增：同檔 · `createBag` | 簡單袋身與半圓提把，四種柔和配色。 |
| 警局抵達插圖、車輛圖示、選關卡片 | 新增 SVG：[police-art.ts](../src/app/police-art.ts)、[police-patrol/ui.ts](../src/missions/police-patrol/ui.ts) | 沿用現有手寫 SVG 風格，對應三種勤務車型；警局是完成畫面插圖，未新增獨立 3D 警局。 |

第五關目前以車輛包抄為核心，不新增腳印或人物拖曳玩法。
