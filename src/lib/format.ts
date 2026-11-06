import { AIModel, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';

export const ALL_PROVIDERS = Object.keys(PROVIDERS) as ProviderId[];

export type TabId = 'timeline' | 'compare' | 'stats';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

export const toTime = (date: string) => new Date(`${date}T00:00:00`).getTime();

export const todayParts = (now: Date) => ({
  year: now.getFullYear(),
  month: `${MONTHS[now.getMonth()]}月`,
  day: String(now.getDate()).padStart(2, '0'),
  weekday: `星期${WEEKDAYS[now.getDay()]}`,
});

export const shortDate = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}`;

export const newsTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
};

/** 沒有任何數字的參數描述（如「Next-Gen MoE」）一律視為未公開 */
export const paramsDisclosed = (m: AIModel) => /\d/.test(m.parameters);

export const isEstimated = (m: AIModel, field: 'parameters' | 'context') =>
  m.estimated?.includes(field) ?? false;

export const LICENSE_LABEL: Record<AIModel['license'], string> = {
  Proprietary: '閉源',
  'Open-Weights': '開放權重',
};

export const CATEGORY_LABEL: Record<AIModel['category'], string> = {
  Flagship: '旗艦',
  Reasoning: '推理',
  Lightweight: '輕量',
  Multimodal: '多模態',
  Coding: '程式',
};

/** 分類顯示文字：主要定位，再補上旗艦／推理兩個獨立標記（與主要定位重複時不再寫一次） */
export function categoryLabel(m: Pick<AIModel, 'category' | 'isFlagship' | 'isReasoning'>): string {
  const parts = [CATEGORY_LABEL[m.category]];
  if (m.isFlagship && m.category !== 'Flagship') parts.push(CATEGORY_LABEL.Flagship);
  if (m.isReasoning && m.category !== 'Reasoning') parts.push(CATEGORY_LABEL.Reasoning);
  return parts.join('・');
}

export const MODALITY_LABEL: Record<string, string> = {
  Text: '文字',
  Vision: '視覺',
  Audio: '語音',
  Video: '影片',
  Code: '程式碼',
};

export const matchesQuery = (m: AIModel, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [m.name, m.provider, m.highlights, m.parameters].some((v) => v.toLowerCase().includes(s));
};

/**
 * 「上次造訪」基準：距離上次開啟超過 8 小時才把基準往前推，
 * 避免同一晚重新整理就把新發佈清空。第一次造訪以 30 天前為基準。
 */
const VISIT_KEY = 'llm_tracker_visit_v1';
const SESSION_GAP = 8 * 60 * 60 * 1000;
const FIRST_VISIT_WINDOW = 30 * 24 * 60 * 60 * 1000;

export interface VisitBaseline {
  since: number;
  firstVisit: boolean;
}

export const readVisitBaseline = (now: number): VisitBaseline => {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    const saved = raw ? (JSON.parse(raw) as { baseline: number; lastSeen: number }) : null;
    if (!saved) {
      const baseline = now - FIRST_VISIT_WINDOW;
      localStorage.setItem(VISIT_KEY, JSON.stringify({ baseline, lastSeen: now }));
      return { since: baseline, firstVisit: true };
    }
    const baseline = now - saved.lastSeen > SESSION_GAP ? saved.lastSeen : saved.baseline;
    localStorage.setItem(VISIT_KEY, JSON.stringify({ baseline, lastSeen: now }));
    return { since: baseline, firstVisit: false };
  } catch {
    return { since: now - FIRST_VISIT_WINDOW, firstVisit: true };
  }
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** RSS 標題可能帶 HTML 標籤與實體（如 AT&#038;T），顯示前一律還原成純文字 */
export const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    // 拉丁字之間的彎引號會被中文字型排成全形（Aina’ s），換回 ASCII
    .replace(/([A-Za-z0-9])[’‘]([A-Za-z0-9])/g, "$1'$2")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/* 網址狀態：分頁、廠商、搜尋、年份、選中模型 */
export interface UrlState {
  tab: TabId;
  providers: ProviderId[];
  q: string;
  year: string;
  model: string;
}

export const readUrlState = (): UrlState => {
  const p = new URLSearchParams(window.location.search);
  const tab = p.get('tab');
  const providers = (p.get('p') ?? '')
    .split(',')
    .filter((x): x is ProviderId => (ALL_PROVIDERS as string[]).includes(x));
  return {
    tab: tab === 'compare' || tab === 'stats' ? tab : 'timeline',
    providers: providers.length ? providers : ALL_PROVIDERS,
    q: p.get('q') ?? '',
    year: p.get('y') ?? 'ALL',
    model: p.get('m') ?? '',
  };
};

export const writeUrlState = (s: UrlState) => {
  const p = new URLSearchParams();
  if (s.tab !== 'timeline') p.set('tab', s.tab);
  if (s.providers.length !== ALL_PROVIDERS.length) p.set('p', s.providers.join(','));
  if (s.q) p.set('q', s.q);
  if (s.year !== 'ALL') p.set('y', s.year);
  if (s.model) p.set('m', s.model);
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  // Safari、Firefox 限制 replaceState 的呼叫頻率，超過會丟例外；網址沒同步到不該讓畫面壞掉
  try {
    window.history.replaceState(null, '', url);
  } catch {
    // 下一次狀態變動時會再寫一次
  }
};
