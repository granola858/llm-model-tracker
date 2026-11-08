---
name: AI 模型演進追蹤器
description: 撕日曆的夜間版：每次打開都翻到今天這一頁，時間軸從今天往回撕。
colors:
  ink: "#1a1714"
  ink-raised: "#221e1a"
  ink-sunk: "#15120f"
  rule: "#3a332c"
  rule-soft: "#2a2520"
  paper: "#efe8dc"
  paper-dim: "#c9c0b3"
  muted: "#a39a8e"
  paper-rule: "#cfc5b6"
  paper-ink: "#2a241f"
  paper-muted: "#5e554b"
  cinnabar: "#c41e17"
  cinnabar-ink: "#ff6a5c"
  gold: "#7a560c"
  gold-sheen: "#c79a2e"
  gold-ink: "#e9b949"
  gold-ink-sheen: "#fff6d6"
  almanac: "#276b3c"
  almanac-ink: "#5cc282"
  provider-openai: "#56c1d6"
  provider-anthropic: "#d98a6a"
  provider-google: "#e3c75a"
  provider-meta: "#9a9cf2"
  provider-xai: "#d9d4cb"
  provider-mistral: "#f0a03c"
  provider-deepseek: "#5f97f5"
  provider-qwen: "#c787e8"
typography:
  display:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "9.5rem"
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: "-0.04em"
    fontFeature: "'tnum' 1"
  display-compact:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "5.5rem"
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: "-0.04em"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  wordmark:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.55
    letterSpacing: "0.025em"
  title:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "'tnum' 1"
  body-long:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.47
    fontFeature: "'tnum' 1"
rounded:
  sm: "4px"
  full: "9999px"
spacing:
  tight: "8px"
  row: "10px"
  stack: "12px"
  cell: "16px"
  gutter: "20px"
  gutter-wide: "24px"
components:
  tab:
    textColor: "{colors.paper-dim}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  tab-hover:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
  tab-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  provider-toggle:
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  provider-toggle-off:
    textColor: "{colors.muted}"
  input-search:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 36px"
  select:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  icon-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    size: "32px"
  icon-button-hover:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
  year-index-item:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    width: "56px"
  year-index-item-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  today-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    padding: "20px 24px"
  day-numeral:
    textColor: "{colors.paper-ink}"
    typography: "{typography.display}"
  day-numeral-red:
    textColor: "{colors.cinnabar}"
    typography: "{typography.display}"
  model-detail:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
    padding: "16px 20px"
  table-header:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "10px 16px"
  table-row:
    textColor: "{colors.paper-dim}"
    typography: "{typography.body}"
    padding: "10px 16px"
  table-row-open:
    backgroundColor: "{colors.ink-raised}"
---

# Design System: AI 模型演進追蹤器

## Overview

**Creative North Star: "撕日曆・夜間版"**

整個介面是一本夜裡翻開的撕日曆。墨色底（ink）是夜，紙白（paper）是那一頁「今天」；每次打開都翻到今天，時間軸從今天往回撕。紙白頁是唯一一塊亮面，大日期數字是整套系統唯一的展示字，其他一切都退回細線、小字與資料點。

顏色沿用日曆的印刷慣例：平日黑字，國定假日印朱紅，農民曆的宜忌用綠。在這裡，旗艦模型名稱改用燙金（一道光每隔幾秒掃過），朱紅只留給紅日（週日或當天有旗艦的日期數字），農民曆綠只給「上次造訪後新增」。旗艦標示可由篩選列的「旗艦」開關整組關掉。八家廠商的品牌色退到資料層，只出現在點、形狀與長條上，而且刻意避開這兩個保留色相。密度偏高，為作者本人夜間快速瀏覽而排，不為陌生訪客加說明。

材質是平的：直角或 4px 小圓角、1px 細線分隔、沒有卡片、沒有陰影、沒有漸層、沒有光暈。資訊靠形狀與符號編碼，不靠裝飾：推理模型是菱形、一般模型是圓形，估計值是「≈」加虛線底線。唯一的動作是今天那一頁從上緣撕開露出。

