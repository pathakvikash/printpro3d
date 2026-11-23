import test from 'node:test';
import assert from 'node:assert/strict';
import { isModelFile, mergeChecked, MAX_TPL_LINES, type Checked } from './orderChecks.ts';
import { CATALOG } from './catalog.ts';
import { MAX_QTY } from './quote.ts';
import { defaultCfg, TEMPLATES } from './templateDefs.ts';

test('an order carries at most MAX_TPL_LINES distinct template lines (each is a server CSG rebuild)', () => {
  const t = TEMPLATES.find((x) => x.id === 'spacer-set')!;
  const tpl = (n: number, count: number): Checked => ({ n, kind: 'tpl', tpl: t, cfg: { ...defaultCfg(t), count }, qty: 1 });
  const many = Array.from({ length: MAX_TPL_LINES + 1 }, (_, i) => tpl(i + 1, i + 1));
  assert.throws(() => mergeChecked(many), /at most 5 different configured parts/);
  assert.equal(mergeChecked(many.slice(0, MAX_TPL_LINES)).length, MAX_TPL_LINES);
  assert.equal(mergeChecked([tpl(1, 3), tpl(2, 3), tpl(3, 3)]).length, 1); // identical configs merge first, so they do not count twice
});

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
