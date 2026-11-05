# AI 大廠模型演進追蹤器 & 自動化新聞中心 (LLM Model Tracker)

這是一個純前端靜態網頁專案（基於 **React 19 + TypeScript + Vite + Tailwind CSS v4**），專為追蹤全球 8 大頂尖 AI 廠商（**OpenAI、Anthropic、Google DeepMind、Meta、xAI、Mistral、DeepSeek、Qwen**）歷代模型推出時間軸、技術規格演進，以及透過 **GitHub Actions** 定時自動抓取最新 AI 產業新聞而設計。

---

## ✨ 核心功能特色

1. **完整歷代模型資料庫（2020 – 2026+）**
   - 收錄從早期奠基模型（如 `GPT-3`、`LLaMA 1`、`Claude 1`、`PaLM 2`）到中後期多模態與深度推理模型（如 `GPT-4o`、`o1/o3`、`GPT-5/6`、`Claude 3.5/3.7/4/4.5/5/5.5`、`Gemini 1.5/2.0/2.5/3/4`、`Llama 3/4`、`Muse Spark`、`DeepSeek-V3/R1/V4`、`Qwen2.5/3/3.5/3.8`、`Grok 2/3/4/4.7`、`Mixtral/Mistral Large 2/3/4`）。
2. **圖形化 / 表格雙視圖無縫切換**
   - **圖形化呈現 (Graphical View)**：
     - **各廠牌演進泳道圖 (Swimlane Matrix)**：以時間為橫軸、8 大廠商為縱軸，直觀對比各家發佈節奏；支援滑鼠懸停即時預覽模型規格卡，並以金色光暈標記具備思維鏈推理（Reasoning）的模型。
     - **編年史時間軸 (Chronological Timeline)**：由新到舊垂直呈現歷次重大發布與技術突破。
     - **量化統計與規格圖表 (Analytics Charts)**：包含各廠開源/閉源模型佔比、年度發佈密度趨勢，以及 Context Window（上下文視窗從 2K 至 10M Tokens）對數演進圖。
   - **表格清單呈現 (Table View)**：
     - 支援依「發佈日期」、「廠商」、「模型名稱」、「上下文長度」、「授權模式」雙向排序。
     - 支援一鍵 **匯出 CSV 報表**（含 UTF-8 BOM，Excel 直接開啟不亂碼）。
3. **純前端零後端 + GitHub Actions 自動化新聞抓取**
   - 內建 [`scripts/fetch-news.mjs`](./scripts/fetch-news.mjs) 爬蟲腳本（零外部依賴，使用原生 Node.js `fetch`），自動聚合 OpenAI、Google AI、TechCrunch AI、The Verge AI、Hugging Face、Ars Technica、VentureBeat 等 RSS 來源，並自動辨識對應的 AI 廠商標籤寫入 [`public/data/news.json`](./public/data/news.json)。
   - 搭配 [`.github/workflows/update-news-and-deploy.yml`](./.github/workflows/update-news-and-deploy.yml)，每 6 小時自動更新新聞並重新部署至 **GitHub Pages**，前端直接讀取同源靜態 JSON，完全無 CORS 跨域阻擋問題。

---

## 🚀 本地開發與執行方式

```bash
# 1. 安裝依賴套件
npm install

# 2. 手動執行一次最新 AI 新聞抓取（會更新 public/data/news.json）
npm run fetch-news

# 3. 啟動本地開發伺服器
npm run dev

# 4. 打包生產環境靜態檔案 (輸出至 dist/)
npm run build
```

---

## ⚙️ GitHub Actions 與 GitHub Pages 設定步驟

1. 將本專案推送至您的 GitHub Repository（預設分支為 `main`）。
2. 前往 GitHub 專案的 **Settings** -> **Pages**。
3. 在 **Build and deployment** 下方的 **Source** 選擇 **`GitHub Actions`**。
4. 前往 **Settings** -> **Actions** -> **General**，確認 **Workflow permissions** 勾選 **`Read and write permissions`**（讓 Action 可以自動將更新後的 `public/data/news.json` commit 回儲存庫）。
5. 完成後，每當您推送程式碼、每滿 6 小時排程、或至 **Actions** 頁籤手動點擊 **Run workflow**，系統就會自動抓取最新 AI 新聞並完成靜態網站部署！
