import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PR_COUNT_URL, PR_LIST_URL, prLinkLabel } from '../src/lib/pullRequests.ts';

const SNAPSHOT = fileURLToPath(new URL('./__snapshots__/pr-link-labels.snap', import.meta.url));

test('通知的數字與點開的清單用同一組條件', () => {
  const list = new URL(PR_LIST_URL).searchParams.get('q');
  const count = new URL(PR_COUNT_URL).searchParams.get('q');
  assert.equal(count, `repo:granola858/llm-model-tracker ${list}`);
});

test('顯示文字全排列快照', () => {
  const actual = `${[null, 0, 1, 2, 100].map((count) => `${count} | ${prLinkLabel(count)}`).join('\n')}\n`;

  if (process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(new URL('./__snapshots__/', import.meta.url), { recursive: true });
    fs.writeFileSync(SNAPSHOT, actual, 'utf-8');
  }
  assert.equal(actual, fs.readFileSync(SNAPSHOT, 'utf-8').replace(/\r\n/g, '\n'));
});
