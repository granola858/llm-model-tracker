import React, { useMemo, useState } from 'react';
import { AIModel, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import {
  Calendar,
  ExternalLink,
  Sparkles,
  Layers,
  Cpu,
  Unlock,
  Lock,
  GitCommitHorizontal,
  BarChart3,
  Clock,
} from 'lucide-react';

interface GraphicalViewProps {
  models: AIModel[];
  selectedProviders: ProviderId[];
}

type ChartSubMode = 'swimlane' | 'chronological' | 'analytics';

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const MIN_TIME = new Date('2020-01-01').getTime();
const MAX_TIME = new Date('2026-12-31').getTime();

export const GraphicalView: React.FC<GraphicalViewProps> = ({ models, selectedProviders }) => {
  const [subMode, setSubMode] = useState<ChartSubMode>('swimlane');
  const [activeModel, setActiveModel] = useState<AIModel | null>(models[models.length - 1] || null);

  // 依據發佈日期排序（由舊到新供橫向時間軸，或由新到舊供垂直里程碑）
  const sortedAsc = useMemo(
    () => [...models].sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()),
    [models]
  );

  const sortedDesc = useMemo(
    () => [...models].sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()),
    [models]
  );

  // 計算時間百分比 (2020-01 ~ 2026-12)
  const getTimePercent = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    const clamped = Math.max(MIN_TIME, Math.min(MAX_TIME, t));
    return ((clamped - MIN_TIME) / (MAX_TIME - MIN_TIME)) * 100;
  };

  // 各大廠統計與年份統計
  const providerStats = useMemo(() => {
    const list = Object.keys(PROVIDERS) as ProviderId[];
    return list
      .filter((p) => selectedProviders.includes(p))
      .map((p) => {
        const providerModels = models.filter((m) => m.provider === p);
        const openSourceCount = providerModels.filter((m) => m.license === 'Open-Weights').length;
        const reasoningCount = providerModels.filter((m) => m.isReasoning).length;
        return {
          provider: p,
          meta: PROVIDERS[p],
          total: providerModels.length,
          openSourceCount,
          reasoningCount,
          models: providerModels.sort(
            (a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ),
        };
      });
  }, [models, selectedProviders]);

  const yearStats = useMemo(() => {
    return YEARS.map((yr) => {
      const yrModels = models.filter((m) => m.releaseDate.startsWith(yr));
      return {
        year: yr,
        total: yrModels.length,
        openWeights: yrModels.filter((m) => m.license === 'Open-Weights').length,
        proprietary: yrModels.filter((m) => m.license === 'Proprietary').length,
      };
    });
  }, [models]);

  return (
    <div className="space-y-6">
      {/* 圖形化子模式切換列 */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubMode('swimlane')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              subMode === 'swimlane'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <GitCommitHorizontal className="w-4 h-4" />
            各廠牌演進泳道圖 (Swimlane)
          </button>
          <button
            onClick={() => setSubMode('chronological')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              subMode === 'chronological'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            編年史時間軸 (Timeline)
          </button>
          <button
            onClick={() => setSubMode('analytics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              subMode === 'analytics'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            量化統計與規格圖表 (Charts)
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 ring-2 ring-indigo-400/30" />
            實心節點：一般/多模態模型
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/50 animate-pulse" />
            外環光暈：具備深度推理 (Reasoning)
          </span>
        </div>
      </div>

      {/* 子模式 1: 各廠牌演進泳道圖 (Swimlane Matrix) */}
      {subMode === 'swimlane' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 左側 2/3：泳道圖主體 */}
          <div className="xl:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
            <div className="min-w-[680px]">
              {/* 年份刻度頂欄 */}
              <div className="flex items-center border-b border-slate-800 pb-3 mb-4">
                <div className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  AI 研發大廠
                </div>
                <div className="relative flex-1 h-6">
                  {YEARS.map((yr) => {
                    const leftPct = getTimePercent(`${yr}-01-01`);
                    return (
                      <div
                        key={yr}
                        style={{ left: `${leftPct}%` }}
                        className="absolute top-0 -translate-x-1/2 text-xs font-mono text-slate-400"
                      >
                        {yr}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 各家廠商水平軌道 */}
              <div className="space-y-5">
                {providerStats.map(({ provider, meta, models: pModels }) => (
                  <div
                    key={provider}
                    className="flex items-center group hover:bg-slate-800/30 rounded-xl p-2 -mx-2 transition-colors"
                  >
                    {/* 廠商名稱 */}
                    <div className="w-40 shrink-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                        <span className="font-semibold text-sm text-slate-100">{provider}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 pl-4.5 block">
                        共 {pModels.length} 款代表模型
                      </span>
                    </div>

                    {/* 時間軸軌道 */}
                    <div className="relative flex-1 h-14 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-center">
                      {/* 年份垂直虛線 */}
                      {YEARS.map((yr) => {
                        const leftPct = getTimePercent(`${yr}-01-01`);
                        return (
                          <div
                            key={yr}
                            style={{ left: `${leftPct}%` }}
                            className="absolute top-0 bottom-0 border-l border-dashed border-slate-800/70 pointer-events-none"
                          />
                        );
                      })}

                      {/* 模型圓點 */}
                      {pModels.map((m, idx) => {
                        const leftPct = getTimePercent(m.releaseDate);
                        const isSelected = activeModel?.id === m.id;
                        // 交錯上下標籤避免密集重疊
                        const isTopLabel = idx % 2 === 0;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setActiveModel(m)}
                            onMouseEnter={() => setActiveModel(m)}
                            style={{ left: `${leftPct}%` }}
                            title={`${m.name} (${m.releaseDate})`}
                            className={`absolute -translate-x-1/2 group/node focus:outline-none cursor-pointer transition-transform ${
                              isSelected ? 'z-30 scale-125' : 'z-10 hover:scale-125 hover:z-20'
                            }`}
                          >
                            <div
                              style={{ backgroundColor: meta.color }}
                              className={`w-3.5 h-3.5 rounded-full transition-all ${
                                m.isReasoning ? 'ring-4 ring-amber-400/50' : 'ring-2 ring-slate-950'
                              } ${isSelected ? 'ring-4 ring-white shadow-lg' : ''}`}
                            />
                            <span
                              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded transition-all pointer-events-none ${
                                isTopLabel ? '-top-6' : '-bottom-6'
                              } ${
                                isSelected
                                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                                  : 'text-slate-400 group-hover/node:text-slate-100 group-hover/node:bg-slate-800'
                              }`}
                            >
                              {m.name.split(' ')[0]}
                              {m.name.split(' ')[1] ? ` ${m.name.split(' ')[1]}` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右側 1/3：互動聚焦模型詳情卡片 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between sticky top-6 h-fit">
            {activeModel ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        PROVIDERS[activeModel.provider].bgBadge
                      } ${PROVIDERS[activeModel.provider].borderBadge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${PROVIDERS[activeModel.provider].dotColor}`} />
                      {PROVIDERS[activeModel.provider].name}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2.5">{activeModel.name}</h3>
                  </div>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700 shrink-0">
                    {activeModel.releaseDate}
                  </span>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  {activeModel.highlights}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      參數規模
                    </span>
                    <span className="font-mono font-semibold text-slate-100 text-sm">
                      {activeModel.parameters}
                    </span>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      上下文視窗 (Context)
                    </span>
                    <span className="font-mono font-semibold text-slate-100 text-sm">
                      {activeModel.contextWindow}
                    </span>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                      {activeModel.license === 'Open-Weights' ? (
                        <Unlock className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      授權模式
                    </span>
                    <span className="font-semibold text-slate-100 text-sm">
                      {activeModel.license === 'Open-Weights' ? '開源權重 (Open-Weights)' : '閉源商用 (Proprietary)'}
                    </span>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      推理與定位
                    </span>
                    <span className="font-semibold text-slate-100 text-sm">
                      {activeModel.isReasoning ? '深度思維鏈推理' : activeModel.category}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-2">支援模態 (Modalities)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeModel.modalities.map((mod) => (
                      <span
                        key={mod}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-200 rounded-md border border-slate-700"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    將滑鼠移至左側泳道節點即可即時切換預覽
                  </span>
                  <a
                    href={activeModel.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    官方發佈頁面
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                請點選或懸停任一模型節點以檢視詳細規格
              </div>
            )}
          </div>
        </div>
      )}

      {/* 子模式 2: 編年史垂直里程碑時間軸 */}
      {subMode === 'chronological' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="relative border-l-2 border-slate-800 ml-4 md:ml-36 space-y-8 py-2">
            {sortedDesc.map((model) => {
              const meta = PROVIDERS[model.provider];
              return (
                <div key={model.id} className="relative pl-6 md:pl-8 group">
                  {/* 時間軸圓點 */}
                  <div
                    style={{ backgroundColor: meta.color }}
                    className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-slate-950 transition-transform group-hover:scale-125 ${
                      model.isReasoning ? 'ring-2 ring-amber-400' : ''
                    }`}
                  />

                  {/* 左側日期 (桌面版顯示於軸線左側) */}
                  <div className="md:absolute md:-left-36 md:top-0.5 md:w-28 md:text-right mb-1 md:mb-0">
                    <span className="font-mono text-xs font-semibold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700">
                      {model.releaseDate}
                    </span>
                  </div>

                  {/* 卡片內容 */}
                  <div className="bg-slate-950/70 border border-slate-800/90 group-hover:border-slate-700 rounded-xl p-4 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${meta.bgBadge} ${meta.borderBadge}`}
                        >
                          {model.provider}
                        </span>
                        <h4 className="text-base font-bold text-white">{model.name}</h4>
                        {model.isReasoning && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Reasoning 推理模型
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            model.license === 'Open-Weights'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {model.license === 'Open-Weights' ? '開源權重' : '閉源商用'}
                        </span>
                      </div>

                      <a
                        href={model.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
                      >
                        官方連結 <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{model.highlights}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>
                        參數規模：<strong className="text-slate-200 font-mono">{model.parameters}</strong>
                      </span>
                      <span>
                        上下文視窗：<strong className="text-slate-200 font-mono">{model.contextWindow}</strong>
                      </span>
                      <span>
                        支援模態：<strong className="text-slate-200">{model.modalities.join(', ')}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 子模式 3: 量化統計與規格圖表 */}
      {subMode === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 圖表 A: 各大廠收錄模型數與開源/推理佔比 */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              各家 AI 大廠代表模型數量與技術分佈
            </h3>
            <p className="text-xs text-slate-400 mb-5">比較各廠商歷代旗艦、開源權重與深度推理模型數量</p>

            <div className="space-y-4">
              {providerStats.map(({ provider, meta, total, openSourceCount, reasoningCount }) => {
                const maxCount = Math.max(...providerStats.map((s) => s.total), 1);
                const widthPct = Math.round((total / maxCount) * 100);
                return (
                  <div key={provider} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                        {meta.name}
                      </span>
                      <div className="flex items-center gap-3 text-slate-400 font-mono">
                        <span>開源: {openSourceCount}</span>
                        <span>推理: {reasoningCount}</span>
                        <span className="text-white font-bold">{total} 款</span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        style={{ width: `${widthPct}%`, backgroundColor: meta.color }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 圖表 B: 2020-2026 年度發佈密度與開源 vs 閉源趨勢 */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              歷年重要模型發佈密度 (2020 - 2026)
            </h3>
            <p className="text-xs text-slate-400 mb-5">觀察生成式 AI 爆發期與開源權重模型崛起趨勢</p>

            <div className="space-y-4">
              {yearStats.map((ys) => {
                const maxYr = Math.max(...yearStats.map((y) => y.total), 1);
                const openPct = (ys.openWeights / maxYr) * 100;
                const propPct = (ys.proprietary / maxYr) * 100;
                return (
                  <div key={ys.year} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-200">{ys.year} 年</span>
                      <div className="flex items-center gap-3 font-mono text-slate-400">
                        <span className="text-cyan-400">開源 {ys.openWeights}</span>
                        <span className="text-indigo-400">閉源 {ys.proprietary}</span>
                        <span className="text-white font-bold">共 {ys.total} 款</span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                      <div
                        style={{ width: `${propPct}%` }}
                        className="h-full bg-indigo-500 transition-all duration-500"
                        title={`閉源商用: ${ys.proprietary}`}
                      />
                      <div
                        style={{ width: `${openPct}%` }}
                        className="h-full bg-cyan-400 transition-all duration-500"
                        title={`開源權重: ${ys.openWeights}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 圖表 C: 上下文視窗 (Context Window) 對數演進圖 */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              上下文視窗長度 (Context Window) 突破演進 (Log10 對數尺度)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              從 2020 年 GPT-3 的 2K Tokens 一路躍升至 Gemini 1.5/3.0 與 Llama 4 的 2M ~ 10M Tokens
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {sortedAsc.map((m) => {
                // 對數比例: log10(2048) ≈ 3.31, log10(10,000,000) = 7
                const logVal = Math.log10(Math.max(m.contextTokens, 2048));
                const heightPct = Math.min(100, Math.max(15, ((logVal - 3) / 4) * 100));
                const meta = PROVIDERS[m.provider];
                return (
                  <div
                    key={m.id}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span className="font-mono">{m.releaseDate.slice(0, 7)}</span>
                      <span className="font-mono font-bold text-slate-200">{m.contextWindow}</span>
                    </div>
                    <div className="h-24 flex items-end justify-center bg-slate-900/60 rounded-lg p-2">
                      <div
                        style={{ height: `${heightPct}%`, backgroundColor: meta.color }}
                        className="w-full rounded-t-md transition-all duration-500"
                      />
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-100 truncate" title={m.name}>
                        {m.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{m.provider}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
