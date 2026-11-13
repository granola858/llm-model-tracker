import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLUSTER_GAP,
  DOT_CLEAR,
  LABEL,
  POLE_CLEAR,
  clusterByX,
  clusterNames,
  layoutLabels,
  poleOf,
  spanOf,
} from '../src/lib/laneLabels.ts';

const one = (id, x, w) => ({ id, from: x, to: x, w });

/** 檢查所有排版規則 */
function assertReadable(items, spots, dots) {
  const shown = items
    .filter((it) => spots.has(it.id))
    .map((it) => {
      const spot = spots.get(it.id);
      const [lo, hi] = spanOf(it, spot.anchor);
      return { ...it, ...spot, lo, hi, pole: poleOf(it, spot.anchor) };
    });
  for (const a of shown) {
    const foreign = dots.filter((d) => d < a.from || d > a.to);
    // 第一排緊貼中線：不壓較新的圓點；跨過較舊的圓點時，收尾那端不能貼著別的圓點
    if (a.row === 0) {
      for (const d of foreign) {
        const under = d > a.lo - DOT_CLEAR && d < a.hi + DOT_CLEAR;
        if (!under) continue;
        assert.ok(d < a.from && a.anchor === 'end', `${a.id} covers newer dot ${d}`);
        assert.ok(Math.abs(d - a.hi) >= DOT_CLEAR, `${a.id} ends on dot ${d}`);
      }
    }
    for (const b of shown) {
      if (a === b) continue;
      // 左右順序與時間順序一致（比中心）
      if (a.from < b.from) {
        assert.ok(a.lo + a.hi <= b.lo + b.hi + 2 * LABEL.space, `${a.id} reads after ${b.id}`);
      }
      if (a.side !== b.side) continue;
      if (a.row === b.row) {
        assert.ok(a.hi + LABEL.space <= b.lo || b.hi + LABEL.space <= a.lo, `${a.id} overlaps ${b.id}`);
      }
      // a 在外排：旗桿不可穿過 b 的字
      if (a.row > b.row) {
        assert.ok(a.pole <= b.lo - POLE_CLEAR || a.pole >= b.hi + POLE_CLEAR, `${a.id} pole crosses ${b.id}`);
      }
    }
  }
}

test('overlapping dots merge into one label, names in release order', () => {
  const groups = clusterByX(
    [
      { n: 'Gemini 4 Hydrogen', x: 478 },
      { n: 'Gemini 4 Argon', x: 378 },
      { n: 'Gemini 4 Carbon', x: 472 },
    ],
    (d) => d.x
  );
  assert.deepEqual(
    groups.map((g) => g.map((d) => d.n)),
    [['Gemini 4 Argon'], ['Gemini 4 Carbon', 'Gemini 4 Hydrogen']]
  );
  assert.deepEqual(clusterNames(['Gemini 4 Carbon', 'Gemini 4 Hydrogen']), ['Gemini 4 Carbon', 'Hydrogen']);
  assert.deepEqual(clusterNames(['GPT-6', 'o5 mini']), ['GPT-6', 'o5 mini']);
  // 名稱完全相同時至少留最後一個詞
  assert.deepEqual(clusterNames(['Grok 4', 'Grok 4']), ['Grok 4', '4']);
  // 剛好差一顆圓點寬就分開
  assert.equal(clusterByX([0, CLUSTER_GAP], (x) => x).length, 2);
});

test('crowded right edge: every label sits next to its own dots', () => {
  // 由新到舊（同一組）。Carbon、Hydrogen 合成一組，Argon 在左邊不遠
  const dots = [100, 178, 243, 378, 472, 478];
  const items = [
    { id: 'carbon+hydrogen', from: 472, to: 478, w: 160 },
    one('argon', 378, 92),
    one('3.8', 243, 96),
    one('3.7', 178, 96),
    one('3.6', 100, 190),
  ];
  for (const laneH of [56, 80, 130]) {
    const spots = layoutLabels(items, 520, laneH, dots);
    assertReadable(items, spots, dots);
    assert.ok(spots.has('carbon+hydrogen'), `newest group labelled at height ${laneH}`);
  }
  const spots = layoutLabels(items, 520, 130, dots);
  assert.equal(spots.get('argon').row, 0);
});

test('unlabelled dots still count as obstacles', () => {
  // 全部檢視只標最新幾款，但較舊的圓點仍看得到
  const dots = [250, 300, 360];
  const items = [one('new', 300, 120)];
  const spots = layoutLabels(items, 600, 130, dots);
  assertReadable(items, spots, dots);
  assert.ok(spots.get('new').row > 0);
});

test('one-row lanes: the newest group is labelled over older dots, never the reverse', () => {
  // 「全部」檢視的 Google 泳道實測座標：矮泳道只有一排，只標最新三款
  const dots = [417, 443, 478, 550, 599, 602];
  const items = [
    { id: 'carbon+hydrogen', from: 599, to: 602, w: 167 },
    one('argon', 550, 92),
  ];
  const spots = layoutLabels(items, 640, 73, dots);
  assertReadable(items, spots, dots);
  assert.equal(spots.get('carbon+hydrogen')?.anchor, 'end');
  // Argon 不能從自己的圓點往右延伸、壓在最新那組上
  assert.notEqual(spots.get('argon')?.anchor, 'start');
});

test('random lanes satisfy every layout rule', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let n = 0; n < 500; n++) {
    const count = 2 + Math.floor(rand() * 12);
    const xs = Array.from({ length: count }, () => Math.round(rand() * 600));
    const groups = clusterByX(xs, (x) => x).reverse();
    const items = groups.map((g, i) => ({ id: String(i), from: g[0], to: g[g.length - 1], w: 50 + Math.round(rand() * 80) }));
    const labelled = rand() < 0.3 ? items.slice(0, 3) : items;
    assertReadable(labelled, layoutLabels(labelled, 600, 40 + Math.round(rand() * 100), xs), xs);
  }
});
