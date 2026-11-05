import React, { useMemo, useState } from 'react';
import { AIModel } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Download, Sparkles, Unlock, Lock } from 'lucide-react';

interface TableViewProps {
  models: AIModel[];
}

type SortField = 'releaseDate' | 'name' | 'provider' | 'contextTokens' | 'license';
type SortOrder = 'asc' | 'desc';

export const TableView: React.FC<TableViewProps> = ({ models }) => {
  const [sortField, setSortField] = useState<SortField>('releaseDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'releaseDate') {
        cmp = new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'provider') {
        cmp = a.provider.localeCompare(b.provider);
      } else if (sortField === 'contextTokens') {
        cmp = a.contextTokens - b.contextTokens;
      } else if (sortField === 'license') {
        cmp = a.license.localeCompare(b.license);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [models, sortField, sortOrder]);

  const exportCsv = () => {
    const headers = ['發佈日期', '廠商', '模型名稱', '參數規模', '上下文視窗', '模態', '授權模式', '推理模型', '重點特色', '官方連結'];
    const rows = sortedModels.map((m) => [
      m.releaseDate,
      m.provider,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.parameters.replace(/"/g, '""')}"`,
      `"${m.contextWindow}"`,
      `"${m.modalities.join('/')}"`,
      m.license,
      m.isReasoning ? 'Yes' : 'No',
      `"${m.highlights.replace(/"/g, '""')}"`,
      m.officialUrl,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm-models-timeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* 表格頂部工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/90">
        <div className="text-sm text-slate-300">
          目前顯示 <strong className="text-white font-semibold">{sortedModels.length}</strong> 款模型（點擊表頭欄位可切換排序）
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          匯出 CSV 報表
        </button>
      </div>

      {/* 響應式表格容器 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  onClick={() => handleSort('releaseDate')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"
                >
                  發佈日期
                  {renderSortIcon('releaseDate')}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  onClick={() => handleSort('provider')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"
                >
                  研發大廠
                  {renderSortIcon('provider')}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"
                >
                  模型名稱
                  {renderSortIcon('name')}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">參數規模</th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  onClick={() => handleSort('contextTokens')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"
                >
                  上下文視窗
                  {renderSortIcon('contextTokens')}
                </button>
              </th>
              <th className="py-3.5 px-4 whitespace-nowrap">支援模態</th>
              <th className="py-3.5 px-4 whitespace-nowrap">
                <button
                  onClick={() => handleSort('license')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"
                >
                  授權性質
                  {renderSortIcon('license')}
                </button>
              </th>
              <th className="py-3.5 px-4 min-w-[280px]">技術亮點與里程碑</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">連結</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {sortedModels.map((model) => {
              const meta = PROVIDERS[model.provider];
              return (
                <tr
                  key={model.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {model.releaseDate}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.bgBadge} ${meta.borderBadge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                      {model.provider}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{model.name}</span>
                      {model.isReasoning && (
                        <span
                          title="具備深度思維鏈推理能力 (Reasoning)"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          推理
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {model.parameters}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-emerald-300 whitespace-nowrap">
                    {model.contextWindow}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {model.modalities.map((mod) => (
                        <span
                          key={mod}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {model.license === 'Open-Weights' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                        <Unlock className="w-3 h-3" />
                        開源權重
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        <Lock className="w-3 h-3" />
                        閉源商用
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-300 leading-relaxed max-w-md">
                    {model.highlights}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <a
                      href={model.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      來源
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {sortedModels.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                  沒有符合目前篩選條件的模型資料，請嘗試調整上方搜尋關鍵字或廠商篩選。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
