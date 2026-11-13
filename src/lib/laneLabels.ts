import type { AIModel } from '../types';

/** 泳道標籤的幾何常數（px），與 TimelineView 的 text-xs leading-4 對應 */
export const LABEL = {
  font: 12,
  rowH: 16,
  rowGap: 2,
  /** 中線到最近一排標籤 */
  lineGap: 10,
  /** 圓點到標籤 */
  dotGap: 6,
  /** 同一排兩個標籤之間至少留白 */
  space: 12,
  /** 軌道右側的 mr-10，標籤可以伸進去 */
  tail: 40,
  maxRows: 3,
} as const;

/** 圓點直徑約 14px：圓心距離比這近的圓點畫出來會疊在一起，合成一個標籤 */
export const CLUSTER_GAP = 14;
/** 第一排的字離別的圓點至少要這麼遠，才不會像是那顆的標籤 */
export const DOT_CLEAR = LABEL.dotGap + 4;
/** 旗桿與字之間至少留白 */
export const POLE_CLEAR = 4;
/** 合併標籤各段之間的分隔 */
export const CLUSTER_SEP = ' · ';

export interface LabelSpot {
  side: 'above' | 'below';
  /** 0 緊貼中線；外排要畫旗桿連回圓點 */
  row: number;
  /** start：從最右邊的圓點右側起頭；end：在最左邊的圓點左側收尾 */
  anchor: 'start' | 'end';
}

export interface LabelItem {
  id: string;
  /** 這個標籤涵蓋的圓點，最左、最右的 px 位置（只有一顆時相同） */
  from: number;
  to: number;
  /** 標籤寬度 px */
  w: number;
}

export const labelText = (m: AIModel) => m.name.split(' (')[0];

/** 標籤所在那一排離中線的距離 */
export const rowOffset = (row: number) => LABEL.lineGap + row * (LABEL.rowH + LABEL.rowGap);

/** 泳道高度放得下幾排（上下各自） */
export const rowsFor = (laneH: number) =>
  Math.max(1, Math.min(LABEL.maxRows, Math.floor((laneH / 2 - LABEL.lineGap + LABEL.rowGap) / (LABEL.rowH + LABEL.rowGap))));

/** 標籤實際佔的水平區間 */
export const spanOf = (item: LabelItem, anchor: LabelSpot['anchor']): [number, number] => {
  const lo = anchor === 'start' ? item.to + LABEL.dotGap : item.from - LABEL.dotGap - item.w;
  return [lo, lo + item.w];
};

/** 旗桿立在字起頭那一側的圓點上 */
export const poleOf = (item: LabelItem, anchor: LabelSpot['anchor']) => (anchor === 'start' ? item.to : item.from);

/** 依位置由左到右分組，相鄰圓點疊在一起的歸成同一組 */
export function clusterByX<T>(list: T[], x: (t: T) => number): T[][] {
  const groups: T[][] = [];
  for (const t of [...list].sort((a, b) => x(a) - x(b))) {
    const last = groups[groups.length - 1];
    if (last && x(t) - x(last[last.length - 1]) < CLUSTER_GAP) last.push(t);
    else groups.push([t]);
  }
  return groups;
}

/** 合併標籤的各段：後面的名稱省掉與第一個相同的開頭詞，例如 Gemini 4 Carbon · Hydrogen */
export function clusterNames(names: string[]): string[] {
  const head = names[0].split(' ');
  return names.map((name, i) => {
    if (i === 0) return name;
    const words = name.split(' ');
    let k = 0;
    while (k < words.length - 1 && k < head.length && words[k] === head[k]) k++;
    return words.slice(k).join(' ');
  });
}

interface Placed {
  side: LabelSpot['side'];
  row: number;
  /** 標籤涵蓋的圓點，用來比時間先後 */
  from: number;
  /** 旗桿位置，只有外排有意義 */
  pole: number;
  lo: number;
  hi: number;
}

/**
 * 標籤的左右順序必須跟圓點的時間順序一致：較新的模型，標籤中心不能落在較舊模型標籤中心的左邊。
 * 容許 LABEL.space 的誤差，幾乎對齊的上下兩排本來就讀不出先後。
 */
