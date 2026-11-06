import React from 'react';
import { AIModel } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { VisitBaseline, shortDate, toTime, todayParts } from '../lib/format';
import { ModelShape } from './marks';

interface Props {
  now: Date;
  models: AIModel[]; // 已篩選、由新到舊
  baseline: VisitBaseline;
  onPick: (id: string) => void;
}

const FALLBACK_COUNT = 5;

// memo：hover 時間軸時 props 不變，這一欄不必跟著重繪
export const TodaySheet = React.memo(function TodaySheet({ now, models, baseline, onPick }: Props) {
  const t = todayParts(now);
  const fresh = models.filter((m) => toTime(m.releaseDate) > baseline.since);
  const list = fresh.length ? fresh : models.slice(0, FALLBACK_COUNT);
  const heading = baseline.firstVisit ? '最近 30 天' : '上次造訪後';
  // 日曆慣例：平日黑字；週日或當天有旗艦發佈才印紅
  const iso = `${t.year}-${String(now.getMonth() + 1).padStart(2, '0')}-${t.day}`;
  const redDay = now.getDay() === 0 || models.some((m) => m.releaseDate === iso && m.isFlagship);

  return (
    <aside
      aria-label="今天"
      className="flex flex-col bg-paper lg:h-full text-paper-ink lg:min-h-0 lg:overflow-y-auto"
    >
      <div className="sheet-tear flex items-end gap-5 px-6 pt-5 pb-4 lg:flex-col lg:items-center lg:gap-0 lg:pt-7 lg:text-center">
        <p className="sr-only">
          {t.year}年{t.month}{Number(t.day)}日 {t.weekday}
        </p>
        <div aria-hidden className="lg:order-1">
          <p className="text-base font-bold tabular-nums">
            {t.year}　{t.month}
          </p>
        </div>
        <p
          aria-hidden
          className={`order-first text-[5.5rem] leading-[0.85] font-black tracking-[-0.04em] tabular-nums lg:order-2 lg:mt-2 lg:text-[9.5rem] ${
            redDay ? 'text-cinnabar' : 'text-paper-ink'
          }`}
        >
          {t.day}
        </p>
        <p aria-hidden className="text-lg font-bold lg:order-3 lg:mt-2">
          {t.weekday}
        </p>
      </div>

      <div className="mx-6 border-t-2 border-paper-ink pt-3 pb-5">
        <h2 className="flex items-baseline justify-between text-sm font-bold">
          {fresh.length ? heading : `${heading}沒有新發佈`}
          {fresh.length > 0 && <span className="text-almanac tabular-nums">{fresh.length} 款</span>}
        </h2>
        {!fresh.length && <p className="mt-1 text-xs text-paper-muted">最近發佈</p>}
        <ul className="mt-2">
          {list.map((m) => (
            <li key={m.id} className="border-b border-paper-rule last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(m.id)}
                className="flex w-full items-center gap-2.5 py-2 text-left text-sm hover:underline focus-visible:outline-paper-ink"
              >
                <ModelShape model={m} size={9} onPaper />
                <span className={`min-w-0 flex-1 truncate ${m.isFlagship ? 'font-bold text-cinnabar' : ''}`}>
                  {m.name.split(' (')[0]}
                </span>
                <span className="sr-only">{PROVIDERS[m.provider].name}</span>
                <span className="text-xs text-paper-muted tabular-nums">{shortDate(m.releaseDate)}</span>
              </button>
            </li>
          ))}
        </ul>
        {!list.length && <p className="mt-2 text-sm text-paper-muted">篩選條件下沒有模型。</p>}
      </div>
    </aside>
  );
});
