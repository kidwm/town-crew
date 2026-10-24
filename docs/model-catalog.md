# Town Crew 建模清單

盤點日期：2026-10-24。範圍為目前九個 Web 關卡的程序化 3D 模型、主要道具與場景物件。
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
| 交通錐 | [traffic-cone.ts](../src/runtime/traffic-cone.ts) · `createTrafficCone` | 修馬路、交通救援 | 原修馬路模型；方形底座、漸縮中空錐身、開口頂緣、深色內壁與白色反光環。兩關直接呼叫同一函式，維持原尺寸與配色。交通關卡落點放在事故區內側，使用真實模型邊界驗證救護車、開啟的後門與清掃車淨空。 |
| 救援車底盤與駕駛室 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `chassis` | 消防車、雲梯車、救護車、拖吊車、清掃車、垃圾車、廚餘車 | 四輪、車窗、後視鏡、警示燈、位移帶動的車輪；上裝由各車型建立。不能因此視為所有工程車底盤都已統一。 |
| 救護車 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createAmbulance` | 消防救援、交通救援 | 奶油白車身、綠色條紋、可開合後門與中空後艙，擔架可實際進入。 |
| 擔架 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createStretcher` | 消防救援、交通救援 | 有輪底架、床墊、枕頭、護欄與乘員／毯子顯示狀態。 |
| 居民與制服人物 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson`、`createOfficer` | 消防救援、交通救援、警察隊、碼頭搬貨、山路搶通、清潔隊 | 共用人物輪廓及可動手臂；警員制服由共用函式設定，救護員由交通場景設定。蓋房子的住戶另有實作。 |
| 天然大石頭 | [rocks.ts](../src/runtime/rocks.ts) · `createBoulder` | 山路搶通／共用模型庫 | 原修馬路的十二面體大石頭；保留半徑 0.57、原灰褐色材質及旋轉變體。可傳入 0.38 產生原小石頭尺寸。現在市區修路不再擺放天然巨石，模型仍可直接匯入。 |
| 破損瀝青路面塊 | [rocks.ts](../src/runtime/rocks.ts) · `createAsphaltChunk` | 修馬路的待挖區、挖斗及清運車載料 | 新增扁平不規則路面塊，深灰瀝青表面、淺灰碎料斷面與裂紋；與天然石頭是不同模型，不覆蓋原模型。 |
| 修路傾卸車 | [dump-truck.ts](../src/runtime/dump-truck.ts) · `createDumpTruck` | 修馬路的運料車、清運車及山路清運車 | 從原修路場景抽取，保留四輪、後鉸鏈車斗、車斗前端抓取點與原運料車配色。清運變體採綠色車頭、棕色空斗；修馬路加入舊路面載料並設為 0.72 倍，山路採整車原尺寸。 |
| 工程底盤、材料平板車與吊車 | [construction-models.ts](../src/runtime/construction-models.ts) · `createConstructionChassis`、`createFlatbed`、`createCrane` | 蓋房子、碼頭搬貨、清潔隊 | 原蓋房子模型抽出，保留材質、幾何、六輪平板車、四輪吊車、支撐腳及吊索。`createFlatbed` 預設保留原三層材料面板；碼頭傳入 `false`，改由關卡顯示棧板貨箱。 |
| 基本形體、車輪與材質 | [geometry.ts](../src/runtime/geometry.ts) · `createShapes` | 九關 | `box`、`cylinder`、`wheel`、`material` 與透明 `hitbox`。共用基本形體不代表完整物件已共用。 |

小貓與小狗也已放入共用 [pets.ts](../src/runtime/pets.ts)，外觀與使用比例見下方人物／道具表。

## 車輛

| 車輛 | 來源／搜尋入口 | 使用關卡 | 目前狀態與特色 |
| --- | --- | --- | --- |
| 小型四輪鏟裝機 | [mountain-clearance/vehicles.ts](../src/missions/mountain-clearance/vehicles.ts) · `createLoader` | 山路搶通 | 2026-10-17 新增短車身、四顆粗胎、深色護框駕駛室、雙側固定長度升降臂、液壓桿與開口翻斗；沿用基本形體、車輪及材質助手。兩趟低位鏟土、低位搬運；先在車尾停妥，另一次向上拖曳抬臂，才自動前進翻斗倒料。 |
| 挖土機 | [excavator-model.ts](../src/runtime/excavator-model.ts) · `createExcavatorModel` | 修馬路、山路搶通 | 原修路履帶、駕駛室、固定長度機臂與挖斗原樣抽出；`excavator-arm.ts` 提供純幾何規則。原 `createExcavatorVisual` 保留路面塊、提示與修路渲染入口。 |
| 運料車／清運車 | [dump-truck.ts](../src/runtime/dump-truck.ts) · `createDumpTruck` | 修馬路、山路搶通 | 共用原修路傾卸車的整車結構；兩種配色區分送入新料與載走舊料。載貨狀態與出料粒子仍由關卡控制。 |
| 壓路機 | [road-repair/vehicles.ts](../src/missions/road-repair/vehicles.ts) · `createRollerVisual` | 修馬路 | 關卡內模型；車身及隨位移轉動的滾筒。 |
| 通行小客車 | [road-repair/vehicles.ts](../src/missions/road-repair/vehicles.ts) · `createCarVisual` | 修馬路 | 關卡內模型；完工後通行。與交通救援的小客車目前是不同實作。 |
| 砂石車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createDump` | 蓋房子 | 關卡內模型；使用蓋房子自己的底盤、活動車斗與載料。與修馬路砂石車尚未共用整車。 |
| 水泥車 | [house-build/vehicles.ts](../src/missions/house-build/vehicles.ts) · `createMixer` | 蓋房子 | 旋轉攪拌筒與螺旋條紋；出料槽及水泥流在該關 `scene.ts`。 |
| 材料平板車 | [construction-models.ts](../src/runtime/construction-models.ts) · `createFlatbed`；蓋房子保留匯出入口 | 蓋房子、碼頭搬貨、清潔隊 | 原六輪材料運送車與三層貨物顯示；碼頭沿用整車與空平板變體，載入兩個棧板貨箱。與交通救援可傾斜拖吊平板車用途及實作不同。 |
| 吊車 | [construction-models.ts](../src/runtime/construction-models.ts) · `createCrane`；蓋房子保留匯出入口 | 蓋房子、碼頭搬貨、清潔隊 | 原黃色吊車，保留伸縮吊臂、吊索、吊鉤與可收回支撐腳；兩關共用實際吊鉤的投影與直徑 96 px 抓取區，採拖空鉤取貨、拖吊鉤或懸吊物放貨；碼頭用同一吊車卸船／裝船，不新增另一台近似吊車。 |
| 消防車 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createEngine` | 消防救援 | 共用救援底盤，上裝含器材艙、水管捲盤及可瞄準水砲。 |
| 雲梯車 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createLadder` | 消防救援 | 共用救援底盤；梯架、工作籃、噴嘴、支撐腳與工作籃互動範圍。 |
| 救護車 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createAmbulance` | 消防救援、交通救援 | 已共用，詳見上表。 |
| 事故／通行／家庭小客車 | [car.ts](../src/runtime/car.ts) · `createCar` | 交通救援、警察隊、蓋房子 | 共用可變車色、雙黃燈、損傷與車輪轉動；蓋房子使用 `openingDoors` 選項，增加中空乘坐艙、透明車窗及四片可開合車門，比例 0.82。預設交通／警察外觀保留。尚未與修路小客車整合。 |
| 警車 | [car.ts](../src/runtime/car.ts) · `createCar(shapes, true)` | 交通救援、警察隊 | 原交通小客車變體，保留警示燈、藍色車身條紋與徽章。 |
| 平板拖吊車 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createTowTruck` | 交通救援 | 共用救援底盤；保留原可傾斜平板、斜板、絞盤與固定帶。左右進場共用同一模型並旋轉朝向；掛鉤、鋼索在場景內，裝載位置與角度見 `domain/towing.ts`。 |
| 吊掛拖吊車 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createWheelLiftTruck`、`createWheelYoke` | 交通救援 | 沿用救援底盤與平板拖吊車配色；新增低器材車體、後吊臂、液壓桿、吊索與托輪架。托起前輪，後輪接地；不是蓋房子吊車的整車複製。 |
| 道路清掃車 | [sweeper.ts](../src/runtime/sweeper.ts) · `createSweeper`；交通保留重新匯出 | 交通救援、山路搶通、清潔隊 | 共用救援底盤；集塵箱、進氣格柵、兩個旋轉圓刷及底部吸入口。 |

## 人物、道具與場景內物件

下列「場景內」項目已經存在，即使沒有可直接匯入的 `create…` 函式，也應先閱讀並評估沿用。

| 物件 | 來源／搜尋入口 | 使用關卡 | 目前狀態 |
| --- | --- | --- | --- |
| 居民、消防員、警員、救護員 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson`；制服變體見 [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) | 消防救援、交通救援、警察隊 | 人物基礎已共用，警員變體已抽為 `createOfficer`，保留原制服配色；其餘制服由場景設定。 |
| 蓋房子住戶與小孩 | [resident.ts](../src/runtime/resident.ts) · `createResident`；[house-build/residents.ts](../src/missions/house-build/residents.ts) 保留家庭組合與動畫 | 蓋房子、乘客轉運站、清潔隊 | 原住戶模型原樣抽出，保留身體、頭部、可動腿、手臂及預設四組配色。轉運站加學童背包、旅客帽子及服裝變體。與救援共用人物仍為不同實作。 |
| 小貓 | [pets.ts](../src/runtime/pets.ts) · `createCat` | 消防救援、蓋房子 | 從消防原實作原樣抽出，共用耳朵、眼睛、腳及可動尾巴；消防保留原匯出入口與 1.2 倍比例，蓋房子採 0.8 倍。 |
| 小狗 | [pets.ts](../src/runtime/pets.ts) · `createDog` | 蓋房子 | 新增共用模型：垂耳、口鼻、四腳、項圈及可動尾巴；蓋房子採 0.85 倍。 |
| 交通錐 | [traffic-cone.ts](../src/runtime/traffic-cone.ts) · `createTrafficCone` | 修馬路、交通救援、山路搶通 | 已共用；原本直接寫在修路場景，第四關開發時抽出。 |
| 可移動路障 | [road-barrier.ts](../src/runtime/road-barrier.ts) · `createRoadBarrier` | 修馬路、山路搶通 | 原修路路障抽為共用純模型，保留幾何、尺寸及配色；開閉／撤除仍由各關控制。 |
| 天然岩石／破損路面 | [rocks.ts](../src/runtime/rocks.ts) · `createBoulder`、`createAsphaltChunk` | 共用模型庫／修馬路 | 原天然石頭已獨立保留；市區第一關使用扁平路面塊，裝入清運車，不再堆在路旁。詳見共用模型表。 |
| 消防栓、水管接頭、水管 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `hydrant`、`connector`、`hose` | 消防救援 | 場景內模型；消防栓是真實接管目標，水管按曲線更新。 |
| 雲梯工作籃 | [fire-rescue/vehicles.ts](../src/missions/fire-rescue/vehicles.ts) · `createLadder` 的 `basket` | 消防救援 | 雲梯車組件，包含護欄、噴嘴與互動範圍。 |
| 擔架與乘員 | [emergency-models.ts](../src/runtime/emergency-models.ts) · `createStretcher` | 消防救援、交通救援 | 已共用；乘員顯示和空擔架由同一模型切換。 |
| 絞盤掛鉤與鋼索 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `hook`、`cable` | 交通救援 | 場景內可拖道具；掛鉤使用彎曲管狀幾何。 |
| 托輪架 | [traffic-rescue/vehicles.ts](../src/missions/traffic-rescue/vehicles.ts) · `createWheelYoke` | 交通救援 | 兩個輪胎托座與橫桿；可拖工具和車尾固定托架使用同一建構函式。前輪對齊托座，後輪接地的幾何規則在 [domain/towing.ts](../src/missions/traffic-rescue/domain/towing.ts)。 |
| 警員相機 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `cameraProp`、`flash` | 交通救援 | 場景內道具，掛在警員身上。 |
| 水泥出料槽及出口 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `chute`、`chuteTip` | 蓋房子 | 場景內可拖道具，與地面澆灌分區對準。 |
| 兩層樓組件 | [house-build/house-model.ts](../src/missions/house-build/house-model.ts) · `createHouseParts` | 蓋房子 | 沿用四組 L 形牆板、一塊樓板；屋頂有尖頂、單斜頂、平頂變體，搭配窗格／比例及四組牆面門窗色。實體與半透明輪廓共用幾何；屋頂色由本局配色決定。 |
| 房屋地基、砂石及水泥面 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `gravelFill`、`stones`、`slabs`、`completeSlab` | 蓋房子 | 場景內分區表面及填料模型。 |
| 開放式單車庫、車道與步道 | [house-build/garage.ts](../src/missions/house-build/garage.ts) · `createGarage` | 蓋房子 | 新增地基、側牆、後牆、柱子與平屋頂，面向主屋的一側採矮牆；配色沿用房屋，只在車輛離場後、下一台進場前的交接空檔成形。入口敞開，容納共用小客車、車門及下車空間；路線在 [arrival.ts](../src/missions/house-build/domain/arrival.ts)。 |
| 道路坑洞、填料、修補面 | [road-repair/road-surface.ts](../src/missions/road-repair/road-surface.ts) · `createRepairSurface` | 修馬路 | 三種破損配置各自共用坑洞、填料及修補面輪廓；整組隨工地換邊。路面塊沿用 `createAsphaltChunk`，依配置調整比例與角度，車斗保留每塊外觀及裝入順序。 |
| 事故碎片 | [traffic-rescue/scene.ts](../src/missions/traffic-rescue/scene.ts) · `debris` | 交通救援 | 場景內九組碎片，每組有三片；依清掃進度移除。 |
| 救援建築、陽台與屋頂平台 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `awning`、`balcony`、`second-floor-rescue-balcony` | 消防救援 | 場景內兩層建築及不同高度的救援位置。 |
| 道路、標線、路緣、人行道 | 各關 `scene.ts`：[修馬路](../src/missions/road-repair/scene.ts)、[蓋房子](../src/missions/house-build/scene.ts)、[消防](../src/missions/fire-rescue/scene.ts)、[交通](../src/missions/traffic-rescue/scene.ts) | 九關 | 分別建模，尺寸與車道安排由關卡需求決定；尚未共用完整場景模組。 |
| 樹木與背景建築 | 各關 `scene.ts`，搜尋 `IcosahedronGeometry`、`crown` 或背景房屋的 `box` 區段 | 九關 | 多個場景內實作；已有造型參考，不能當作尚未建模。 |
| 工地圍欄 | [house-build/scene.ts](../src/missions/house-build/scene.ts) · `Fences stay behind the site` 區段 | 蓋房子 | 場景內模型，位於施工區後方。 |
| 長椅 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts)、[town-scenery.ts](../src/runtime/town-scenery.ts) | 消防救援、交通救援、警察隊 | 交通原版已抽為 `createTownBench`，與警察關卡共用；消防版本尺寸不同，仍獨立。 |

