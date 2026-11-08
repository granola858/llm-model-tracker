/**
 * scripts/lib/predictions.mjs
 * 把 Polymarket「某日前發布」的階梯機率換算成大約發布時間，不碰網路。
 * fetch-predictions.mjs 與 tests 共用。
 */

/**
 * 每家對應的市場，同一家由上往下取第一個可用的。
 * 比對標題要寫死前綴：Polymarket 的搜尋是模糊比對，「Muse」也會搜到硬體裝置 Muse Charm。
 * - 只收通用主線（判定條件見 PRODUCT.md），Flash、mini 這類輕量層級的市場不放進來。
 * - DeepSeek 的 Pro 市場連日期版也算成立，比這個站的旗艦標準寬鬆，目前沒有更貼近的市場。
 * - Carbon 是報導中的內部代號，正式名稱與層級都未公布；市場結束後會改用 Argon。
 * 主線改名時（例如 Astra 換成別的產品線）要手動更新這份清單。
 */
export const TARGETS = [
  { provider: 'OpenAI', label: 'GPT Astra', query: 'GPT Astra released by', title: /^(Next )?GPT Astra .*released by/i },
  { provider: 'Anthropic', label: 'Claude Fable', query: 'Next Fable Model released by', title: /^Next (Claude )?Fable .*released by/i },
  { provider: 'Google', label: 'Gemini Carbon', query: 'Gemini Carbon released by', title: /^Gemini Carbon released by/i },
  { provider: 'Google', label: 'Gemini Argon', query: 'Next Gemini Argon released by', title: /^Next Gemini Argon .*released by/i },
  { provider: 'Meta', label: 'Muse Wonder', query: 'Next Muse Wonder released by', title: /^Next Muse Wonder .*released by/i },
  { provider: 'xAI', label: 'Grok', query: 'Next Grok Model released by', title: /^Next Grok Model .*released by/i },
  { provider: 'Mistral', label: 'Mistral Large', query: 'Next Mistral Large released by', title: /^Next Mistral Large .*released by/i },
  { provider: 'DeepSeek', label: 'DeepSeek Pro', query: 'Next DeepSeek Pro released by', title: /^Next DeepSeek Pro .*released by/i },
  { provider: 'Qwen', label: 'Qwen Max', query: 'Next Qwen Max released by', title: /^Next (Alibaba )?Qwen Max .*released by/i },
];

/** 累計交易量低於這個金額（美元）時價格太不穩定，不顯示 */
export const MIN_VOLUME = 5000;

const HALF = 0.5;
/** 過半的檔位與前一檔相隔不超過一旬，才說得出「上旬／中旬／下旬」 */
const NEAR_GAP_DAYS = 10;
/** 近期檔位已接近 100%：模型多半已經發布，只是市場還沒結算 */
const SETTLED_PROBABILITY = 0.95;
const SETTLED_WITHIN_DAYS = 7;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const dayDiff = (a, b) => (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

/** 市場以美東時間 23:59 截止（UTC 隔天 03:59 或 04:59），往回推 5 小時就落在正確的日期 */
export const etDate = (d) => new Date(d.getTime() - 5 * HOUR).toISOString().slice(0, 10);

function yesPrice(market) {
  try {
    return Number(JSON.parse(market.outcomePrices)[0]);
  } catch {
    return NaN;
  }
}

/** 把一個事件底下還沒結束的市場轉成 `{ date, probability }[]` */
export function parseRungs(markets) {
  return markets.flatMap((m) => {
    const probability = yesPrice(m);
    const end = new Date(m.endDate);
    if (m.closed || !Number.isFinite(probability) || Number.isNaN(end.getTime())) return [];
    return [{ date: etDate(end), probability }];
  });
}

/**
 * 取機率第一次達到一半的檔位當大約時間。
 * 回傳 `{ date, precision, probability }`，沒有可用的結果時回傳 null。
 * precision：near＝時間說得準、by＝只知道在這天之前、after＝到最後一檔都不到一半。
 */
export function estimateWindow(rungs, today) {
  let max = 0;
  // 「某日前」的機率只會隨日期上升，交易量小時偶爾倒退，一律補成不遞減
  const ladder = rungs
    .filter((r) => r.date >= today)
    .sort((a, b) => dayDiff(a.date, b.date))
    .map((r) => ({ ...r, probability: (max = Math.max(max, r.probability)) }));
  if (!ladder.length) return null;

  const first = ladder[0];
  if (first.probability >= SETTLED_PROBABILITY && dayDiff(first.date, today) <= SETTLED_WITHIN_DAYS) return null;

  const index = ladder.findIndex((r) => r.probability >= HALF);
  if (index === -1) {
    const last = ladder[ladder.length - 1];
    return { date: last.date, precision: 'after', probability: last.probability };
  }
  const hit = ladder[index];
  const previous = index > 0 ? ladder[index - 1].date : today;
  return {
    date: hit.date,
    precision: dayDiff(hit.date, previous) <= NEAR_GAP_DAYS ? 'near' : 'by',
    probability: hit.probability,
  };
}

/** 版本號只取標題裡的「6.1+」，其他文字都來自 TARGETS，不把外部字串帶進畫面 */
export function modelName(target, eventTitle) {
  const version = eventTitle.match(/\d+(?:\.\d+)*\+/)?.[0];
  return version ? `${target.label} ${version}` : target.label;
}

/** 交易量不足或換算不出時間時回傳 null */
export function buildPrediction(target, event, today) {
  if (!(Number(event.volume) >= MIN_VOLUME)) return null;
  const window = estimateWindow(parseRungs(event.markets ?? []), today);
  if (!window) return null;
  return {
    provider: target.provider,
    name: modelName(target, event.title),
    ...window,
    url: `https://polymarket.com/event/${encodeURIComponent(event.slug)}`,
  };
}
