import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkEntry, mergeChecked } from './orderChecks.ts';
import { approve, createFromTemplate, finalize, getProject } from './designProjects.ts';
import { designNotes, priceDesign } from './orderPricing.ts';
import { putJson } from './store.ts';
import { quote } from './quote.ts';

const setup = () => { process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'order-design-')); };
const forged = { kind: 'design', project: 'x', material: 'PLA', qty: 2, total: 1, unitPrice: 0.01, estimate: 0, price: 1, stats: { volumeCm3: 0.001 } };

test('a design entry carries only project, material and qty: forged price fields are never read', () => {
  const c = checkEntry(forged, 1);
  assert.deepEqual(c, { n: 1, kind: 'design', project: 'x', material: 'PLA', qty: 2 });
  assert.throws(() => checkEntry({ kind: 'design', qty: 1 }, 2), /item 2: design needs a project/);
  assert.equal(mergeChecked([checkEntry(forged, 1), checkEntry(forged, 2)])[0].qty, 4);
});

test('a project that is not finalized is refused (400-style error), even with a forged price', async () => {
  setup();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await assert.rejects(priceDesign(p.id, 'PLA', 1), /not finalized/);
  await approve(p.id);
  await assert.rejects(priceDesign(p.id, 'PLA', 1), /not finalized/); // approved is not enough
  await assert.rejects(priceDesign('not-a-project', 'PLA', 1), /not found/);
});

test('a finalized project is priced from the STL the server built; the line names project, revision and components', async () => {
  setup();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await approve(p.id);
  const f = await finalize(p.id);
  const stored = (await getProject(p.id))!;
  await putJson('designs', `${p.id}.json`, { ...stored, components: ['M3 screws x4', 'a battery'] }); // later WP fills this
  const line = await priceDesign(p.id, 'PLA', 3);
  const want = quote(line.stats!, 'PLA', 3);
  assert.equal(line.total, want.total);
  assert.ok(line.total! > 0);
  assert.equal(line.file, f.finalFile);
  assert.equal(line.kind, 'design');
  assert.equal(line.project, p.id);
  assert.equal(line.revision, 1);
  assert.deepEqual(line.components, ['M3 screws x4', 'a battery']);
  const notes = designNotes([line]);
  assert.match(notes, new RegExp(`Design project ${p.id} rev 1`));
  assert.match(notes, /User-supplied components \(not printed\): M3 screws x4, a battery/);
  await assert.rejects(priceDesign(p.id, 'GOLD', 1), /material/i);
});
