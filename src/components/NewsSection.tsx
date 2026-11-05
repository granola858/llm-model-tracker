import React, { useEffect, useState } from 'react';
import { NewsDataPayload, NewsItem, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { Newspaper, RefreshCw, ExternalLink, Clock, Rss, CheckCircle2 } from 'lucide-react';

export const NewsSection: React.FC = () => {
  const [newsPayload, setNewsPayload] = useState<NewsDataPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  const loadStaticNews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`./data/news.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load news.json');
      const data: NewsDataPayload = await res.json();
      setNewsPayload(data);
    } catch (e) {
      console.error('Error loading news.json:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaticNews();
  }, []);

  const items: NewsItem[] = newsPayload?.items || [];
  const filteredItems =
    selectedTag === 'ALL'
      ? items
      : items.filter((item) => item.providerTag === selectedTag);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* 標題與自動化狀態說明 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">
              AI 產業最新新聞動態
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              GitHub Actions 自動更新
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            由 GitHub Actions 排程（每 6 小時）自動執行 <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded">scripts/fetch-news.mjs</code> 聚合官方部落格與權威科技媒體 RSS，並寫入靜態 <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded">public/data/news.json</code>，純前端零 CORS 阻擋。
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center shrink-0">
          {newsPayload?.lastUpdated && (
            <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              最後同步：{formatDate(newsPayload.lastUpdated)}
            </div>
          )}
          <button
            onClick={loadStaticNews}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            重新讀取
          </button>
        </div>
      </div>

      {/* 新聞標籤篩選 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
          <Rss className="w-3.5 h-3.5 text-amber-400" />
          新聞主題篩選：
        </span>
        {(['ALL', 'OpenAI', 'Anthropic', 'Google', 'Meta', 'xAI', 'Mistral', 'DeepSeek', 'Qwen', 'General'] as const).map(
          (tag) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tag === 'ALL' ? '全部新聞' : tag === 'General' ? '綜合 AI 產業' : tag}
              </button>
            );
          }
        )}
      </div>

      {/* 新聞卡片網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => {
          const isKnownProvider = item.providerTag && item.providerTag !== 'General' && PROVIDERS[item.providerTag as ProviderId];
          const badgeStyle = isKnownProvider
            ? `${PROVIDERS[item.providerTag as ProviderId].bgBadge} ${PROVIDERS[item.providerTag as ProviderId].borderBadge}`
            : 'bg-slate-800 text-slate-300 border-slate-700';

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 hover:border-indigo-500/50 rounded-xl p-4 flex flex-col justify-between transition-all hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                    {item.providerTag || 'AI News'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {item.publishedAt.slice(0, 10)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 mb-2">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">{item.source}</span>
                <span className="inline-flex items-center gap-1 text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  閱讀原文
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-10 text-center text-slate-500 text-sm">
            目前此分類暫無新聞項目。
          </div>
        )}
      </div>
    </section>
  );
};
