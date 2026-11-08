import type { Prediction, PredictionPrecision, ProviderId } from '../types';

// 這個檔案只能有型別匯入，測試會直接用 Node 載入

const VISIBLE_COUNT = 3;

const parseDate = (date: string) => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  day: Number(date.slice(8, 10)),
});

const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const tenDayPeriod = (day: number) => (day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬');

const BOUND_SUFFIX: Record<Exclude<PredictionPrecision, 'near'>, string> = { by: '前', after: '後' };

/** 大約發布時間的顯示文字；所有 precision 與日期組合都走這裡（快照見 tests/） */
export function predictionLabel(p: Pick<Prediction, 'date' | 'precision'>, currentYear: number): string {
  const { year, month, day } = parseDate(p.date);
  const prefix = year === currentYear ? '' : `${year} 年 `;
  if (p.precision === 'near') return `${prefix}${month} 月${tenDayPeriod(day)}`;
  const suffix = BOUND_SUFFIX[p.precision];
  return day === lastDayOfMonth(year, month) ? `${prefix}${month} 月底${suffix}` : `${prefix}${month}/${day} ${suffix}`;
}

/** 滑過時的機率說明 */
export function predictionDetail(p: Pick<Prediction, 'date' | 'probability'>): string {
  const { month, day } = parseDate(p.date);
  return `Polymarket：${month}/${day} 前發布機率 ${Math.round(p.probability * 100)}%`;
}

/** 依廠商篩選後取最接近的幾筆；日期已過的先拿掉，等下一次排程更新 */
export function selectPredictions(items: Prediction[], providers: ProviderId[], today: string): Prediction[] {
  const rank = (p: Prediction) => (p.precision === 'after' ? 1 : 0);
  return items
    .filter((p) => providers.includes(p.provider) && p.date >= today)
    .sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date))
    .slice(0, VISIBLE_COUNT);
}
