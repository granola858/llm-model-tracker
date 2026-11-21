import React, { useCallback, useEffect, useState } from 'react';
import { PanelRightClose, PanelRightOpen, RefreshCw } from 'lucide-react';
import { NewsDataPayload, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { ALL_PROVIDERS, newsTime, stripHtml } from '../lib/format';
import { ProviderDot } from './marks';

type Status = 'loading' | 'ready' | 'error';
const TOPICS = ['ALL', ...ALL_PROVIDERS, 'General'] as const;
const topicLabel = (t: string) => (t === 'ALL' ? '全部' : t === 'General' ? '綜合產業' : PROVIDERS[t as ProviderId].name);

interface NewsColumnProps {
  collapsed: boolean;
  onToggle: () => void;
}

// memo：props 穩定，hover 時間軸時不必跟著重繪
export const NewsColumn = React.memo(function NewsColumn({ collapsed, onToggle }: NewsColumnProps) {
  const [payload, setPayload] = useState<NewsDataPayload | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [topic, setTopic] = useState<string>('ALL');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`./data/news.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(String(res.status));
      setPayload((await res.json()) as NewsDataPayload);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = (payload?.items ?? []).filter((i) => topic === 'ALL' || (i.providerTag ?? 'General') === topic);

  if (collapsed) {
    return (
      <section aria-labelledby="news-h" className="flex h-full flex-col border-t border-rule-soft lg:border-t-0 lg:border-l">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label="展開新聞欄"
          title="展開新聞欄"
          className="flex w-full items-center justify-between px-5 py-3 text-muted hover:bg-ink-raised hover:text-paper lg:h-full lg:flex-col lg:justify-start lg:gap-3 lg:px-0 lg:py-3"
        >
          <span className="flex items-center gap-2 lg:flex-col lg:gap-3">
            <span className="grid h-8 w-8 place-items-center">
              <PanelRightOpen aria-hidden className="h-4 w-4" />
            </span>
            <span id="news-h" className="text-sm font-bold lg:text-xs lg:tracking-widest lg:[writing-mode:vertical-rl]">
              新聞
            </span>
          </span>
          <span className="text-2xs lg:hidden">展開</span>
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="news-h" className="flex h-full flex-col border-rule-soft lg:min-h-0 lg:border-l">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-soft px-5 py-3">
        <h2 id="news-h" className="text-base font-bold whitespace-nowrap">
          新聞
        </h2>
        {payload?.lastUpdated && (
          <span className="text-2xs whitespace-nowrap text-muted tabular-nums">更新於 {newsTime(payload.lastUpdated)}</span>
        )}
        <label className="order-last flex w-full items-center gap-2 text-2xs text-muted">
          主題
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1 rounded-sm border border-rule bg-ink-raised px-2 py-1.5 text-sm text-paper"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {topicLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={load}
            disabled={status === 'loading'}
            aria-label="重新讀取新聞"
            title="重新讀取新聞"
            className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-ink-raised hover:text-paper disabled:opacity-50"
          >
            <RefreshCw aria-hidden className={`h-4 w-4 ${status === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={true}
            aria-label="收折新聞欄"
            title="收折新聞欄"
            className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-ink-raised hover:text-paper"
          >
            <PanelRightClose aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-busy={status === 'loading'}>
        {status === 'loading' && !payload && <p className="py-6 text-sm text-muted">讀取新聞中…</p>}
        {status === 'error' && (
          <div className="py-6 text-sm">
            <p>新聞讀取失敗，可能是網路中斷或 news.json 還沒產生。</p>
            <button type="button" onClick={load} className="mt-2 text-paper underline">
              再試一次
            </button>
          </div>
        )}
        {status !== 'error' && payload && items.length === 0 && (
          <p className="py-6 text-sm text-muted">「{topicLabel(topic)}」目前沒有新聞。</p>
        )}
        <ul>
          {items.map((item) => {
            const tag = item.providerTag && item.providerTag !== 'General' ? PROVIDERS[item.providerTag] : null;
            return (
              <li key={item.id} className="border-b border-rule-soft last:border-b-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block py-3">
                  <span className="flex items-center gap-2 text-2xs text-muted tabular-nums">
                    {tag && <ProviderDot color={tag.color} />}
                    {newsTime(item.publishedAt)}・{item.source}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-balance group-hover:underline">
                    {stripHtml(item.title)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
});