**Key Characteristics:**
- 墨底紙字，暖灰調中性色，唯一亮面是「今天」日期頁
- 三個保留色：燙金（旗艦）、朱紅（紅日）、農民曆綠（上次造訪後新增），各有紙面版與墨面版
- 廠商色只在資料點上，八色全部避開紅綠
- 單一字族 Noto Sans TC（400／700／900），全域等寬數字
- 形狀承載語意：圓＝一般、菱形＝推理、空心＝估計、外環＝狀態
- 平面材質：1px 細線、4px 小圓角、零陰影
- 唯一進場動作：日期區塊的撕頁揭露，減少動態時關閉

## Colors

暖調墨與紙的雙色世界，加兩個借自日曆印刷的保留色，再加八個只住在資料層的廠商色。

### Primary
- **燙金・墨面版（Gold Ink）**：墨底上的旗艦色，700 字重，以 Gold Ink Sheen 做一道 5 秒循環的掃光（減少動態時靜止）。時間軸上旗艦模型的標籤、詳情列的「旗艦」類別、比較表的旗艦模型名稱、篩選列的「旗艦」開關。由 `.flagship` 套用。
- **燙金（Gold）**：紙面上的旗艦色，壓深以維持對比。「今天」頁裡旗艦模型名稱。由 `.flagship.flagship-paper` 套用。
- **朱紅（Cinnabar）**：紅日色。週日或當天有旗艦發佈的大日期數字（後者在旗艦開關關掉時不印紅）。

### Secondary
- **農民曆綠（Almanac）**：紙面上的「新增」色。「今天」頁標題旁的新發佈款數。
- **農民曆綠・墨面版（Almanac Ink）**：墨底上的「新增」色。篩選列右端的新發佈計數、時間軸上新增模型的外環、詳情列的「上次造訪後新增」。

### Tertiary
- **廠商資料色（Provider Data Colors）**：OpenAI 青、Anthropic 陶土、Google 芥黃、Meta 藍紫、xAI 骨白、Mistral 橘、DeepSeek 鈷藍、Qwen 丁香紫。只用於廠商圓點、模型形狀、統計長條與散佈點。

### Neutral
- **夜墨（Ink）**：頁面底色、時間軸泳道的固定欄底色、選中狀態的反白文字。
- **墨・浮起（Ink Raised）**：輸入框、下拉選單、模型詳情列、表頭、展開列、hover 底色。
- **墨・下沉（Ink Sunk）**：統計長條的軌道底。
- **細線（Rule）**：主要分隔線、輸入框邊框、時間刻度線。
- **細線・淡（Rule Soft）**：次要分隔、泳道虛線、表格列線、未選取的廠商鈕邊框。
- **紙白（Paper）**：主要文字、選中的分頁與年份底色、焦點外框、選取反白底。
- **紙白・淡（Paper Dim）**：次要文字、未選分頁、廠商名、表格內容。
- **灰（Muted）**：標籤、刻度、時間戳記、placeholder、停用的篩選。
- **紙・細線（Paper Rule）**：「今天」頁清單的分隔線。
- **紙・墨字（Paper Ink）**：「今天」頁的文字與平日日期數字、日期下方 2px 粗線。
- **紙・灰（Paper Muted）**：「今天」頁的日期與次要文字；也是未選廠商的灰點。

### Named Rules
**The 國定假日 Rule.** 燙金只給旗艦，朱紅只給紅日。旗艦模型名稱用燙金；週日或當天有旗艦發佈的日期數字印紅；hover、強調、警示、按鈕都不行。旗艦樣式一律掛 `.flagship` class，由 `html[data-flagship]` 統一開關，元件不自行判斷。

**The 農民曆 Rule.** 綠色只表示「上次造訪後新增」（首次造訪為最近 30 天）。不拿來表示成功、開啟、或任何其他狀態。

