import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, GitMerge } from 'lucide-react';
import { INITIAL_MODELS, PROVIDERS } from '../data/modelsData';
import { newsTime, shortDate } from '../lib/format';
import {
  MERGED_PRS_API_URL,
  MergedModelEntry,
  PR_LIST_URL,
  countUnreadMerged,
  extractMergedEntries,
  prLinkLabel,
  readLastSeenMergedPr,
  writeLastSeenMergedPr,
} from '../lib/pullRequests';
import { AIModel } from '../types';
import { ModelShape, ProviderDot } from './marks';

// 未登入的搜尋 API 每分鐘只有 10 次額度，回到分頁時最多一分鐘查一次
const REFRESH_GAP = 60_000;

interface PullRequestLinkProps {
  onPick: (id: string) => void;
}

const findDeployedModel = (entry: MergedModelEntry, byKey: Map<string, AIModel>): AIModel | undefined => {
  const key = `${entry.provider ?? ''}:${entry.name.trim().toLowerCase()}`;
  return byKey.get(key) ?? byKey.get(`:${entry.name.trim().toLowerCase()}`);
};

// memo：onPick 穩定，hover 時間軸時不必跟著重繪
export const PullRequestLink = React.memo(function PullRequestLink({ onPick }: PullRequestLinkProps) {
  const [entries, setEntries] = useState<MergedModelEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastSeenPr, setLastSeenPr] = useState<number | null>(readLastSeenMergedPr);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastFetchRef = useRef(0);

  const modelIndex = useMemo(() => {
    const map = new Map<string, AIModel>();
    for (const m of INITIAL_MODELS) {
      const lower = m.name.trim().toLowerCase();
      map.set(`${m.provider}:${lower}`, m);
      if (!map.has(`:${lower}`)) map.set(`:${lower}`, m);
    }
    return map;
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal, force = false) => {
    if (!force && (document.hidden || Date.now() - lastFetchRef.current < REFRESH_GAP)) return;
    lastFetchRef.current = Date.now();
    try {
      const res = await fetch(MERGED_PRS_API_URL, { signal });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = (await res.json()) as { items?: unknown };
      setEntries(extractMergedEntries(data.items));
      setFailed(false);
    } catch {
      if (!signal?.aborted) setFailed(true);
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    const onVisible = () => {
      void refresh(abort.signal);
    };
    void refresh(abort.signal);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      abort.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // 下拉開啟期間若收到新資料，或開啟瞬間，把目前最新的 PR 記為已讀
  const markSeen = useCallback((list: MergedModelEntry[]) => {
    if (list.length === 0) return;
    const maxPr = list.reduce((max, item) => (item.prNumber > max ? item.prNumber : max), 0);
    if (maxPr > 0) {
      setLastSeenPr((prev) => (prev !== null && prev >= maxPr ? prev : maxPr));
      writeLastSeenMergedPr(maxPr);
    }
  }, []);

  useEffect(() => {
    if (open && entries) markSeen(entries);
  }, [open, entries, markSeen]);

  // 點擊外部或按 Escape 關閉下拉清單
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => (entries === null ? null : countUnreadMerged(entries, lastSeenPr)),
    [entries, lastSeenPr]
  );

  const label = prLinkLabel(unreadCount);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      if (entries) markSeen(entries);
      if (entries === null && failed) void refresh(undefined, true);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-sm hover:bg-ink-raised hover:text-paper ${
          open ? 'bg-ink-raised text-paper' : unreadCount ? 'text-paper' : 'text-muted'
        }`}
      >
        <GitMerge aria-hidden className="h-4 w-4" />
        {unreadCount ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 min-w-4 rounded-sm bg-paper px-0.5 text-center text-2xs leading-4 font-bold text-ink"
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          role="region"
          aria-label="最近合併的模型"
          className="absolute top-full right-0 z-50 mt-1.5 w-80 max-w-[calc(100vw-2.5rem)] rounded-sm border border-rule bg-ink-raised text-paper"
        >
          <div className="flex items-center justify-between border-b border-rule px-3.5 py-2.5">
            <span className="text-sm font-bold text-paper">最近合併的模型</span>
            <a
              href={PR_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-2xs text-muted hover:text-paper"
            >
              查看 PR
              <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {entries === null ? (
              <div className="px-3.5 py-4 text-sm text-muted">
                {failed ? '暫時無法讀取 GitHub 合併紀錄' : '載入中…'}
              </div>
            ) : entries.length === 0 ? (
              <div className="px-3.5 py-4 text-sm text-muted">目前沒有自動合併的模型紀錄</div>
            ) : (
              <ul className="divide-y divide-rule-soft">
                {entries.map((entry) => {
                  const deployed = findDeployedModel(entry, modelIndex);
                  const mergedDate = entry.mergedAt ? shortDate(entry.mergedAt.slice(0, 10)) : '';
                  const mergedTitle = entry.mergedAt ? `合併於 ${newsTime(entry.mergedAt)}` : `PR #${entry.prNumber}`;

                  const indicator = deployed ? (
                    <ModelShape model={deployed} size={8} />
                  ) : entry.provider ? (
                    <ProviderDot color={PROVIDERS[entry.provider].color} />
                  ) : (
                    <ProviderDot color="#5e554b" />
                  );

                  const metaLine = [
                    entry.provider ? PROVIDERS[entry.provider].name : null,
                    entry.releaseDate ? `發佈 ${entry.releaseDate}` : null,
                    !deployed && entry.provider ? '待排程部署' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <li key={entry.key} className="flex items-start justify-between gap-2 px-3.5 py-2.5 hover:bg-ink/60">
                      {deployed ? (
                        <button
                          type="button"
                          onClick={() => {
                            onPick(deployed.id);
                            setOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                        >
                          <span className="mt-1.5 flex shrink-0 items-center">{indicator}</span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm ${
                                deployed.isFlagship ? 'flagship' : 'font-medium text-paper'
                              }`}
                            >
                              {entry.name}
                            </span>
                            {metaLine && <span className="mt-0.5 block truncate text-2xs text-muted">{metaLine}</span>}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={entry.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                        >
                          <span className="mt-1.5 flex shrink-0 items-center">{indicator}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-paper">{entry.name}</span>
                            {metaLine && <span className="mt-0.5 block truncate text-2xs text-muted">{metaLine}</span>}
                          </span>
                        </a>
                      )}

                      <a
                        href={entry.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={mergedTitle}
                        className="shrink-0 text-right text-2xs text-muted hover:text-paper"
                      >
                        <span className="block">#{entry.prNumber}</span>
                        {mergedDate && <span className="mt-0.5 block">{mergedDate}</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
