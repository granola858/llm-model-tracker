import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AIModel, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { categoryLabel, LICENSE_LABEL, MODALITY_LABEL, toTime } from '../lib/format';
import { ContextValue, ModelShape, ParamsValue, ProviderDot } from './marks';
import { LabelSpot, labelText, layoutLabels, measureLabel, resetLabelMeasure, rowOffset, LABEL } from '../lib/laneLabels';

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
/** 「全部」檢視每條泳道最多標幾個（最新的優先）；單一年份則全部都試著標 */
const ALL_VIEW_LABELS = 3;

interface Segment {
  label: string;
  start: number;
  end: number;
  from: number; // 0–1 起點
  to: number;
}

/**
 * 日期 → 軌道上的百分比。範圍外沿最近一段的比例往外延伸，
 * 切換年份時移出範圍的點才會朝正確方向滑出去，而不是全部擠在邊上。
 */
const makePos = (segments: Segment[]) => (t: number) => {
  const seg = t < segments[0].start ? segments[0] : segments.find((s) => t < s.end) ?? segments[segments.length - 1];
  return (seg.from + ((seg.to - seg.from) * (t - seg.start)) / (seg.end - seg.start)) * 100;
};

/** 範圍外的點只需要滑出邊界外一點點再淡出，不必飛到幾千 % 外 */
const clampX = (x: number) => Math.min(112, Math.max(-12, x));

