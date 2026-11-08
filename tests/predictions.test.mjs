import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MIN_VOLUME,
  TARGETS,
  buildPrediction,
  estimateWindow,
  etDate,
  modelName,
  parseRungs,
} from '../scripts/lib/predictions.mjs';
import { predictionDetail, predictionLabel, selectPredictions } from '../src/lib/predictions.ts';

const SNAPSHOT = fileURLToPath(new URL('./__snapshots__/prediction-labels.snap', import.meta.url));
const TODAY = '2026-11-09';
const rung = (date, probability) => ({ date, probability });
const market = (endDate, yes, closed = false) => ({ endDate, closed, outcomePrices: JSON.stringify([String(yes), String(1 - yes)]) });
const prediction = (provider, date, precision = 'near') => ({ provider, name: provider, date, precision, probability: 0.5, url: 'https://example.com' });

test('過半的檔位與前一檔相近時，時間說得準', () => {
  const window = estimateWindow([rung('2026-11-11', 0.21), rung('2026-11-13', 0.55), rung('2026-11-30', 0.91)], TODAY);
  assert.deepEqual(window, { date: '2026-11-13', precision: 'near', probability: 0.55 });
});

test('只有遠期檔位時只能說「在這天之前」', () => {
  assert.equal(estimateWindow([rung('2026-11-30', 0.63)], TODAY).precision, 'by');
});

test('兩檔相隔超過一旬時也只能說「在這天之前」', () => {
  assert.equal(estimateWindow([rung('2026-11-10', 0.2), rung('2026-11-30', 0.7)], TODAY).precision, 'by');
});

test('到最後一檔都不到一半時，回報最後一檔', () => {
  assert.deepEqual(estimateWindow([rung('2026-11-30', 0.14), rung('2026-12-31', 0.39)], TODAY), {
    date: '2026-12-31',
    precision: 'after',
    probability: 0.39,
  });
});

test('機率倒退時補成不遞減', () => {
  const window = estimateWindow([rung('2027-01-31', 0.47), rung('2027-03-31', 0.46)], TODAY);
  assert.deepEqual(window, { date: '2027-03-31', precision: 'after', probability: 0.47 });
});

test('亂序的檔位也能正確換算', () => {
  assert.equal(estimateWindow([rung('2026-11-30', 0.9), rung('2026-11-12', 0.6), rung('2026-11-10', 0.1)], TODAY).date, '2026-11-12');
});

test('中間態：模型已發布、市場還沒結算時不顯示', () => {
  assert.equal(estimateWindow([rung('2026-11-10', 0.99), rung('2026-11-30', 0.995)], TODAY), null);
});

test('遠期檔位接近 100% 只代表時間還很寬，不算已發布', () => {
  assert.equal(estimateWindow([rung('2026-12-31', 0.97)], TODAY).precision, 'by');
});

test('沒有未到期的檔位時沒有結果', () => {
  assert.equal(estimateWindow([], TODAY), null);
  assert.equal(estimateWindow([rung('2026-11-08', 0.3)], TODAY), null);
});

test('市場截止時間換回美東日期，冬令與夏令都正確', () => {
  assert.equal(etDate(new Date('2026-12-01T04:59:00Z')), '2026-11-30');
  assert.equal(etDate(new Date('2026-07-01T03:59:00Z')), '2026-06-30');
});

test('已結束或價格壞掉的檔位不列入', () => {
  const rungs = parseRungs([
    market('2026-11-14T04:59:00Z', 0.4),
    market('2026-11-07T04:59:00Z', 0, true),
    { endDate: '2026-11-20T04:59:00Z', closed: false, outcomePrices: 'not json' },
    { closed: false, outcomePrices: '["0.5","0.5"]' },
  ]);
  assert.deepEqual(rungs, [rung('2026-11-13', 0.4)]);
});