## 特效與 2D 圖像

| 類型 | 現有來源 | 注意事項 |
| --- | --- | --- |
| 火苗、水柱、水滴、蒸氣及水漬 | [fire-rescue/scene.ts](../src/missions/fire-rescue/scene.ts) · `flameGroups`、`water`、`droplets`、`steam` | 由幾何與材質建立的動態效果，不是外部素材。 |
| 倒料／澆灌粒子、掃地揚塵、完工紙花 | 各關 `scene.ts`，搜尋 `gravel`、`particles`、`stream`、`dust`、`confetti` | 多個場景內實作；依實際共用需求抽取。 |
| 小手拖曳示範 | [drag-hint.ts](../src/runtime/drag-hint.ts) · `createDragHint` | 九關共用 SVG 提示，屬於操作介面；警察關卡可提供轉彎路徑，原四關維持直線示範。 |
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

## 第六關模型沿用與新增（2026-10-03）

| 物件 | 分類與來源 | 保留或新增內容 |
| --- | --- | --- |
| 黃色吊車、綠色材料平板車 | 沿用／共用：[construction-models.ts](../src/runtime/construction-models.ts) | 從蓋房子原模型抽出；原關卡保留 `vehicles.ts` 重新匯出。黃色吊車與六輪平板車的幾何、配色、比例、活動零件、車輛 hitbox 維持原樣；吊車暴露原吊鉤物件供兩關一致抓取。平板車可不建立材料面板，由碼頭顯示兩箱物資。 |
| 工程底盤與連桿助手 | 沿用／共用：同檔 · `createConstructionChassis`、`link` | 原蓋房子車體與連桿計算原樣抽出；蓋房子的砂石車、水泥車仍用相同底盤，未整併救援或修路底盤。 |
| 沿岸小貨船 | 新增：[port-cargo/vehicles.ts](../src/missions/port-cargo/vehicles.ts) · `createCargoBoat`、`cargoBoatOutline` | 低多邊形船殼、尖船艏、開放甲板、側端駕駛艙、窗戶、桅桿與防撞輪胎；四種船色。依運貨方向空船進場或保留可見的兩個甲板貨箱；裝船後載箱離港，不是巨型貨櫃船。靠岸泊位沿用同一船殼輪廓描虛線，到位淡出。 |
| 堆高機 | 新增：同檔 · `createForklift` | 四輪、配重、護頂架、座椅、方向盤、雙立柱升降架與兩支活動貨叉；駕駛沿用制服人物。移動低位叉運；卸船局裝車，裝船局抬高貨叉卸車，同一模型自動升高／插入／退出／降叉。 |
| 棧板物資箱 | 新增：同檔 · `createPalletCargo` | 底部木條與可插入的空隙、貨箱、固定條；四面食物蘋果／玩具積木圖樣，轉向後仍可辨識。船上、懸吊、碼頭、叉上與車上共用同一份模型；卸放時轉向對準側面進叉方向。省略貨物身分時建立無圖樣的半透明落點變體，僅提示下一個卸放位置並隨落地淡出。 |
| 碼頭人員與駕駛 | 沿用／既有變體：[emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson` | 原居民／制服人物與揮手手臂，駕駛以同模型調整顯示比例與位置。未新增另一套人物輪廓。 |
| 背景房屋與樹木 | 沿用：[town-scenery.ts](../src/runtime/town-scenery.ts) | 原交通街景；房屋降低為 0.52 倍高度、0.65 倍寬、0.45 倍深，樹木採 0.65 倍；移到水岸兩端的陸地，讓前方卡車進出、船身與中央工作區保持可見。 |
| 碼頭平台、水面、繫纜柱、防撞墊與繫纜 | 新增：[port-cargo/scene.ts](../src/missions/port-cargo/scene.ts) | 平台、水道及低矮碼頭配件；泊位繫纜接上船側，離港前撤除。取消常駐卸貨方框，改用棧板貨箱落點變體；船形虛線泊位只在靠岸時顯示。水面短波紋單向漂移並淡入淡出，船移動時帶短尾波，停船後逐漸消退。 |
| 吊裝吊帶、提示與紙花 | 沿用形體／效果做法：同檔、[drag-hint.ts](../src/runtime/drag-hint.ts) | 依現有圓柱連桿、小手、光圈及幾何紙花做法，狀態與動線由碼頭獨立控制。 |
| 選關、四種運具圖示與城鎮收貨插圖 | 新增手寫 SVG：[port-art.ts](../src/app/port-art.ts)、[port-cargo/ui.ts](../src/missions/port-cargo/ui.ts) | 沿用柔和配色與既有 UI；進城平板車與對岸貨船兩種收貨動畫共用既有運具 SVG 與城鎮外觀，使用持久化時鐘，不新增另一個 3D 城鎮場景。 |

首版四種運具、兩箱物資；貨櫃堆疊與多目的地留待試玩後再討論。

## 第七關模型沿用與新增（2026-10-09）

| 物件 | 分類與來源 | 保留或新增內容 |
| --- | --- | --- |
| 天然大石頭、小石 | 沿用：[rocks.ts](../src/runtime/rocks.ts) · `createBoulder` | 大石保留原半徑 0.57、十二面體、灰褐色材質與旋轉變體。地面、挖斗、車斗使用同一模型；細石使用同函式的小半徑參數，裝車順序保留身分。 |
| 挖土機 | 沿用／抽為共用：[excavator-model.ts](../src/runtime/excavator-model.ts) · `createExcavatorModel` | 原修路模型原樣抽出，履帶、車身、機臂、液壓桿、挖斗及透明抓取範圍不變；原關卡保留 `createExcavatorVisual` 的貨物及畫面規則。 |
| 固定長度機臂幾何 | 共用純 TypeScript：[excavator-arm.ts](../src/runtime/excavator-arm.ts) | 原 3.6／4 長度、樞紐與逆運動學原樣抽出，可指定樞紐；不依賴 Three.js、儲存或關卡狀態。 |
| 綠色清運砂石車 | 沿用：[dump-truck.ts](../src/runtime/dump-truck.ts) · `createDumpTruck(shapes, true)` | 保留原四輪綠色車頭、棕色車斗、底盤長度與後鉸鏈，不加長車斗。先放兩塊底石、第三塊搭在中間，再由鏟裝機倒入砂土填空隙；大石保留原半徑，砂土不墊高石頭。 |
| 道路清掃車 | 沿用／抽為共用：[sweeper.ts](../src/runtime/sweeper.ts) | 原交通清掃車原樣抽出，駕駛室、集塵箱、通風格柵、雙圓刷、底部吸入口、車輪與配色保留；交通關卡保留重新匯出入口。 |
| 小型四輪鏟裝機（2026-10-17） | 新增：[mountain-clearance/vehicles.ts](../src/missions/mountain-clearance/vehicles.ts) · `createLoader` | 參考小型四輪鏟裝機的短車體、粗胎、護框、雙側升降臂及寬開口鏟斗。沿用 `createShapes` 車輪／材質與液壓連桿助手；升臂與翻斗獨立活動，鏟斗可見載土。與推土機及挖土機為不同車型。 |
| 推土機 | 新增：[mountain-clearance/vehicles.ts](../src/missions/mountain-clearance/vehicles.ts) · `createBulldozer` | 黃色履帶式車體、駕駛室、排氣管、寬刮板、側翼、刃口、推臂與升降液壓桿；依工作／倒退／離場抬降刮板。 |
| 工程隊員、樹木及通行小客車 | 沿用：[emergency-models.ts](../src/runtime/emergency-models.ts)、[town-scenery.ts](../src/runtime/town-scenery.ts)、[car.ts](../src/runtime/car.ts) | 原制服人物與可動揮手手臂、低多邊形樹木及可變車色小客車；小車採 0.72 比例，無新人物輪廓。 |
| 交通錐與路障 | 沿用：[traffic-cone.ts](../src/runtime/traffic-cone.ts)、[mountain-clearance/scene.ts](../src/missions/mountain-clearance/scene.ts) | 交通錐直接匯入；路障原樣抽為 [road-barrier.ts](../src/runtime/road-barrier.ts) 供兩關共用，離場後才移開。 |
| 山坡、護欄、裝車區與土堆 | 新增場景：[mountain-clearance/scene.ts](../src/missions/mountain-clearance/scene.ts) | 綠色低多邊形山坡、灰褐岩壁、低護欄、山側裝車區、兩條橫向車道的土石堆及細砂土殘留；整關固定視角，側面露出刮板與土堆移動，道路前側與護欄留出倒退／換道空間。山側岩石退讓並擴大裝車區供鏟裝機直達車尾裝料；第一趟倒完就近等待下一堆，細砂殘留與已移走的土堆不阻擋動線。既有形體、材質與天然小石組成。 |
| 小手、目標光圈與紙花 | 沿用：[drag-hint.ts](../src/runtime/drag-hint.ts)、山路 `session.ts`／`scene.ts` | 光圈對應真實土堆、大石與車斗；小手、抓取點及左右配置共用同一場景投影。 |
| 選關與五車圖示 | SVG：[mountain-art.ts](../src/app/mountain-art.ts)、[road-vehicle-art.ts](../src/app/road-vehicle-art.ts)、[traffic-vehicle-art.ts](../src/app/traffic-vehicle-art.ts) | 新增山景推土機選關卡片、推土機及小型四輪鏟裝機圖示；原修路／交通車輛圖示原樣抽出供兩關使用，砂石清運圖示將路面塊色換為天然石頭色。 |

2026-10-17 擴充為五車：兩次推土、三次大石裝車、兩次鏟土裝車、一次清運及一次清掃。補路、壓路與倒料場留待試玩後再討論。

## 第八關模型沿用與新增（2026-10-18）

| 物件 | 分類與來源 | 保留或新增內容 |
| --- | --- | --- |
| 計程車 | 既有變體：[car.ts](../src/runtime/car.ts)、[passenger-transfer/vehicles.ts](../src/missions/passenger-transfer/vehicles.ts) · `createTaxi` | 沿用原可開門小客車、透明車窗、中空乘坐艙與四輪，採 1.1 倍；新增黃色配色、車頂燈、棋盤腰線及後座。`openDoors` 新增可選側別與只開後門，預設仍開四門，蓋房子保持原樣。 |
| 公車 | 新增：同檔 · `createBus(shapes, 'bus')` | 平車頭、低乘客艙、連續側窗、寬折門、座椅、中央走道、入口階梯與站牌式車頭／側面識別；四組柔和配色。乘客從實際門洞下車，不採工程卡車底盤。 |
| 校車 | 新增：同檔 · `createBus(shapes, 'school')` | 黃色長車頭、深色腰線、較短客艙、窄折門、階梯與隨開門展開的停車指示臂。與公車／遊覽車共用客艙建構基礎，但車頭、比例及辨識零件不同。 |
| 遊覽車 | 新增：同檔 · `createBus(shapes, 'coach')` | 高客艙、大側窗、乘客前門、下方中空行李艙與可掀側艙門，四組配色。行李平放後進入真正的艙內，旅客走階梯上車。 |
| 行李箱 | 新增：同檔 · `createSuitcase` | 箱體、輪子、伸縮拉桿、提把與行李牌；下車時隨旅客帶到月台，幼兒拖入遊覽車行李艙。自動裝載時轉為平放，保留配色與身分。入艙後以車內固定座標同步車身位置與轉角，連提把都保留在艙內，離站不再偏離車體。 |
| 六位乘客 | 沿用／既有變體：[resident.ts](../src/runtime/resident.ts) · `createResident` | 原蓋房子居民原樣抽出；原身體、頭、活動手臂與雙腿不變。兩位學童縮為 0.72 倍、加背包；居民／旅客採 0.86 倍，旅客加帽子；三種服裝組合。 |
| 站務員 | 沿用：[emergency-models.ts](../src/runtime/emergency-models.ts) · `createPerson(shapes, true)` | 保留原制服人物，校車上客時走到入口引導再回原位，結尾揮手。 |
| 站房、樹木、長椅 | 沿用：[town-scenery.ts](../src/runtime/town-scenery.ts) | 站房以原背景房屋的 1.25 倍寬、0.62 倍高、0.85 倍深變體；原長椅採 0.45 倍，候車亭移至右端，不遮擋候車乘客。 |
| 月台、候車亭、站牌與等候車位 | 關卡既有配件重排：[passenger-transfer/scene.ts](../src/missions/passenger-transfer/scene.ts) | 一條連續低矮月台與三組候車點，右端開放亭、原圖像站牌。前側為獨立計程車停靠彎及大型車停靠彎，中間低矮植栽；後側是校車、遊覽車路邊等候格。道路寬 5 公尺、左進右出，以箭頭代替中央分隔線。鋪面、路徑、停靠位與人行區共用 `domain/terminal.ts` 座標。 |
| 四車圖示、選關插圖 | 新增 SVG：[transfer-art.ts](../src/app/transfer-art.ts) | 沿用手寫 SVG、柔和色彩與既有進度列；圖示對應平頭公車、頂燈計程車、長車頭校車及高客艙遊覽車。 |

首版四車、六位乘客與一只行李，不追加收費或乘客分類操作。
依已確認的單向配置圖重排場地，沿用全部四車、人物、站房、樹木、長椅、候車亭及站牌模型；不新增車種或改造車體。
四車從左側進站、向右離站，校車不再迴轉；校車與遊覽車先駛入後側等候格，再向前靠入大型車彎，計程車在專用彎內接送。
月台改為連續矩形，與兩個柏油停靠彎清楚分離；車輛斜向進出時保留整車及後視鏡淨空，路面方向箭頭全部朝右。
每局隨機由校車或遊覽車與計程車同行，另一台大型車最後到站；沿用相同車體、停靠位及各自等候格，進場、提示和乘客依本局安排切換。

## 第九關模型沿用與新增（2026-10-24）

| 物件 | 分類與來源 | 保留或新增內容 |
| --- | --- | --- |
| 道路清掃車 | 沿用：[sweeper.ts](../src/runtime/sweeper.ts) · `createSweeper` | 原車身、配色、雙圓刷、吸入口與抓取範圍保持；第九關只控制進出、逐段清掃與輪刷轉動。 |
| 資源回收車 | 既有變體：[sanitation/vehicles.ts](../src/missions/sanitation/vehicles.ts) · `createRecyclingTruck` | 原 `createFlatbed(shapes, false)` 六輪整車與空平板，新增低護欄、回收標誌與可放下的近側板；四種配色。紙箱與瓶籃直接放在真實車斗內，保留原平板尺寸。 |
| 垃圾車 | 新上裝、沿用底盤：同檔 · `createGarbageTruck` | 共用 `chassis` 駕駛室／底盤／四輪，黃色密閉車廂、真正開口的車尾料斗、可動壓縮板、後升桶架與連桿；垃圾袋進口後才收起。 |
| 廚餘車 | 新上裝、沿用底盤：同檔 · `createFoodTruck` | 相同底盤搭配較短密閉收集車廂、食物標誌、分段屋頂真實開口、活動頂蓋與側升桶架；不以回收平板換色代替車體。 |
| 帶輪垃圾桶／廚餘桶 | 新增：同檔 · `createBin` | 中空桶身、輪子、把手、活動蓋與可見內容物；廚餘桶以食物圖樣及棕色辨識。單一模型隨掛架抬升、翻轉、降回路旁。 |
| 垃圾袋、紙箱束、空瓶籃 | 新增：同檔 · `createCollectible` | 綁口低多邊形袋、三層束帶紙箱、帶護欄與六瓶的瓶籃；形狀識別，無分類測驗，裝卸與車上共用相同物件。 |
| 居民與清潔隊員 | 沿用：[resident.ts](../src/runtime/resident.ts)、[emergency-models.ts](../src/runtime/emergency-models.ts) | 原居民及制服人物與可動手臂；居民組合保留成人／孩子比例變化。 |
| 房屋、樹木與長椅 | 沿用：[town-scenery.ts](../src/runtime/town-scenery.ts) | 原街景模型，房屋降低，樹木移至兩端；人行道與收運作業區分開，露出車尾與近側。 |
| 收運場地、落葉碎屑與倒料粒子 | 新增場景：[sanitation/scene.ts](../src/missions/sanitation/scene.ts) | 道路、低路緣、人行道、收運標線；兩套工作區座標由 `domain/site.ts` 共用到畫面、命中、提示及驗證。 |
| 選關與四車圖示 | 新增 SVG：[sanitation-art.ts](../src/app/sanitation-art.ts) | 選關以升桶垃圾車為主；垃圾／回收／廚餘圖示新增，清掃車圖示直接沿用原交通關卡。 |

每局四車、兩袋、兩次不同方向的升桶、兩件回收物及一次清掃；多站巡迴與處理場卸貨暫緩。
