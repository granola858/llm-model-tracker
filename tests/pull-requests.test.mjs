import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MERGED_PRS_API_URL,
  PR_LIST_URL,
  countUnreadMerged,
  extractMergedEntries,
  parseMergedPrModels,
  prLinkLabel,
} from '../src/lib/pullRequests.ts';

const SNAPSHOT = fileURLToPath(new URL('./__snapshots__/pr-link-labels.snap', import.meta.url));

test('下拉清單與點開的 PR 列表用同一組條件', () => {
  const list = new URL(PR_LIST_URL).searchParams.get('q');
  const api = new URL(MERGED_PRS_API_URL).searchParams.get('q');
  assert.equal(api, `repo:granola858/llm-model-tracker ${list}`);
  assert.match(list ?? '', /is:merged/);
  assert.match(list ?? '', /-author:app\/dependabot/);
});

test('從 PR 內文解析出多筆新模型', () => {
  const body = [
    '由 `scripts/fetch-models.mjs` 於 2026-11-21 自動產生並合併。',
    '',
    '## 新增 2 筆',
    '',
    '### GPT-6.1 Terra（OpenAI，2026-11-20）',
    '- 參數：未公開｜Context：1M｜Proprietary｜Flagship｜旗艦',
    '',
    '### Claude 5 Haiku（Anthropic，2026-11-19）',
    '- 參數：未公開｜Context：512K｜Proprietary｜Lightweight',
    '',
  ].join('\n');

  assert.deepEqual(parseMergedPrModels(body), [
    { name: 'GPT-6.1 Terra', provider: 'OpenAI', releaseDate: '2026-11-20' },
    { name: 'Claude 5 Haiku', provider: 'Anthropic', releaseDate: '2026-11-19' },
  ]);
});

test('展開已合併 PR、依合併時間新到舊排序，非自動格式回退顯示 PR 標題', () => {
  const entries = extractMergedEntries([
    {
      number: 4,
      title: '新增 1 筆模型（自動查證）',
      html_url: 'https://github.com/granola858/llm-model-tracker/pull/4',
      pull_request: { merged_at: '2026-11-12T00:59:25Z' },
      body: '### Gemini 3.5 Pro（Google，2026-11-11）\n- 規格',
    },
    {
      number: 6,
      title: '手動修正模型資料',
      html_url: 'https://github.com/granola858/llm-model-tracker/pull/6',
      closed_at: '2026-11-20T05:00:00Z',
      body: '修正一個拼字錯誤',
    },
    {
      number: 5,
      title: '新增 1 筆模型（自動查證）',
      html_url: 'https://github.com/granola858/llm-model-tracker/pull/5',
      pull_request: { merged_at: '2026-11-13T01:47:04Z' },
      body: '### DeepSeek-V4（DeepSeek，2026-11-12）\n- 規格',
    },
  ]);

  assert.deepEqual(
    entries.map((e) => ({ prNumber: e.prNumber, name: e.name, provider: e.provider })),
    [
      { prNumber: 6, name: '手動修正模型資料', provider: undefined },
      { prNumber: 5, name: 'DeepSeek-V4', provider: 'DeepSeek' },
      { prNumber: 4, name: 'Gemini 3.5 Pro', provider: 'Google' },
    ]
  );
});

test('未讀合併數：有已讀紀錄時只算較新的 PR，首次造訪算最近 14 天', () => {
  const now = Date.parse('2026-11-21T07:00:00Z');
  const entries = [
    {
      key: '5:0',
      prNumber: 5,
      prUrl: 'https://example.com/5',
      prTitle: 'PR 5',
      mergedAt: '2026-11-18T01:00:00Z',
      name: 'Model B',
    },
    {
      key: '4:0',
      prNumber: 4,
      prUrl: 'https://example.com/4',
      prTitle: 'PR 4',
      mergedAt: '2026-11-01T01:00:00Z',
      name: 'Model A',
    },
  ];

  assert.equal(countUnreadMerged(entries, null, now), 1);
  assert.equal(countUnreadMerged(entries, 4, now), 1);
  assert.equal(countUnreadMerged(entries, 5, now), 0);
});

test('顯示文字全排列快照', () => {
  const actual = `${[null, 0, 1, 2, 100].map((count) => `${count} | ${prLinkLabel(count)}`).join('\n')}\n`;

  if (process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(new URL('./__snapshots__/', import.meta.url), { recursive: true });
    fs.writeFileSync(SNAPSHOT, actual, 'utf-8');
  }
  assert.equal(actual, fs.readFileSync(SNAPSHOT, 'utf-8').replace(/\r\n/g, '\n'));
});