const tickKey = (s: { start: number; label: string }) => `${s.start}|${s.label}`;

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
  const pos = useMemo(() => makePos(segments), [segments]);

  // all：這家廠商的所有模型，一律渲染，範圍外的淡出，切換年份時才能沿軸滑動
  // models：目前範圍內、可互動的那些
  const lanes = useMemo(
    () =>
      providers.map((p) => {
        const all = models.filter((m) => m.provider === p);
        return {
          provider: p,
          all,
          models: all.filter((m) => {
            const t = toTime(m.releaseDate);
            return t >= rangeStart && t < rangeEnd;
          }),
        };
      }),
    [providers, models, rangeStart, rangeEnd]
  );

  // 所有可能出現的刻度（每年一月的年份 + 每個月），只顯示目前檢視用到的，其餘跟著軸滑動並淡出
  const tickPool = useMemo(() => {
    const list: { start: number; label: string }[] = [];
    for (let y = FIRST_YEAR; y <= lastYear; y++) {
      list.push({ start: new Date(y, 0, 1).getTime(), label: String(y) });
      const lastMonth = y === lastYear ? now.getMonth() : 11;
      for (let mo = 0; mo <= lastMonth; mo++) list.push({ start: new Date(y, mo, 1).getTime(), label: `${mo + 1}月` });
    }
    return list;
  }, [lastYear, now]);
  const shownTicks = useMemo(
    () =>
      new Set(
        segments.filter((s, i) => i === 0 || i === segments.length - 1 || s.to - s.from >= 0.06).map(tickKey)
      ),
    [segments]
  );

  const visible = lanes.flatMap((l) => l.models);
  const active = models.find((m) => m.id === activeId) ?? models[models.length - 1];
  const focusId = visible.some((m) => m.id === active?.id) ? active?.id : visible[visible.length - 1]?.id;

  // 標籤排版要知道軌道的實際寬高（所有泳道等寬等高，量第一條就好）
  const [track, setTrack] = useState({ w: 0, h: 0 });
  const trackRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setTrack((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 網頁字型載入後寬度會變，重量一次
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const bump = () => {
      resetLabelMeasure();
      setFontEpoch((n) => n + 1);
    };
    fonts.addEventListener('loadingdone', bump);
    void fonts.ready.then(bump);
    return () => fonts.removeEventListener('loadingdone', bump);
  }, []);

  const labelSpots = useMemo(() => {
    const spots = new Map<string, LabelSpot>();
    if (!track.w) return spots;
    for (const lane of lanes) {
      const pool = year === 'ALL' ? lane.models.slice(-ALL_VIEW_LABELS) : lane.models;
      const items = [...pool].reverse().map((m) => ({
        id: m.id,
        x: (pos(toTime(m.releaseDate)) / 100) * track.w,
        w: measureLabel(labelText(m), m.isFlagship),
      }));
      for (const [id, spot] of layoutLabels(items, track.w, track.h)) spots.set(id, spot);
    }
    return spots;
    // fontEpoch：字型換了，量出來的寬度不同，要重排
  }, [lanes, pos, track, year, fontEpoch]);

  // 切換過年份之後，標籤等圓點滑定位才淡入；第一次載入不播
  const [shownYear, setShownYear] = useState(year);
  const [zoomed, setZoomed] = useState(false);
  if (shownYear !== year) {
    setShownYear(year);
    setZoomed(true);
  }

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
                return (
                  // overflow-x-clip：滑出範圍的點不撐開捲動寬度；clip 不是捲動容器，廠商名的 sticky 照常
                  <div
                    key={lane.provider}
                    className="flex min-h-14 flex-1 items-stretch overflow-x-clip border-b border-dashed border-rule-soft"
                  >
                    <div className="sticky left-0 z-20 flex w-24 shrink-0 items-center gap-2 bg-ink pl-4 text-sm font-medium text-paper-dim">
                      <ProviderDot color={meta.color} />
                      {meta.name}
                    </div>
                    <div ref={laneIdx === 0 ? trackRef : undefined} className="relative mr-10 flex-1">
                      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-rule-soft" />
                      {lane.all.map((m) => {
                        const idx = lane.models.indexOf(m);
                        const out = idx < 0;
                        const isNew = toTime(m.releaseDate) > since;
                        const isActive = m.id === active?.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            data-id={m.id}
                            data-out={out || undefined}
                            inert={out}
                            tabIndex={m.id === focusId ? 0 : -1}
                            onMouseEnter={() => onActive(m.id)}
                            onFocus={() => onActive(m.id)}
                            onClick={() => onActive(m.id)}
                            onKeyDown={(e) => onKey(e, laneIdx, idx)}
                            aria-label={`${m.name}，${meta.name}，${m.releaseDate}${m.isReasoning ? '，推理模型' : ''}${
                              isNew ? '，上次造訪後新增' : ''
                            }`}
                            aria-pressed={isActive}
                            className="tl-move absolute top-1/2 z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                            style={{ left: `${clampX(pos(toTime(m.releaseDate)))}%` }}
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
                        );
                      })}
                      {lane.models.map((m) => {
                        const spot = labelSpots.get(m.id);
                        if (!spot) return null;
                        const x = pos(toTime(m.releaseDate));
                        const end = spot.anchor === 'end';
                        const offset = `calc(50% + ${rowOffset(spot.row)}px)`;
                        return (
                          <span
                            // 換年份就換一個元素，才能等圓點滑定位後重新淡入
                            key={`${year}:${m.id}`}
                            aria-hidden
                            className={`tl-move pointer-events-none absolute hidden whitespace-nowrap text-xs leading-4 lg:block ${
                              zoomed ? 'tl-label-in' : ''
                            } ${
                              m.isFlagship
                                ? 'font-bold text-cinnabar-ink'
                                : m.id === active?.id
                                  ? 'text-paper'
                                  : 'text-paper-dim'
                            }`}
                            style={{
                              left: `calc(${x}% ${end ? '-' : '+'} ${LABEL.dotGap}px)`,
                              transform: end ? 'translateX(-100%)' : undefined,
                              ...(spot.side === 'above' ? { bottom: offset } : { top: offset }),
                            }}
                          >
                            {labelText(m)}
                          </span>
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
            <div className="flex h-8 shrink-0 overflow-x-clip border-b border-rule">
              <div className="sticky left-0 z-20 w-24 shrink-0 bg-ink" />
              <div className="relative mr-10 flex-1">
                {tickPool.map((s) => {
                  const key = tickKey(s);
                  const out = !shownTicks.has(key);
                  return (
                    <span
                      key={key}
                      aria-hidden={out || undefined}
                      data-out={out || undefined}
                      className="tl-move absolute top-1 whitespace-nowrap border-l border-rule pl-1.5 text-2xs text-muted tabular-nums"
                      style={{ left: `${clampX(pos(s.start))}%` }}
                    >
                      {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {active && (
        // 隱形撐高與選中的詳情疊在同一格，面板高度固定為最高者：
        // 切換選取時上方泳道不會位移，避免 hover 選取在點之間來回跳
        <div className="grid shrink-0 border-t border-rule bg-ink-raised px-5 py-4">
          <DetailSizer models={models} since={since} />
          <div aria-live="polite" className="col-start-1 row-start-1">
            <ModelDetail model={active} isNew={toTime(active.releaseDate) > since} />
          </div>
        </div>
      )}
    </section>
  );
};

const NEW_LABEL = '上次造訪後新增';

/** 估算排版寬度：全形字算 1、其餘算半形 */
const textWidth = (s: string) => {
  let w = 0;
  for (const c of s) w += /[⺀-鿿豈-﫿＀-￯]/.test(c) ? 1 : 0.55;
  return w;
};

const widest = (models: AIModel[], width: (m: AIModel) => number) =>
  models.reduce((a, b) => (width(b) > width(a) ? b : a));

/**
 * 詳情的標題、規格、說明三列高度各自只看自己的內容：每列取最長的那一款，
 * 拼成一份隱形撐高，高度不低於任何一款模型。只在篩選結果改變時重算。
 */
const DetailSizer = React.memo(function DetailSizer({ models, since }: { models: AIModel[]; since: number }) {
  if (!models.length) return null;
  const isNew = (m: AIModel) => toTime(m.releaseDate) > since;
  const head = widest(
    models,
    // 標題是 text-xl，其餘是 text-sm
    (m) =>
      textWidth(m.name) * 1.4 +
      textWidth(PROVIDERS[m.provider].name + categoryLabel(m)) +
      (isNew(m) ? NEW_LABEL.length : 0)
  );
  const specs = widest(models, (m) =>
    textWidth(m.parameters + m.contextWindow + LICENSE_LABEL[m.license] + m.modalities.map((x) => MODALITY_LABEL[x] ?? x).join('・'))
  );
  const text = widest(models, (m) => textWidth(m.highlights));
  return (
    <div aria-hidden className="invisible col-start-1 row-start-1">
      <DetailHead model={head} isNew={isNew(head)} />
      <DetailSpecs model={specs} />
      <DetailText model={text} />
    </div>
  );
});

const ModelDetail: React.FC<{ model: AIModel; isNew: boolean }> = ({ model, isNew }) => (
  <>
    <DetailHead model={model} isNew={isNew} />
    <DetailSpecs model={model} />
    <DetailText model={model} />
  </>
);

const DetailHead: React.FC<{ model: AIModel; isNew: boolean }> = ({ model, isNew }) => {
  const meta = PROVIDERS[model.provider];
  return (
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
      <span className={`text-sm ${model.isFlagship ? 'font-bold text-cinnabar-ink' : 'text-paper-dim'}`}>
        {categoryLabel(model)}
      </span>
      {isNew && <span className="text-sm font-medium text-almanac-ink">{NEW_LABEL}</span>}
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
  );
};

const DetailSpecs: React.FC<{ model: AIModel }> = ({ model }) => (
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
);

const DetailText: React.FC<{ model: AIModel }> = ({ model }) => (
  <p className="mt-2 text-sm leading-relaxed text-paper-dim">{model.highlights}</p>
);