**The 紙墨兩版 Rule.** 每個保留色有兩版：紙面用 gold／cinnabar／almanac，墨底用 gold-ink／cinnabar-ink／almanac-ink。不可把紙面版放到墨底上，反之亦然。

**The 資料層品牌色 Rule.** 廠商色只畫在資料點、形狀、長條上，不當文字色、不當面積底色。新增廠商色時必須避開朱紅與農民曆綠的色相；燙金靠字重與掃光跟 Google 的黃色資料點區隔。

## Typography

**Display Font:** Noto Sans TC 900（後援 PingFang TC、Microsoft JhengHei、sans-serif）
**Body Font:** Noto Sans TC 400／700（同一字族、自行託管，經 @fontsource 載入 400、700、900 三個字重）

**Character:** 一個字族撐起整套字級。大日期數字是唯一的展示聲音，以 900 字重、負字距、0.85 行高印成日曆上那個巨大的數字；其餘字級克制，靠粗細而非尺寸分層。全域開啟等寬數字，日期與數量才能對齊。

### Hierarchy
- **Display**（900，9.5rem 桌機／5.5rem 窄螢幕，行高 0.85，字距 -0.04em）：只用於「今天」頁的日期數字。
- **Headline**（700，1.25rem）：模型詳情列的模型名稱。
- **Wordmark**（900，1.125rem，字距 0.025em）：頂列的產品名，只出現一次。
- **Title**（700，1rem）：區塊標題，如「新聞」、統計圖標題、日期頁的年月與星期。
- **Body**（400，0.875rem）：分頁、篩選、清單、表格、新聞標題。強調用 700。
- **Body Long**（400，0.875rem，行高 1.625，最寬 75ch）：模型重點說明。
- **Label**（400，0.75rem）：表頭、時間刻度、年份索引、新聞時間戳記、圖例。

### Named Rules
**The 唯一展示字 Rule.** 只有日期數字可以超過 1.25rem。其他標題一律靠 700／900 字重分層，不放大。

**The 三字重 Rule.** 只用 400、700、900，這是唯一載入的三個字重。

**The 等寬數字 Rule.** 全域 `font-feature-settings: 'tnum' 1`；日期、款數、參數、上下文長度都要能縱向對齊。

## Layout

桌機（≥1024px）是滿版、不捲動整頁的工作台：頂列（產品名、分頁、搜尋）、廠商篩選列，下方三欄格線 `minmax(0,1fr) 17rem 21rem`，依序為時間軸、紙白「今天」頁、新聞欄，各欄自行捲動。窄螢幕改為單欄堆疊，「今天」頁排第一、時間軸第二（最小高度 34rem，可橫向捲動、預設捲到今天）、新聞第三；日期頁改成數字在左、年月星期在右的橫排。

時間軸左側是 56px 寬的年份索引，每個年份的高度依該年發佈數量分配。時間軸本身是非線性的：早期稀疏年份依發佈數壓縮，最近 90 天逐月切段並加權三倍，讓「今天」這端最寬。八條廠商泳道等分高度、填滿可用空間，廠商名固定在左側 96px 欄。

間距節奏以 4px 為基礎：區塊左右留白 20px（桌機頂列 24px），列與清單上下 10–12px，表格儲存格左右 16px，行內元素間距 8px。

**The 依量分配 Rule.** 時間空間依發佈數量分配，不依日曆等長；年份索引與時間軸用同一邏輯。

## Elevation & Depth

完全平面。沒有任何陰影、光暈或漸層；層次由三階墨色（下沉 < 底 < 浮起）與一塊紙白頁的明暗對比構成。浮起層（ink-raised）只用於可輸入的控制項、詳情列、表頭與展開列。唯一的 box-shadow 是紙面上模型形狀外的 1px 墨色細環，用途是讓淺色廠商色在紙白上看得清楚，不是立體感。