test('市場標題只比對主線，輕量層級、其他題目與硬體都不算', () => {
  const matched = (title) => TARGETS.filter((t) => t.title.test(title)).map((t) => t.label);
  assert.deepEqual(matched('GPT Astra 6.1+ released by...?'), ['GPT Astra']);
  assert.deepEqual(matched('Next GPT Astra (6.2+) released by...?'), ['GPT Astra']);
  assert.deepEqual(matched('Next Fable Model (5.2+) released by...?'), ['Claude Fable']);
  assert.deepEqual(matched('Next Muse Wonder (1.1+) released by...?'), ['Muse Wonder']);
  assert.deepEqual(matched('Next Alibaba Qwen Max (3.9+) released by...?'), ['Qwen Max']);
  for (const title of [
    'Muse Charm released by...?',
    'Next Muse Spark (1.4+) released by...?',
    'Next Fable Model (5.2+) released on...?',
    'Next Claude Haiku (5.6+) released by...?',
    'Next Gemini Flash Model (3.9+) released by...?',
    'Next Qwen Flash (3.9+) released by...?',
    'Next Mistral Small (4.1+) released by...?',
    'Next DeepSeek Flash released by...?',
    'When will Gemini Carbon be released?',
  ]) {
    assert.deepEqual(matched(title), [], title);
  }
});

test('模型名稱只取版本號', () => {
  const grok = TARGETS.find((t) => t.provider === 'xAI');
  const deepseek = TARGETS.find((t) => t.provider === 'DeepSeek');
  assert.equal(modelName(grok, 'Next Grok Model (4.8+) released by...?'), 'Grok 4.8+');
  assert.equal(modelName(deepseek, 'Next DeepSeek Pro released by...?'), 'DeepSeek Pro');
});

test('交易量不足的市場不輸出', () => {
  const target = TARGETS[0];
  const event = { title: 'GPT Astra 6.1+ released by...?', slug: 'gpt-astra', markets: [market('2026-11-14T04:59:00Z', 0.6)] };
  assert.equal(buildPrediction(target, { ...event, volume: MIN_VOLUME - 1 }, TODAY), null);
  assert.deepEqual(buildPrediction(target, { ...event, volume: MIN_VOLUME }, TODAY), {
    provider: 'OpenAI',
    name: 'GPT Astra 6.1+',
    date: '2026-11-13',
    precision: 'near',
    probability: 0.6,
    url: 'https://polymarket.com/event/gpt-astra',
  });
});

test('只顯示已選廠商最接近的三筆，機率不到一半的排最後', () => {
  const items = [
    prediction('DeepSeek', '2026-11-20', 'after'),
    prediction('Meta', '2026-12-31', 'by'),
    prediction('Qwen', '2026-11-20'),
    prediction('Google', '2026-11-10'),
    prediction('OpenAI', '2026-11-13'),
  ];
  const all = ['DeepSeek', 'Meta', 'Qwen', 'Google', 'OpenAI'];
  assert.deepEqual(selectPredictions(items, all, TODAY).map((p) => p.provider), ['Google', 'OpenAI', 'Qwen']);
  assert.deepEqual(selectPredictions(items, ['DeepSeek', 'Meta'], TODAY).map((p) => p.provider), ['Meta', 'DeepSeek']);
  assert.deepEqual(selectPredictions(items, [], TODAY), []);
});

test('中間態：日期已過、排程還沒更新時不顯示', () => {
  assert.deepEqual(selectPredictions([prediction('Google', '2026-11-08')], ['Google'], TODAY), []);
  assert.equal(selectPredictions([prediction('Google', TODAY)], ['Google'], TODAY).length, 1);
});

test('顯示文字全排列快照', () => {
  const dates = ['2026-11-01', '2026-11-10', '2026-11-11', '2026-11-20', '2026-11-21', '2026-11-29', '2026-11-30', '2026-12-31', '2027-01-15', '2027-01-31', '2028-02-28', '2028-02-29'];
  const lines = [];
  for (const precision of ['near', 'by', 'after']) {
    for (const date of dates) lines.push(`${precision} | ${date} | ${predictionLabel({ precision, date }, 2026)}`);
  }
  for (const probability of [0, 0.385, 0.505, 1]) {
    lines.push(`detail | ${probability} | ${predictionDetail({ date: '2026-11-12', probability })}`);
  }
  const actual = `${lines.join('\n')}\n`;

  if (process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(new URL('./__snapshots__/', import.meta.url), { recursive: true });
    fs.writeFileSync(SNAPSHOT, actual, 'utf-8');
  }
  assert.equal(actual, fs.readFileSync(SNAPSHOT, 'utf-8').replace(/\r\n/g, '\n'));
});
