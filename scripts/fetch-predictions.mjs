/**
 * scripts/fetch-predictions.mjs
 * 從 Polymarket 公開 API（不需金鑰）抓各家下一款旗艦的發布機率，寫入 public/data/predictions.json。
 * 只用原生 fetch、不裝套件，所以能在有 push 權限的 job 裡執行。
 * 這是預測、不是事實，一律不進 models.json。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS, buildPrediction, etDate } from './lib/predictions.mjs';

const OUTPUT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/data/predictions.json');
const SEARCH_URL = 'https://gamma-api.polymarket.com/public-search';
const TIMEOUT_MS = 10000;

async function searchEvents(query) {
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: query, limit_per_type: '20', events_status: 'active' })}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'LLM-Model-Tracker-GitHub-Action/1.0 (+https://github.com)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).events ?? [];
}

async function readPrevious() {
  try {
    const payload = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf-8'));
    return new Map(payload.items.map((item) => [item.provider, item]));
  } catch {
    return new Map();
  }
}

async function main() {
  const previous = await readPrevious();
  const today = etDate(new Date());
  const items = new Map();
  const failed = new Set();
  let reached = 0;

  for (const target of TARGETS) {
    if (items.has(target.provider)) continue;
    try {
      const events = await searchEvents(target.query);
      reached += 1;
      const event = events.find((e) => !e.closed && target.title.test(e.title));
      const item = event ? buildPrediction(target, event, today) : null;
      if (item) items.set(target.provider, item);
      else console.warn(`[WARN] ${target.label}：沒有可用的市場（不存在、交易量不足或已接近結算）`);
    } catch (err) {
      failed.add(target.provider);
      console.warn(`[WARN] 無法查詢 ${target.label}：${err.message}`);
    }
  }

  if (reached === 0) {
    console.warn('⚠️ 所有查詢都失敗，保留既有 predictions.json。');
    return;
  }

  // 網路失敗沿用上次的結果；查得到但市場沒了就移除，不留過期的預測
  for (const provider of failed) {
    if (!items.has(provider) && previous.has(provider)) items.set(provider, previous.get(provider));
  }

  const payload = { lastUpdated: new Date().toISOString(), items: [...items.values()] };
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`✅ 已更新 ${payload.items.length} 家的下一代旗艦預測至 ${OUTPUT_PATH}`);
}

main();
