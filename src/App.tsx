import React, { useEffect, useMemo, useState } from 'react';
import { AIModel, ProviderId } from './types';
import { INITIAL_MODELS, PROVIDERS } from './data/modelsData';
import { GraphicalView } from './components/GraphicalView';
import { TableView } from './components/TableView';
import { NewsSection } from './components/NewsSection';
import { AddModelModal } from './components/AddModelModal';
import {
  BarChart2,
  Table,
  Search,
  Filter,
  Plus,
  Sparkles,
  Unlock,
  Cpu,
  RotateCcw,
  Github,
} from 'lucide-react';

const ALL_PROVIDERS = Object.keys(PROVIDERS) as ProviderId[];
const STORAGE_KEY = 'llm_tracker_custom_models_v1';

export const App: React.FC = () => {
  // 視圖切換：'graphical' (圖形化) | 'table' (表格)
  const [viewMode, setViewMode] = useState<'graphical' | 'table'>('graphical');

  // 自訂新增的模型（儲存在 localStorage）
  const [customModels, setCustomModels] = useState<AIModel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customModels));
    } catch {
      // ignore storage errors
    }
  }, [customModels]);

  // 篩選狀態
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>(ALL_PROVIDERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [licenseFilter, setLicenseFilter] = useState<'ALL' | 'Open-Weights' | 'Proprietary'>('ALL');
  const [onlyReasoning, setOnlyReasoning] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const allModels = useMemo(() => [...INITIAL_MODELS, ...customModels], [customModels]);

  // 過濾後的模型清單
  const filteredModels = useMemo(() => {
    return allModels.filter((m) => {
      if (!selectedProviders.includes(m.provider)) return false;
      if (yearFilter !== 'ALL' && !m.releaseDate.startsWith(yearFilter)) return false;
      if (licenseFilter !== 'ALL' && m.license !== licenseFilter) return false;
      if (onlyReasoning && !m.isReasoning) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchProvider = m.provider.toLowerCase().includes(q);
        const matchHighlight = m.highlights.toLowerCase().includes(q);
        const matchParams = m.parameters.toLowerCase().includes(q);
        if (!matchName && !matchProvider && !matchHighlight && !matchParams) return false;
      }
      return true;
    });
  }, [allModels, selectedProviders, yearFilter, licenseFilter, onlyReasoning, searchQuery]);

  const toggleProvider = (p: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const resetFilters = () => {
    setSelectedProviders(ALL_PROVIDERS);
    setSearchQuery('');
    setYearFilter('ALL');
    setLicenseFilter('ALL');
    setOnlyReasoning(false);
  };

  const handleAddModel = (model: AIModel) => {
    setCustomModels((prev) => [...prev, model]);
  };

  // 頂部統計指標
  const stats = useMemo(() => {
    const openCount = filteredModels.filter((m) => m.license === 'Open-Weights').length;
    const reasoningCount = filteredModels.filter((m) => m.isReasoning).length;
    return {
      total: filteredModels.length,
      providersCount: new Set(filteredModels.map((m) => m.provider)).size,
      openCount,
      reasoningCount,
    };
  }, [filteredModels]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 頂部導覽與 Hero 標題區 */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  AI 大廠模型演進追蹤器
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  2020 – 2026+
                </span>
              </div>
              <p className="text-xs text-slate-400">
                涵蓋 OpenAI、Anthropic、Google、Meta、xAI、Mistral、DeepSeek、Qwen 歷代模型時間軸與自動新聞聚合
              </p>
            </div>
          </div>

          {/* 圖形化 / 表格 主切換按鈕與新增模型 */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                onClick={() => setViewMode('graphical')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'graphical'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                圖形化呈現
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                表格清單呈現
              </button>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增模型
            </button>
          </div>
        </div>
      </header>

      {/* 主要內容區 */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8 flex-1">
        {/* KPI 數據概覽小卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">已收錄代表模型</span>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">{stats.total} 款</div>
            <span className="text-[11px] text-slate-500">包含歷史經典與最新發佈旗艦</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">追蹤頂級 AI 大廠</span>
            <div className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono">
              {stats.providersCount} / {ALL_PROVIDERS.length} 家
            </div>
            <span className="text-[11px] text-slate-500">美、歐、中核心大模型實驗室</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">開源權重模型 (Open-Weights)</span>
            <div className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono">{stats.openCount} 款</div>
            <span className="text-[11px] text-slate-500">Llama / DeepSeek / Qwen / Mistral 等</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">深度推理模型 (Reasoning)</span>
            <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">{stats.reasoningCount} 款</div>
            <span className="text-[11px] text-slate-500">支援思維鏈強化學習 (o1/o3/R1/Thinking)</span>
          </div>
        </div>

        {/* 多維度篩選與廠商開關控制面板 */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* 關鍵字搜尋 */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋模型名稱、參數 (如 MoE, 70B)、技術關鍵字..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 年份、開源與推理快速過濾 */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">年份：</span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">全部年份 (2020-2026)</option>
                  <option value="2026" className="bg-slate-900">2026 年</option>
                  <option value="2025" className="bg-slate-900">2025 年</option>
                  <option value="2024" className="bg-slate-900">2024 年</option>
                  <option value="2023" className="bg-slate-900">2023 年</option>
                  <option value="2022" className="bg-slate-900">2022 年</option>
                  <option value="2020" className="bg-slate-900">2020 年</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <Unlock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">授權：</span>
                <select
                  value={licenseFilter}
                  onChange={(e) => setLicenseFilter(e.target.value as 'ALL' | 'Open-Weights' | 'Proprietary')}
                  className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">全部授權</option>
                  <option value="Open-Weights" className="bg-slate-900">僅開源權重 (Open-Weights)</option>
                  <option value="Proprietary" className="bg-slate-900">僅閉源商用 (Proprietary)</option>
                </select>
              </div>

              <button
                onClick={() => setOnlyReasoning((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
                  onlyReasoning
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                僅看推理模型 (Reasoning)
              </button>

              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="重設所有篩選條件"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                重置
              </button>
            </div>
          </div>

          {/* 8 大 AI 廠商快速點選膠囊 */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">廠商篩選：</span>
            <button
              onClick={() =>
                setSelectedProviders(
                  selectedProviders.length === ALL_PROVIDERS.length ? [] : ALL_PROVIDERS
                )
              }
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium mr-1 cursor-pointer"
            >
              {selectedProviders.length === ALL_PROVIDERS.length ? '取消全選' : '全選廠商'}
            </button>

            {ALL_PROVIDERS.map((p) => {
              const meta = PROVIDERS[p];
              const isSelected = selectedProviders.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? `${meta.bgBadge} ${meta.borderBadge} shadow-sm`
                      : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                  {p}
                </button>
              );
            })}
          </div>
        </section>

        {/* 核心模型時間軸區域：依據 viewMode 切換 圖形化 或 表格 */}
        {viewMode === 'graphical' ? (
          <GraphicalView models={filteredModels} selectedProviders={selectedProviders} />
        ) : (
          <TableView models={filteredModels} />
        )}

        {/* 自動化 AI 新聞專區 */}
        <NewsSection />
      </main>

      {/* 頁尾說明 */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            AI 大廠模型演進追蹤器 (LLM Model Release Tracker) — 純前端靜態架構，支援 GitHub Actions 自動化更新與 GitHub Pages 部署。
          </div>
          <div className="flex items-center gap-4">
            {customModels.length > 0 && (
              <button
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setCustomModels([]);
                }}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                清除本地自訂模型 ({customModels.length})
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Github className="w-3.5 h-3.5" />
              Powered by React + Vite + Tailwind + GitHub Actions
            </span>
          </div>
        </div>
      </footer>

      {/* 新增模型彈窗 */}
      <AddModelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddModel}
      />
    </div>
  );
};

export default App;