const keepsOrder = (from: number, lo: number, hi: number, placed: Placed[]) =>
  placed.every((p) => {
    const mid = lo + hi;
    const pMid = p.lo + p.hi;
    if (p.from > from) return mid <= pMid + 2 * LABEL.space;
    if (p.from < from) return mid >= pMid - 2 * LABEL.space;
    return true;
  });

const near = (x: number, lo: number, hi: number, pad: number) => x > lo - pad && x < hi + pad;

/**
 * 依 items 的順序（優先序）逐一找空位，每個標籤依序嘗試：
 * 1. 第一排，字底下沒有別的圓點；
 * 2. 外排，由圓點拉旗桿連到字；
 * 3. 第一排，在圓點左側收尾，字只往較舊的那一側跨過別的圓點（矮泳道只有一排時靠這個）；
 *    絕不壓在較新的圓點上，收尾那端也不能貼著別的圓點。
 * 1、2 先試圓點右側起頭（最好認是誰的），放不下才改到左側收尾；上下兩側輪流。
 * 一律保證：同一排的字不重疊、左右順序與時間順序一致、旗桿不穿過內排的字。
 * dots 是泳道上所有看得到的圓點，不只有標籤的那些。都放不下就不標，滑過圓點仍可在下方詳情看到完整資料。
 */
export function layoutLabels(
  items: LabelItem[],
  trackW: number,
  laneH: number,
  dots: number[] = items.flatMap((it) => (it.from === it.to ? [it.from] : [it.from, it.to]))
): Map<string, LabelSpot> {
  const rows = rowsFor(laneH);
  const right = trackW + LABEL.tail - 4;
  const tries: { row: number; crowded: boolean }[] = [
    { row: 0, crowded: false },
    ...Array.from({ length: rows - 1 }, (_, i) => ({ row: i + 1, crowded: false })),
    { row: 0, crowded: true },
  ];
  const placed: Placed[] = [];
  const spots = new Map<string, LabelSpot>();
  for (const item of items) {
    const foreign = dots.filter((d) => d < item.from || d > item.to);
    find: for (const { row, crowded } of tries) {
      for (const anchor of ['start', 'end'] as const) {
        const [lo, hi] = spanOf(item, anchor);
        if (lo < 0 || hi > right) continue;
        if (!keepsOrder(item.from, lo, hi, placed)) continue;
        if (crowded) {
          // 左側收尾的字整段都在較舊的那一側；起頭的話會壓到較新的圓點
          if (anchor === 'start' || foreign.some((d) => near(d, hi, hi, DOT_CLEAR))) continue;
        } else if (row === 0 && foreign.some((d) => near(d, lo, hi, DOT_CLEAR))) continue;
        const pole = poleOf(item, anchor);
        for (const side of ['above', 'below'] as const) {
          const blocked = placed.some(
            (p) =>
              p.side === side &&
              ((p.row === row && lo < p.hi + LABEL.space && hi > p.lo - LABEL.space) ||
                (p.row < row && near(pole, p.lo, p.hi, POLE_CLEAR)) ||
                (p.row > row && near(p.pole, lo, hi, POLE_CLEAR)))
          );
          if (blocked) continue;
          placed.push({ side, row, from: item.from, pole, lo, hi });
          spots.set(item.id, { side, row, anchor });
          break find;
        }
      }
    }
  }
  return spots;
}

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

/** 用 canvas 量標籤寬度；字型載入完成後要 resetLabelMeasure() 重量 */
export function measureLabel(text: string, bold: boolean): number {
  const key = `${bold ? 'b' : 'n'}${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  let w: number;
  if (ctx) {
    ctx.font = `${bold ? 700 : 400} ${LABEL.font}px ${getComputedStyle(document.body).fontFamily}`;
    // 頁面數字用 tnum，canvas 量不到，多留 2px
    w = Math.ceil(ctx.measureText(text).width) + 2;
  } else {
    w = text.length * LABEL.font * 0.62;
  }
  cache.set(key, w);
  return w;
}

export const resetLabelMeasure = () => cache.clear();