### Shadow Vocabulary
- **紙面描邊環**（`box-shadow: 0 0 0 1px rgba(42, 36, 31, 0.55)`）：只用於「今天」頁上的模型形狀，提供淺色資料點在紙面上的輪廓。

### Named Rules
**The 平面紙張 Rule.** 層次靠墨色明度與 1px 細線，不靠陰影。需要分組時加一條線，不加一張卡。

## Shapes

介面元件一律直角或 4px 小圓角（分頁、按鈕、輸入框、下拉選單、鍵帽）；版面區塊之間只用 1px 細線切開，泳道間用虛線。圓形只屬於資料：廠商圓點（8px）、模型形狀、時間軸上的命中區與狀態外環。

形狀本身承載語意：
- **圓形**：一般模型。
- **菱形**（正方形旋轉 45° 並縮 90%）：推理模型。
- **空心**（填色改為墨底、保留 2px 描邊）：上下文長度為估計值（統計散佈圖）；紙面上底色透明，表示尚未發布的預測（「今天」頁）。
- **外環**：狀態。紙白環＝目前選中，農民曆綠環＝上次造訪後新增；環與形狀之間隔一圈墨色。

**The 形狀即語意 Rule.** 推理用形狀表達，不用顏色或文字徽章；顏色已經被廠商佔用。

**The 估計值 Rule.** 未經官方證實的數字前加「≈」，下方加 muted 色虛線底線（偏移 3px），游標為 help，並附 title 說明。

## Components

### Buttons
- **Shape:** 小圓角（4px）。
- **分頁（Tab）:** 未選為紙白・淡文字、無底；hover 換浮起墨底與紙白字；選中為紙白底、墨字的反白，像撕下的一頁。內距 6px 14px。
- **圖示按鈕:** 32px 方形、灰色圖示，hover 換浮起墨底與紙白。純圖示一定附 aria-label 與 title。
- **焦點:** 全域 2px 紙白外框、偏移 2px；紙面上改用紙・墨字色外框。

### Chips
- **廠商切換鈕:** 1px 邊框、4px 圓角、內距 4px 12px，前置 8px 廠商圓點。開啟為紙白・淡邊框與紙白字；關閉為淡細線邊框、灰字加刪除線、圓點轉為紙・灰。
- **全部／全部取消:** 同形狀，細線邊框、紙白・淡文字。

### Cards / Containers
- **沒有卡片。** 區塊以 1px 細線分隔。
- **模型詳情列:** 時間軸下方一整條浮起墨底，上緣一條細線，內距 16px 20px；名稱前放模型形狀，規格用 `dl` 橫排，鍵為灰、值為紙白。
- **今天日期頁:** 見下方 Signature Component。

### Inputs / Fields
- **Style:** 浮起墨底、1px 細線邊框、4px 圓角、紙白字、灰色 placeholder。搜尋框左置 16px 搜尋圖示、右置「/」鍵帽提示。
- **Focus:** 邊框轉為紙白・淡，不加光暈。
- **下拉選單:** 同樣式，內距 6px 8px；選項底色為浮起墨。
- **核取方塊:** 原生控制，accent 為紙白。

### Navigation
- **頂列:** 產品名（Wordmark）、三個分頁（時間軸／規格比較／統計）、靠右搜尋；窄螢幕搜尋換行滿寬。
- **年份索引:** 56px 縱欄，每格高度依該年發佈數；資料多的年份縱排「年份＋款數」，少的年份橫排兩位數年份。選中為紙白反白，hover 為浮起墨底。
- **鍵盤:** 「/」聚焦搜尋、Esc 清空；時間軸上左右鍵在同一泳道移動、上下鍵跳到相鄰泳道最近日期、Home／End 到頭尾。

### 規格比較表
- 表頭為浮起墨底、黏在頂端，Label 字級、灰字，可排序欄的目前排序以紙白字加 12px 箭頭表示。
- 列以淡細線分隔，hover 為 60% 浮起墨底；展開列為浮起墨底，顯示重點說明與官方連結。
- 旗艦模型名稱用燙金・墨面版；估計值套用估計值規則。

