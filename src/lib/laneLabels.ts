import { AIModel } from '../types';

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

export interface LabelSpot {
  side: 'above' | 'below';
  row: number;
  /** start：從圓點右側起頭；end：在圓點左側收尾 */
  anchor: 'start' | 'end';
}

export interface LabelItem {
  id: string;
  /** 圓點在軌道上的 px 位置 */
  x: number;
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
  const lo = anchor === 'start' ? item.x + LABEL.dotGap : item.x - LABEL.dotGap - item.w;
  return [lo, lo + item.w];
};

/**
 * 依 items 的順序（優先序）逐一找空位，保證同一排不重疊：
 * 先貼近中線、再往外一排；同一排先試圓點右側起頭（最好認是誰的），放不下才改到左側收尾；
 * 上下兩側輪流。都放不下就不標，滑過圓點仍可在下方詳情看到完整資料。
 */
export function layoutLabels(items: LabelItem[], trackW: number, laneH: number): Map<string, LabelSpot> {
  const rows = rowsFor(laneH);
  const right = trackW + LABEL.tail - 4;
  const taken = new Map<string, [number, number][]>();
  const spots = new Map<string, LabelSpot>();
  for (const item of items) {
    find: for (let row = 0; row < rows; row++) {
      for (const anchor of ['start', 'end'] as const) {
        const [lo, hi] = spanOf(item, anchor);
        if (lo < 0 || hi > right) continue;
        for (const side of ['above', 'below'] as const) {
          const key = `${side}${row}`;
          const used = taken.get(key) ?? [];
          if (used.some(([a, b]) => lo < b + LABEL.space && hi > a - LABEL.space)) continue;
          used.push([lo, hi]);
          taken.set(key, used);
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
