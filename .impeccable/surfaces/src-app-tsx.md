---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/GraphicalView.tsx","src/components/TableView.tsx","src/components/NewsSection.tsx"]
---

# Surface: 追蹤器主頁（src/App.tsx）

Mode: Operate。使用者：作者本人，晚上在桌機開啟。任務：看上次之後變了什麼、比較規格、回顧演進。必留：新聞主題篩選、統計圖表。可移除：CSV 匯出、新增自訂模型（brief 已確認）。

## Direction contract

THESIS：每次打開都翻到今天這一頁，時間軸從今天往回撕。拒絕「KPI 卡＋篩選面板＋圖表卡」的 AI 儀表板排法。

OWN-WORLD：撕日曆的夜間版。墨底 #1a1714、紙白字、朱紅只給旗艦（如國定假日）、農民曆綠只給「上次造訪後新增」。廠商品牌色只用在資料點。直角、細線分隔，沒有卡中卡、沒有光暈、沒有漸層。一個字族撐起整套字級，大日期數字是唯一的展示字。

STORY：使用者先看到今天與上次之後的新發佈，再沿著時間軸往回看各家節奏，需要時切到規格比較或統計。

FIRST VIEWPORT：頂列（產品名、時間軸／規格比較／統計分頁、搜尋 /）；廠商篩選列；左側依發佈數量分配高度的年份索引；中間 8 條廠商時間軸佔滿；右側紙白「今天」日期頁（大日期、上次造訪後清單）；最右新聞欄含主題篩選。

FORM：grounded 第 7 名（撕日曆），seed:6ea5e72434e8d769

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
