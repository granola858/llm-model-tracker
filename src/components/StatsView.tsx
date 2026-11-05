import React, { useMemo } from 'react';
import { AIModel, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { isEstimated, toTime } from '../lib/format';
import { ProviderDot } from './marks';

interface Props {
  models: AIModel[];
  providers: ProviderId[];
  years: string[];
  now: Date;
}

const PROP = '#8a8178';
const OPEN = '#efe8dc';

export const StatsView: React.FC<Props> = ({ models, providers, years, now }) => {
  const byProvider = useMemo(
    () =>
      providers
        .map((p) => {
          const list = models.filter((m) => m.provider === p);
          return { p, total: list.length, open: list.filter((m) => m.license === 'Open-Weights').length };
        })
        .sort((a, b) => b.total - a.total),
    [models, providers]
  );
  const maxP = Math.max(1, ...byProvider.map((x) => x.total));

  const byYear = useMemo(
    () =>
      years.map((y) => {
        const list = models.filter((m) => m.releaseDate.startsWith(y));
        const open = list.filter((m) => m.license === 'Open-Weights').length;
        return { y, open, prop: list.length - open, total: list.length };
      }),
    [models, years]
  );
  const maxY = Math.max(1, ...byYear.map((x) => x.total));

  return (
    <section aria-label="統計" className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid lg:grid-cols-2">
        <figure className="border-b border-rule-soft px-6 py-5 lg:border-r">
          <figcaption className="mb-4 text-base font-bold">各家收錄數</figcaption>
          <ul className="space-y-2.5">
            {byProvider.map(({ p, total, open }) => (
              <li key={p} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 text-paper-dim">
                  <ProviderDot color={PROVIDERS[p].color} />
                  {PROVIDERS[p].name}
                </span>
                <span className="h-3 bg-ink-sunk">
                  <span className="block h-full" style={{ width: `${(total / maxP) * 100}%`, background: PROVIDERS[p].color }} />
                </span>
                <span className="text-right tabular-nums">
                  {total}
                  <span className="text-2xs text-muted">　開放 {open}</span>
                </span>
              </li>
            ))}
          </ul>
        </figure>

        <figure className="border-b border-rule-soft px-6 py-5">
          <figcaption className="mb-4 flex items-baseline gap-4 text-base font-bold">
            年度發佈密度
            <span className="flex items-center gap-1.5 text-2xs font-normal text-muted">
              <i className="inline-block h-2.5 w-2.5" style={{ background: PROP }} />
              閉源
            </span>
            <span className="flex items-center gap-1.5 text-2xs font-normal text-muted">
              <i className="inline-block h-2.5 w-2.5" style={{ background: OPEN }} />
              開放權重
            </span>
          </figcaption>
          <div className="flex h-48 items-end gap-3">
            {byYear.map(({ y, open, prop, total }) => (
              <div key={y} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-2xs tabular-nums text-paper-dim">{total}</span>
                <div
                  className="flex w-full max-w-12 flex-col-reverse"
                  style={{ height: `${(total / maxY) * 80}%` }}
                  role="img"
                  aria-label={`${y} 年：閉源 ${prop} 款、開放權重 ${open} 款`}
                >
                  <span style={{ flexGrow: prop, background: PROP }} />
                  <span style={{ flexGrow: open, background: OPEN }} />
                </div>
                <span className="text-2xs tabular-nums text-muted">{y}</span>
              </div>
            ))}
          </div>
        </figure>
      </div>

      <ContextChart models={models} now={now} />
    </section>
  );
};

const W = 1000;
const H = 300;
const PAD = { l: 56, r: 24, t: 16, b: 32 };
const TICKS = [
  { v: 2_000, l: '2K' },
  { v: 32_000, l: '32K' },
  { v: 128_000, l: '128K' },
  { v: 1_000_000, l: '1M' },
  { v: 10_000_000, l: '10M' },
];

const ContextChart: React.FC<{ models: AIModel[]; now: Date }> = ({ models, now }) => {
  const t0 = new Date(2020, 0, 1).getTime();
  const t1 = now.getTime();
  const x = (d: string) => PAD.l + ((toTime(d) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => {
    const lo = Math.log10(1_500);
    const hi = Math.log10(12_000_000);
    return PAD.t + (1 - (Math.log10(Math.max(v, 1_500)) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  };
  const years = Array.from({ length: now.getFullYear() - 2019 }, (_, i) => 2020 + i);

  return (
    <figure className="px-6 py-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline gap-4 text-base font-bold">
        上下文長度演進
        <span className="text-2xs font-normal text-muted">對數刻度・空心為估計值</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="各模型上下文長度隨時間變化的散佈圖">
        {TICKS.map((t) => (
          <g key={t.l}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t.v)} y2={y(t.v)} stroke="#2a2520" />
            <text x={PAD.l - 10} y={y(t.v) + 4} textAnchor="end" fontSize="12" fill="#a39a8e">
              {t.l}
            </text>
          </g>
        ))}
        {years.map((yr) => {
          const xx = x(`${yr}-01-01`);
          return (
            <text key={yr} x={xx} y={H - 8} fontSize="12" fill="#a39a8e">
              {yr}
            </text>
          );
        })}
        {models.map((m) => {
          const c = PROVIDERS[m.provider].color;
          const est = isEstimated(m, 'context');
          const cx = x(m.releaseDate);
          const cy = y(m.contextTokens);
          const shape = { fill: est ? '#1a1714' : c, stroke: c, strokeWidth: 2 };
          const title = <title>{`${m.name}・${m.contextWindow}${est ? '（估計）' : ''}・${m.releaseDate}`}</title>;
          // 與時間軸一致：推理模型用菱形
          return m.isReasoning ? (
            <polygon key={m.id} points={`${cx},${cy - 6} ${cx + 6},${cy} ${cx},${cy + 6} ${cx - 6},${cy}`} {...shape}>
              {title}
            </polygon>
          ) : (
            <circle key={m.id} cx={cx} cy={cy} r={5} {...shape}>
              {title}
            </circle>
          );
        })}
      </svg>
    </figure>
  );
};
