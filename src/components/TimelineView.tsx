import React, { useEffect, useMemo, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { AIModel, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { CATEGORY_LABEL, LICENSE_LABEL, MODALITY_LABEL, toTime } from '../lib/format';
import { ContextValue, ModelShape, ParamsValue, ProviderDot } from './marks';

interface Props {
  models: AIModel[]; // 已篩選、由舊到新
  providers: ProviderId[];
  activeId: string;
  onActive: (id: string) => void;
  since: number;
  year: string;
  onYear: (y: string) => void;
  now: Date;
}

const FIRST_YEAR = 2020;
const DAY = 24 * 60 * 60 * 1000;

interface Segment {
  label: string;
  start: number;
  end: number;
  from: number; // 0–1 起點
  to: number;
}

export const TimelineView: React.FC<Props> = ({ models, providers, activeId, onActive, since, year, onYear, now }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const lastYear = now.getFullYear();
  const axisEnd = now.getTime() + 20 * DAY;

  const years = useMemo(() => {
    const list: { year: string; count: number }[] = [];
    for (let y = FIRST_YEAR; y <= lastYear; y++) {
      list.push({ year: String(y), count: models.filter((m) => m.releaseDate.startsWith(String(y))).length });
    }
    return list;
  }, [models, lastYear]);

  // 非線性時間軸：每年寬度依發佈數量分配，早期稀疏年份自然被壓縮
  const segments = useMemo<Segment[]>(() => {
    const yearRange = (y: number) => ({
      start: new Date(y, 0, 1).getTime(),
      end: y === lastYear ? axisEnd : new Date(y + 1, 0, 1).getTime(),
    });
    if (year !== 'ALL') {
      const y = Number(year);
      const r = yearRange(y);
      const months: Segment[] = [];
      const lastMonth = y === lastYear ? now.getMonth() : 11;
      const total = r.end - r.start;
      for (let mo = 0; mo <= lastMonth; mo++) {
        const s = new Date(y, mo, 1).getTime();
        const e = mo === lastMonth ? r.end : new Date(y, mo + 1, 1).getTime();
        months.push({ label: `${mo + 1}月`, start: s, end: e, from: (s - r.start) / total, to: (e - r.start) / total });
      }
      return months;
    }
    // 最近 90 天另切一段並加權三倍：「今天」這一端最寬，最新發佈不會擠成一團
    const recentStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();
    const countIn = (s: number, e: number) =>
      models.filter((m) => {
        const t = toTime(m.releaseDate);
        return t >= s && t < e;
      }).length;
    const raw: { label: string; start: number; end: number; weight: number }[] = [];
    for (const y of years) {
      const r = yearRange(Number(y.year));
      if (r.end <= recentStart) {
        raw.push({ label: y.year, ...r, weight: Math.max(y.count, 2) });
        continue;
      }
      if (r.start < recentStart) {
        raw.push({ label: y.year, start: r.start, end: recentStart, weight: Math.max(countIn(r.start, recentStart), 2) });
      }
      const s = Math.max(r.start, recentStart);
      // 近 90 天逐月切段：權重依天數分攤，段內維持線性，且每個月都有刻度
      const recentWeight = Math.max(countIn(s, r.end) * 3, 8);
      for (let ms = s; ms < r.end; ) {
        const md = new Date(ms);
        const me = Math.min(new Date(md.getFullYear(), md.getMonth() + 1, 1).getTime(), r.end);
        raw.push({ label: `${md.getMonth() + 1}月`, start: ms, end: me, weight: (recentWeight * (me - ms)) / (r.end - s) });
        ms = me;
      }
    }
    const sum = raw.reduce((a, b) => a + b.weight, 0);
    let acc = 0;
    return raw.map((r) => {
      const seg = { label: r.label, start: r.start, end: r.end, from: acc / sum, to: (acc + r.weight) / sum };
      acc += r.weight;
      return seg;
    });
  }, [years, year, lastYear, axisEnd, now, models]);

  const rangeStart = segments[0].start;
  const rangeEnd = segments[segments.length - 1].end;

  const pos = (date: string) => {
    const t = toTime(date);
    const seg = segments.find((s) => t >= s.start && t < s.end) ?? segments[segments.length - 1];
    const frac = Math.min(1, Math.max(0, (t - seg.start) / (seg.end - seg.start)));
    return (seg.from + (seg.to - seg.from) * frac) * 100;
  };

  const lanes = useMemo(
    () =>
      providers.map((p) => ({
        provider: p,
        models: models.filter((m) => {
          const t = toTime(m.releaseDate);
          return m.provider === p && t >= rangeStart && t < rangeEnd;
        }),
      })),
    [providers, models, rangeStart, rangeEnd]
  );

  const visible = lanes.flatMap((l) => l.models);
  const active = models.find((m) => m.id === activeId) ?? models[models.length - 1];
  const focusId = visible.some((m) => m.id === active?.id) ? active?.id : visible[visible.length - 1]?.id;

  // 手機版：時間軸預設捲到「今天」
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [year]);

  const focusModel = (id: string) => {
    onActive(id);
    requestAnimationFrame(() => lanesRef.current?.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)?.focus());
  };

  const onKey = (e: React.KeyboardEvent, laneIdx: number, idx: number) => {
    const lane = lanes[laneIdx].models;
    const cur = lane[idx];
    let next: AIModel | undefined;
    if (e.key === 'ArrowRight') next = lane[idx + 1];
    else if (e.key === 'ArrowLeft') next = lane[idx - 1];
    else if (e.key === 'Home') next = lane[0];
    else if (e.key === 'End') next = lane[lane.length - 1];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const step = e.key === 'ArrowUp' ? -1 : 1;
      for (let i = laneIdx + step; i >= 0 && i < lanes.length; i += step) {
        const cand = lanes[i].models;
        if (!cand.length) continue;
        const t = toTime(cur.releaseDate);
        next = cand.reduce((a, b) => (Math.abs(toTime(b.releaseDate) - t) < Math.abs(toTime(a.releaseDate) - t) ? b : a));
        break;
      }
    } else return;
    e.preventDefault();
    if (next) focusModel(next.id);
  };

  const labelCount = year === 'ALL' ? 2 : 3;

  return (
    <section aria-label="模型時間軸" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* 年份索引：高度依發佈數量分配 */}
        <nav aria-label="年份" className="flex w-14 shrink-0 flex-col border-r border-rule-soft text-2xs">
          <button
            type="button"
            onClick={() => onYear('ALL')}
            aria-pressed={year === 'ALL'}
            className={`h-10 shrink-0 border-b border-rule-soft font-medium ${
              year === 'ALL' ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper'
            }`}
          >
            全部
          </button>
          {/* 新到舊：最新、最常點的年份緊接在「全部」下方 */}
          {[...years].reverse().map((y) => {
            const on = year === y.year;
            return (
              <button
                type="button"
                key={y.year}
                onClick={() => onYear(on ? 'ALL' : y.year)}
                aria-pressed={on}
                aria-label={`${y.year} 年，${y.count} 款`}
                style={{ flexGrow: Math.max(y.count, 1) }}
                className={`flex min-h-8 basis-0 justify-center border-b border-rule-soft pt-2 tabular-nums ${
                  y.count >= 4 ? 'flex-col items-center' : 'items-start gap-0.5'
                } ${on ? 'bg-paper font-bold text-ink' : 'text-muted hover:bg-ink-raised hover:text-paper'}`}
              >
                {y.count >= 4 ? y.year : y.year.slice(2)}
                <span className={on ? 'text-paper-ink' : 'text-muted'}>
                  {y.count >= 4 ? y.count : `・${y.count}`}
                </span>
              </button>
            );
          })}
        </nav>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-w-[720px] flex-col">
            <div ref={lanesRef} role="group" aria-label="各廠商發佈" className="flex flex-1 flex-col pt-3">
              {lanes.map((lane, laneIdx) => {
                const meta = PROVIDERS[lane.provider];
                const labeled = new Set(lane.models.slice(-labelCount).map((m) => m.id));
                return (
                  <div key={lane.provider} className="flex min-h-14 flex-1 items-stretch border-b border-dashed border-rule-soft">
                    <div className="sticky left-0 z-20 flex w-24 shrink-0 items-center gap-2 bg-ink pl-4 text-sm font-medium text-paper-dim">
                      <ProviderDot color={meta.color} />
                      {meta.name}
                    </div>
                    <div className="relative mr-10 flex-1">
                      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-rule-soft" />
                      {lane.models.map((m, idx) => {
                        const x = pos(m.releaseDate);
                        const isNew = toTime(m.releaseDate) > since;
                        const isActive = m.id === active?.id;
                        const labelIdx = lane.models.length - 1 - idx;
                        const right = x > 78;
                        return (
                          <React.Fragment key={m.id}>
                            <button
                              type="button"
                              data-id={m.id}
                              tabIndex={m.id === focusId ? 0 : -1}
                              onMouseEnter={() => onActive(m.id)}
                              onFocus={() => onActive(m.id)}
                              onClick={() => onActive(m.id)}
                              onKeyDown={(e) => onKey(e, laneIdx, idx)}
                              aria-label={`${m.name}，${meta.name}，${m.releaseDate}${m.isReasoning ? '，推理模型' : ''}${
                                isNew ? '，上次造訪後新增' : ''
                              }`}
                              aria-pressed={isActive}
                              className="absolute top-1/2 z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                              style={{ left: `${x}%` }}
                            >
                              <span
                                className={`grid place-items-center rounded-full p-0.5 ${
                                  isActive ? 'bg-paper' : isNew ? 'bg-almanac-ink' : ''
                                }`}
                              >
                                <span className="grid place-items-center rounded-full bg-ink p-0.5">
                                  <ModelShape model={m} size={isActive ? 12 : 10} />
                                </span>
                              </span>
                            </button>
                            {labeled.has(m.id) && (
                              <span
                                aria-hidden
                                className={`pointer-events-none absolute hidden whitespace-nowrap text-xs lg:block ${
                                  labelIdx === 0 ? 'bottom-1/2 mb-2.5' : 'top-1/2 mt-2.5'
                                } ${m.category === 'Flagship' ? 'font-bold text-cinnabar-ink' : 'text-paper-dim'}`}
                                style={right ? { right: `${100 - x}%`, marginRight: 6 } : { left: `${x}%`, marginLeft: 6 }}
                              >
                                {m.name.split(' (')[0]}
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {lanes.length === 0 && (
                <p className="m-auto text-sm text-muted">沒有選取任何廠商。</p>
              )}
            </div>

            {/* 時間刻度 */}
            <div className="flex h-8 shrink-0 border-b border-rule">
              <div className="sticky left-0 z-20 w-24 shrink-0 bg-ink" />
              <div className="relative mr-10 flex-1">
                {segments.filter((s, i) => i === 0 || i === segments.length - 1 || s.to - s.from >= 0.06).map((s) => (
                  <span
                    key={s.label}
                    className="absolute top-1 border-l border-rule pl-1.5 text-2xs text-muted tabular-nums"
                    style={{ left: `${s.from * 100}%` }}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {active && (
        // 所有模型的詳情疊在同一格隱形撐高，面板高度固定為最高者：
        // 切換選取時上方泳道不會位移，避免 hover 選取在點之間來回跳
        <div className="grid shrink-0 border-t border-rule bg-ink-raised px-5 py-4">
          {models.map((m) => (
            <div key={m.id} aria-hidden className="invisible col-start-1 row-start-1">
              <ModelDetail model={m} isNew={toTime(m.releaseDate) > since} />
            </div>
          ))}
          <div aria-live="polite" className="col-start-1 row-start-1">
            <ModelDetail model={active} isNew={toTime(active.releaseDate) > since} />
          </div>
        </div>
      )}
    </section>
  );
};

const ModelDetail: React.FC<{ model: AIModel; isNew: boolean }> = ({ model, isNew }) => {
  const meta = PROVIDERS[model.provider];
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2.5 text-xl font-bold">
          <ModelShape model={model} size={12} />
          {model.name}
        </h2>
        <span className="flex items-center gap-1.5 text-sm text-paper-dim">
          <ProviderDot color={meta.color} />
          {meta.name}
        </span>
        <span className="text-sm text-paper-dim tabular-nums">{model.releaseDate}</span>
        <span className={`text-sm ${model.category === 'Flagship' ? 'font-bold text-cinnabar-ink' : 'text-paper-dim'}`}>
          {CATEGORY_LABEL[model.category]}
          {model.isReasoning && model.category !== 'Reasoning' ? '・推理' : ''}
        </span>
        {isNew && <span className="text-sm font-medium text-almanac-ink">上次造訪後新增</span>}
        <a
          href={model.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-paper-dim hover:text-paper hover:underline"
        >
          官方頁面
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        {[
          ['參數', <ParamsValue model={model} />],
          ['上下文', <ContextValue model={model} />],
          ['授權', LICENSE_LABEL[model.license]],
          ['模態', model.modalities.map((x) => MODALITY_LABEL[x] ?? x).join('・')],
        ].map(([k, v]) => (
          <div key={k as string} className="flex items-baseline gap-2.5">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">{model.highlights}</p>
    </>
  );
};

