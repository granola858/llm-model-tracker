import type { ProviderId } from '../types';

// 這個檔案只能有型別匯入，測試會直接用 Node 載入

const REPO = 'granola858/llm-model-tracker';
// Dependabot 的 PR 只動 workflow 版本，跟模型資料無關
const MERGED_PRS = 'is:pr is:merged -author:app/dependabot';

// 下拉清單抓的條件與「查看 PR」連結共用同一組條件，兩邊才對得上
export const PR_LIST_URL = `https://github.com/${REPO}/pulls?q=${encodeURIComponent(MERGED_PRS)}`;
export const MERGED_PRS_API_URL = `https://api.github.com/search/issues?per_page=10&sort=updated&order=desc&q=${encodeURIComponent(`repo:${REPO} ${MERGED_PRS}`)}`;

const VALID_PROVIDERS = new Set<ProviderId>([
  'OpenAI',
  'Anthropic',
  'Google',
  'Meta',
  'xAI',
  'Mistral',
  'DeepSeek',
  'Qwen',
]);

// scripts/fetch-models.mjs 產生的 PR 內文格式：### 模型名稱（廠商，YYYY-MM-DD）
const MODEL_HEADING_RE = /^###\s+(.+?)（([^，）]+)，(\d{4}-\d{2}-\d{2})）\s*$/gm;

const SEEN_PR_KEY = 'llm_tracker_merged_pr_seen_v1';
const FIRST_VISIT_RECENT_MS = 14 * 24 * 60 * 60 * 1000;

export interface GitHubSearchPrItem {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  closed_at?: unknown;
  body?: unknown;
  pull_request?: {
    merged_at?: unknown;
  } | null;
}

export interface ParsedPrModel {
  name: string;
  provider?: ProviderId;
  releaseDate?: string;
}

export interface MergedModelEntry {
  key: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  mergedAt: string;
  name: string;
  provider?: ProviderId;
  releaseDate?: string;
}

/** 從自動更新 PR 內文解析出新增的模型列表 */
export function parseMergedPrModels(body: string | null | undefined): ParsedPrModel[] {
  if (!body) return [];
  const models: ParsedPrModel[] = [];
  for (const match of body.matchAll(MODEL_HEADING_RE)) {
    const name = match[1].trim();
    const rawProvider = match[2].trim();
    const releaseDate = match[3].trim();
    if (!name) continue;
    const provider = VALID_PROVIDERS.has(rawProvider as ProviderId) ? (rawProvider as ProviderId) : undefined;
    models.push({ name, provider, releaseDate });
  }
  return models;
}

/** 將 GitHub Search Issues API 回傳的已合併 PR 轉為下拉清單項目，依合併時間由新到舊排序 */
export function extractMergedEntries(items: unknown): MergedModelEntry[] {
  if (!Array.isArray(items)) return [];

  const normalized: Array<{
    prNumber: number;
    prUrl: string;
    prTitle: string;
    mergedAt: string;
    mergedMs: number;
    body: string;
  }> = [];

  for (const raw of items as GitHubSearchPrItem[]) {
    if (!raw || typeof raw.number !== 'number' || typeof raw.html_url !== 'string') continue;
    const mergedAt =
      typeof raw.pull_request?.merged_at === 'string'
        ? raw.pull_request.merged_at
        : typeof raw.closed_at === 'string'
          ? raw.closed_at
          : '';
    const mergedMs = mergedAt ? Date.parse(mergedAt) : 0;
    normalized.push({
      prNumber: raw.number,
      prUrl: raw.html_url,
      prTitle: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `PR #${raw.number}`,
      mergedAt,
      mergedMs: Number.isNaN(mergedMs) ? 0 : mergedMs,
      body: typeof raw.body === 'string' ? raw.body : '',
    });
  }

  normalized.sort((a, b) => b.mergedMs - a.mergedMs || b.prNumber - a.prNumber);

  const entries: MergedModelEntry[] = [];
  for (const pr of normalized) {
    const parsed = parseMergedPrModels(pr.body);
    if (parsed.length > 0) {
      parsed.forEach((m, idx) => {
        entries.push({
          key: `${pr.prNumber}:${idx}`,
          prNumber: pr.prNumber,
          prUrl: pr.prUrl,
          prTitle: pr.prTitle,
          mergedAt: pr.mergedAt,
          name: m.name,
          provider: m.provider,
          releaseDate: m.releaseDate,
        });
      });
    } else {
      entries.push({
        key: `${pr.prNumber}:pr`,
        prNumber: pr.prNumber,
        prUrl: pr.prUrl,
        prTitle: pr.prTitle,
        mergedAt: pr.mergedAt,
        name: pr.prTitle,
      });
    }
  }
  return entries;
}

/** 計算尚未看過的新合併模型筆數；首次開啟以最近 14 天內的合併為準 */
export function countUnreadMerged(
  entries: MergedModelEntry[],
  lastSeenPr: number | null,
  nowMs: number = Date.now()
): number {
  if (entries.length === 0) return 0;
  if (lastSeenPr !== null) {
    return entries.filter((e) => e.prNumber > lastSeenPr).length;
  }
  const cutoff = nowMs - FIRST_VISIT_RECENT_MS;
  return entries.filter((e) => {
    const ms = e.mergedAt ? Date.parse(e.mergedAt) : 0;
    return !Number.isNaN(ms) && ms >= cutoff;
  }).length;
}

export function readLastSeenMergedPr(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_PR_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeLastSeenMergedPr(prNumber: number): void {
  try {
    localStorage.setItem(SEEN_PR_KEY, String(prNumber));
  } catch {
    // 無痕模式等情況寫不進去，不影響介面
  }
}

/** 合併紀錄按鈕的 aria-label 與 tooltip；null 表示還沒查到或查詢失敗（快照見 tests/） */
export function prLinkLabel(count: number | null): string {
  if (count === null) return '最近合併的模型';
  return count === 0 ? '最近合併的模型：沒有新合併' : `最近合併的模型：${count} 筆新合併`;
}