### 時間軸泳道（Signature Component）
每家廠商一條水平泳道，中線為 1px 淡細線，泳道之間為虛線。模型以 24px 圓形命中區定位，內含 10px 模型形狀（選中時 12px）。文字標籤 12px，「全部」檢視每條泳道標最新三款，單一年份全部都標；旗艦標籤為 700 字重的燙金・墨面版（掛在內層 span，避免跟標籤淡入動畫搶 animation），選中模型的一般標籤提亮為紙白。

**The 標籤不重疊 Rule.** 標籤由新到舊逐一找空位：先貼中線、再往外一排（泳道夠高才有第二排）；同一排優先從圓點右側起頭，放不下才改在左側收尾；上下兩側輪流。同一排標籤間至少留 12px，任何位置都放不下就不標，滑過圓點仍能在詳情列看到。

**縮放過渡：** 切換年份時圓點與刻度沿軸滑到新位置（520ms，與撕頁同一條 `cubic-bezier(0.16, 1, 0.3, 1)`），移出範圍的朝正確方向滑出並淡出，標籤等圓點定位後才淡入。這是回應操作的過渡，不是進場動畫，第一次載入不播；`prefers-reduced-motion: reduce` 時完全關閉。

### 今天日期頁（Signature Component）
整套系統唯一的紙白面積。上方為年月（Title）、巨大日期數字（Display）、星期（Title）；日期下方一條 2px 紙・墨字粗線，先接「下一代旗艦預測」：最多三列，每列為空心模型形狀（帶紙面描邊環）、名稱、灰色大約時間，以紙・細線分隔，點擊連到市場頁、滑過顯示機率；模型還沒發布，名稱不用燙金。沒有資料時整區不顯示。再接同樣粗線開頭的「上次造訪後」清單：標題右側以農民曆綠標出款數，每列為模型形狀（帶紙面描邊環）、名稱（旗艦為 700 燙金紙面版）、灰色短日期，以紙・細線分隔。沒有新發佈時改列最近五款。

**撕頁揭露：** 日期區塊進場時以 `clip-path: inset(0 0 100% 0)` 到 `inset(0 0 0 0)` 從上緣撕開，520ms，`cubic-bezier(0.16, 1, 0.3, 1)`。這是唯一的進場動作；`prefers-reduced-motion: reduce` 時完全關閉。

## Do's and Don'ts

### Do:
- **Do** 把燙金限定在旗艦模型，朱紅限定在紅日（週日或當天有旗艦）；墨底用 gold-ink，紙面用 gold。
- **Do** 把綠色限定在「上次造訪後新增」；墨底用 almanac-ink，紙面用 almanac。
- **Do** 用形狀表達推理（菱形）、用空心或「≈」加虛線底線表達估計值。
- **Do** 用 1px 細線（rule／rule-soft）分組，浮起墨（ink-raised）只給控制項、詳情列與表頭。
- **Do** 所有數字使用等寬數字，日期與款數縱向對齊。
- **Do** 讓時間空間依發佈數量分配，最近的那端最寬。
- **Do** 在減少動態偏好下關閉撕頁動畫與載入旋轉。

### Don't:
- **Don't** 把燙金或朱紅用在 hover、按鈕、錯誤或任何非旗艦／紅日的強調。
- **Don't** 把綠色用於「成功」「開啟」等一般狀態。
- **Don't** 把廠商色用在文字或大面積底色，也不要新增偏紅或偏綠的廠商色。
- **Don't** 加卡片、卡中卡、陰影、光暈或漸層；紙面描邊環是唯一的 box-shadow，用途是輪廓。
- **Don't** 讓日期數字以外的任何文字超過 1.25rem，也不要引入第二個字族。
- **Don't** 加入第二個進場動畫。
- **Don't** 擺出「KPI 卡＋篩選面板＋圖表卡」的儀表板排法。
