import React, { useEffect, useState } from 'react';
import { GitPullRequest } from 'lucide-react';
import { PR_COUNT_URL, PR_LIST_URL, prLinkLabel } from '../lib/pullRequests';

// 未登入的搜尋 API 每分鐘只有 10 次額度，回到分頁時最多一分鐘查一次
const REFRESH_GAP = 60_000;

// memo：沒有 props，hover 時間軸時不必跟著重繪
export const PullRequestLink = React.memo(function PullRequestLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let lastFetch = 0;
    const refresh = async () => {
      if (document.hidden || Date.now() - lastFetch < REFRESH_GAP) return;
      lastFetch = Date.now();
      try {
        const res = await fetch(PR_COUNT_URL, { signal: abort.signal });
        if (!res.ok) return;
        const { total_count } = (await res.json()) as { total_count?: unknown };
        if (typeof total_count === 'number') setCount(total_count);
      } catch {
        // 離線或被限流時保留上一次的數字，連結本身不受影響
      }
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      abort.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const label = prLinkLabel(count);
  return (
    <a
      href={PR_LIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-sm hover:bg-ink-raised hover:text-paper ${
        count ? 'text-paper' : 'text-muted'
      }`}
    >
      <GitPullRequest aria-hidden className="h-4 w-4" />
      {count ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 min-w-4 rounded-sm bg-paper px-0.5 text-center text-2xs leading-4 font-bold text-ink"
        >
          {count}
        </span>
      ) : null}
    </a>
  );
});
