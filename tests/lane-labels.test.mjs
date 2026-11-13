import assert from 'node:assert/strict';
import test from 'node:test';
import { LABEL, layoutLabels, spanOf } from '../src/lib/laneLabels.ts';

/** 已標出的標籤，依圓點位置排好，檢查左右緣都沒有倒序（容許 LABEL.space） */
function assertOrdered(items, spots) {
  const shown = items
    .filter((it) => spots.has(it.id))
    .map((it) => ({ x: it.x, span: spanOf(it, spots.get(it.id).anchor) }))
    .sort((a, b) => a.x - b.x);
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      if (shown[i].x === shown[j].x) continue;
      assert.ok(shown[i].span[0] <= shown[j].span[0] + LABEL.space, 'older label starts after newer one');
      assert.ok(shown[i].span[1] <= shown[j].span[1] + LABEL.space, 'older label ends after newer one');
    }
  }
}

test('newest model near the right edge does not push an older label to its right', () => {
  // 由新到舊：Hydrogen 緊貼在 Carbon 右邊、靠近軌道末端
  const items = [
    { id: 'hydrogen', x: 632, w: 104 },
    { id: 'carbon', x: 620, w: 98 },
    { id: 'argon', x: 480, w: 92 },
    { id: 'flash', x: 400, w: 96 },
  ];
  const spots = layoutLabels(items, 700, 80);
  assertOrdered(items, spots);
  assert.ok(spots.has('hydrogen'));
  assert.ok(spots.has('carbon'));
  const [, carbonHi] = spanOf(items[1], spots.get('carbon').anchor);
  const [, hydrogenHi] = spanOf(items[0], spots.get('hydrogen').anchor);
  assert.ok(carbonHi <= hydrogenHi + LABEL.space);
});

test('random lanes keep label order consistent with release order', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let n = 0; n < 300; n++) {
    const count = 2 + Math.floor(rand() * 10);
    const xs = Array.from({ length: count }, () => Math.round(rand() * 600)).sort((a, b) => b - a);
    const items = xs.map((x, i) => ({ id: String(i), x, w: 50 + Math.round(rand() * 80) }));
    assertOrdered(items, layoutLabels(items, 600, 40 + Math.round(rand() * 100)));
  }
});
