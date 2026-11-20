import test from 'node:test';
import assert from 'node:assert/strict';
import { isModelFile, mergeChecked, type Checked } from './orderChecks.ts';
import { CATALOG } from './catalog.ts';
import { MAX_QTY } from './quote.ts';

test('model lines accept only uploaded model extensions, any case', () => {
  for (const ok of ['1700-abc.stl', 'part.OBJ', 'x.glb', 'x.gltf', 'x.3mf', 'Mixed.StL']) assert.equal(isModelFile(ok), true, ok);
  for (const bad of ['1700-abc.png', 'idea.jpg', 'idea.webp', 'x.stl.png', 'x.stats.json', 'noext', 'x.stlx']) {
    assert.equal(isModelFile(bad), false, bad);
  }
});

test('merging sums duplicates and refuses a total over MAX_QTY', () => {
  const shop = (n: number, qty: number): Checked => ({ n, kind: 'shop', item: CATALOG[0], qty });
  const model = (n: number, qty: number, material = 'PLA'): Checked => ({ n, kind: 'model', file: 'a.stl', material, qty });
  assert.deepEqual(mergeChecked([shop(1, 2), shop(2, 3)]).map((r) => r.qty), [5]);
  assert.deepEqual(mergeChecked([model(1, 2), model(2, 3, 'ABS')]).map((r) => r.qty), [2, 3]); // other material: separate line
  assert.deepEqual(mergeChecked([model(1, 2), model(2, 3)]).map((r) => r.qty), [5]);
  assert.deepEqual(mergeChecked([shop(1, MAX_QTY)]).map((r) => r.qty), [MAX_QTY]);
  assert.throws(() => mergeChecked([shop(1, 60), shop(2, 41)]), { message: `item 2: quantity over ${MAX_QTY} after merging` });
  assert.throws(() => mergeChecked([model(1, MAX_QTY), model(2, 1)]), { message: `item 2: quantity over ${MAX_QTY} after merging` });
});
