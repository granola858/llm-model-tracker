import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { AIModel } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { categoryLabel, LICENSE_LABEL, MODALITY_LABEL, paramsDisclosed, toTime } from '../lib/format';
import { ContextValue, ModelShape, ParamsValue, ProviderDot } from './marks';

type SortKey = 'releaseDate' | 'name' | 'provider' | 'params' | 'context' | 'license';
type License = 'ALL' | AIModel['license'];

const paramScore = (m: AIModel) => {
  if (!paramsDisclosed(m)) return -1;
  const nums = [...m.parameters.matchAll(/([\d.]+)\s*([TB])/g)].map((x) => Number(x[1]) * (x[2] === 'T' ? 1000 : 1));
  return nums.length ? Math.max(...nums) : -1;
};

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: 'name', label: '模型' },
  { key: 'provider', label: '廠商' },
  { key: 'releaseDate', label: '發佈日' },
  { key: 'params', label: '參數' },
  { key: 'context', label: '上下文' },
  { key: 'license', label: '授權' },
  { key: null, label: '類別' },
  { key: null, label: '模態' },
];

export const CompareView: React.FC<{ models: AIModel[]; years: string[] }> = ({ models, years }) => {
  const [sortKey, setSortKey] = useState<SortKey>('releaseDate');
  const [asc, setAsc] = useState(false);
  const [license, setLicense] = useState<License>('ALL');
  const [onlyReasoning, setOnlyReasoning] = useState(false);
  const [year, setYear] = useState('ALL');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = models.filter(
      (m) =>
        (license === 'ALL' || m.license === license) &&
        (!onlyReasoning || m.isReasoning) &&
        (year === 'ALL' || m.releaseDate.startsWith(year))
    );
    const val = (m: AIModel): number | string => {
      switch (sortKey) {
        case 'releaseDate':
          return toTime(m.releaseDate);
        case 'params':
          return paramScore(m);
        case 'context':
          return m.contextTokens;
        case 'provider':
          return m.provider;
        case 'license':
          return m.license;
        default:
          return m.name.toLowerCase();
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return asc ? c : -c;
    });
  }, [models, license, onlyReasoning, year, sortKey, asc]);

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === 'name' || k === 'provider');
    }
  };

  const selectCls = 'rounded-sm border border-rule bg-ink-raised px-2 py-1.5 text-sm text-paper';

  return (
    <section aria-label="規格比較" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule-soft px-5 py-3 text-sm">
        <label className="flex items-center gap-2 text-muted">
          授權
          <select value={license} onChange={(e) => setLicense(e.target.value as License)} className={selectCls}>
            <option value="ALL">全部</option>
            <option value="Proprietary">閉源</option>
            <option value="Open-Weights">開放權重</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted">
          年份
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
            <option value="ALL">全部</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-paper-dim">
          <input
            type="checkbox"
            checked={onlyReasoning}
            onChange={(e) => setOnlyReasoning(e.target.checked)}
            className="h-4 w-4 accent-paper"
          />
          只看推理模型
        </label>
        <span className="ml-auto text-muted tabular-nums">{rows.length} 款</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-raised">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={c.key === sortKey ? (asc ? 'ascending' : 'descending') : undefined}
                  className="border-b border-rule px-4 py-2.5 text-left text-2xs font-medium whitespace-nowrap text-muted"
                >
                  {c.key ? (
                    <button
                      type="button"
                      onClick={() => sortBy(c.key!)}
                      className={`inline-flex items-center gap-1 hover:text-paper ${c.key === sortKey ? 'text-paper' : ''}`}
                    >
                      {c.label}
                      {c.key === sortKey &&
                        (asc ? <ArrowUp aria-hidden className="h-3 w-3" /> : <ArrowDown aria-hidden className="h-3 w-3" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const meta = PROVIDERS[m.provider];
              const expanded = open === m.id;
              return (
                <React.Fragment key={m.id}>
                  <tr className={`border-b border-rule-soft ${expanded ? 'bg-ink-raised' : 'hover:bg-ink-raised/60'}`}>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : m.id)}
                        aria-expanded={expanded}
                        className="flex items-center gap-2.5 text-left font-medium"
                      >
                        <ChevronRight aria-hidden className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        <ModelShape model={m} size={9} />
                        <span className={m.isFlagship ? 'flagship' : undefined}>{m.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-paper-dim">
                      <span className="inline-flex items-center gap-2">
                        <ProviderDot color={meta.color} />
                        {meta.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-paper-dim">{m.releaseDate}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ParamsValue model={m} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ContextValue model={m} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-paper-dim">{LICENSE_LABEL[m.license]}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-paper-dim">
                      {categoryLabel(m)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-paper-dim">
                      {m.modalities.map((x) => MODALITY_LABEL[x] ?? x).join('・')}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-rule-soft bg-ink-raised">
                      <td colSpan={COLUMNS.length} className="px-4 pt-0 pb-4 pl-12">
                        <p className="max-w-[75ch] leading-relaxed text-paper-dim">{m.highlights}</p>
                        <a
                          href={m.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-paper underline"
                        >
                          官方頁面
                        </a>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-10 text-sm text-muted">沒有符合條件的模型，試著放寬授權、年份或推理條件。</p>}
      </div>
    </section>
  );
};
