import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { ProviderId } from './types';
import { INITIAL_MODELS, PROVIDERS } from './data/modelsData';
import {
  ALL_PROVIDERS,
  TabId,
  applyFlagshipPref,
  matchesQuery,
  readFlagshipPref,
  readUrlState,
  readVisitBaseline,
  toTime,
  writeUrlState,
} from './lib/format';
import { TimelineView } from './components/TimelineView';
import { TodaySheet } from './components/TodaySheet';
import { NewsColumn } from './components/NewsColumn';
import { CompareView } from './components/CompareView';
import { StatsView } from './components/StatsView';
import { ProviderDot } from './components/marks';

const TABS: { id: TabId; label: string }[] = [
  { id: 'timeline', label: '時間軸' },
  { id: 'compare', label: '規格比較' },
  { id: 'stats', label: '統計' },
];

// 狀態停下來多久才寫進網址。Safari 30 秒內超過 100 次 replaceState 會丟例外，500 ms 最多 60 次
const URL_SYNC_DELAY = 500;

export const App: React.FC = () => {
  const initial = useMemo(readUrlState, []);
  const now = useMemo(() => new Date(), []);
  const baseline = useMemo(() => readVisitBaseline(now.getTime()), [now]);

  const [tab, setTab] = useState<TabId>(initial.tab);
  const [providers, setProviders] = useState<ProviderId[]>(initial.providers);
  const [query, setQuery] = useState(initial.q);
  const [year, setYear] = useState(initial.year);
  const [activeId, setActiveId] = useState(initial.model);
  const [showFlagship, setShowFlagship] = useState(readFlagshipPref);
  // 在繪製前套上，避免先閃一下燙金再消失
  useLayoutEffect(() => applyFlagshipPref(showFlagship), [showFlagship]);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      INITIAL_MODELS.filter((m) => providers.includes(m.provider) && matchesQuery(m, query)).sort(
        (a, b) => toTime(a.releaseDate) - toTime(b.releaseDate)
      ),
    [providers, query]
  );
  const newestFirst = useMemo(() => [...filtered].reverse(), [filtered]);
  const years = useMemo(
    () => Array.from({ length: now.getFullYear() - 2019 }, (_, i) => String(2020 + i)),
    [now]
  );
  const freshCount = filtered.filter((m) => toTime(m.releaseDate) > baseline.since).length;

  // 選中的模型被篩掉時，改指向篩選後最新的一筆
  const effectiveActive = filtered.some((m) => m.id === activeId) ? activeId : newestFirst[0]?.id ?? '';

  // hover 掃過時間軸、連續輸入搜尋都會一直改狀態，等停下來才同步網址
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        writeUrlState({
          tab,
          providers,
          q: query,
          year,
          model: effectiveActive === newestFirst[0]?.id ? '' : effectiveActive,
        }),
      URL_SYNC_DELAY
    );
    return () => window.clearTimeout(timer);
  }, [tab, providers, query, year, effectiveActive, newestFirst]);

  // 「/」聚焦搜尋
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleProvider = (p: ProviderId) =>
    setProviders((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      return ALL_PROVIDERS.filter((x) => next.includes(x));
    });
  const allOn = providers.length === ALL_PROVIDERS.length;

  // 保持同一個函式，TodaySheet 才不會跟著 hover 重繪
  const pickModel = useCallback((id: string) => {
    const m = INITIAL_MODELS.find((x) => x.id === id);
    if (m) setYear((y) => (y !== 'ALL' && !m.releaseDate.startsWith(y) ? 'ALL' : y));
    setActiveId(id);
    setTab('timeline');
  }, []);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-rule px-5 py-3 lg:px-6">
        <h1 className="text-lg font-black tracking-wide">AI 模型演進追蹤器</h1>
        <div role="tablist" aria-label="檢視" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`rounded-sm px-3.5 py-1.5 text-sm font-medium ${
                tab === t.id ? 'bg-paper text-ink' : 'text-paper-dim hover:bg-ink-raised hover:text-paper'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-72">
          <label htmlFor="search" className="sr-only">
            搜尋模型
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="搜尋模型、參數、關鍵字"
            className="w-full rounded-sm border border-rule bg-ink-raised py-2 pr-9 pl-9 text-sm text-paper focus:border-paper-dim focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm border border-rule px-1.5 text-2xs text-muted">
            /
          </kbd>
        </div>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-rule-soft px-5 py-2.5 lg:px-6">
        <span className="sr-only">廠商篩選</span>
        <button
          type="button"
          onClick={() => setProviders(allOn ? [] : ALL_PROVIDERS)}
          className="shrink-0 rounded-sm border border-rule px-3 py-1 text-sm text-paper-dim hover:text-paper"
        >
          {allOn ? '全部取消' : '全部'}
        </button>
        {ALL_PROVIDERS.map((p) => {
          const on = providers.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => toggleProvider(p)}
              className={`flex shrink-0 items-center gap-2 rounded-sm border px-3 py-1 text-sm ${
                on ? 'border-paper-dim text-paper' : 'border-rule-soft text-muted line-through decoration-muted hover:text-paper-dim'
              }`}
            >
              <ProviderDot color={on ? PROVIDERS[p].color : '#5e554b'} />
              {PROVIDERS[p].name}
            </button>
          );
        })}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-rule" />
        <button
          type="button"
          aria-pressed={showFlagship}
          onClick={() => setShowFlagship((v) => !v)}
          className={`flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-1 text-sm ${
            showFlagship ? 'border-paper-dim text-paper' : 'border-rule-soft text-muted line-through decoration-muted hover:text-paper-dim'
          }`}
        >
          <Sparkles aria-hidden className={`h-3.5 w-3.5 ${showFlagship ? 'text-gold-ink' : ''}`} />
          <span className="flagship">旗艦</span>
        </button>
        {freshCount > 0 && (
          <span className="ml-auto shrink-0 pl-4 text-sm font-medium text-almanac-ink">
            {baseline.firstVisit ? '最近 30 天' : '上次造訪後'} {freshCount} 款新發佈
          </span>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'timeline' && (
          <div
            role="tabpanel"
            id="panel-timeline"
            aria-labelledby="tab-timeline"
            className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_17rem_21rem]"
          >
            <div className="order-2 flex min-h-[34rem] flex-col lg:order-1 lg:min-h-0">
              <TimelineView
                models={filtered}
                providers={providers}
                activeId={effectiveActive}
                onActive={setActiveId}
                since={baseline.since}
                year={year}
                onYear={setYear}
                now={now}
              />
            </div>
            <div className="order-1 lg:order-2 lg:min-h-0">
              <TodaySheet now={now} models={newestFirst} providers={providers} baseline={baseline} onPick={pickModel} />
            </div>
            <div className="order-3 lg:min-h-0">
              <NewsColumn />
            </div>
          </div>
        )}
        {tab === 'compare' && (
          <div role="tabpanel" id="panel-compare" aria-labelledby="tab-compare" className="flex min-h-0 flex-1 flex-col">
            <CompareView models={newestFirst} years={[...years].reverse()} />
          </div>
        )}
        {tab === 'stats' && (
          <div role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" className="flex min-h-0 flex-1 flex-col">
            <StatsView models={filtered} providers={providers} years={years} now={now} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
