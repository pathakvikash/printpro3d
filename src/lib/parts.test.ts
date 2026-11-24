import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, partById, partsByCategory, CATEGORY_ORDER } from './parts.ts';
import { MOTORS } from './motors.ts';
import { partMesh, partBlueprint, partReference, partThumb } from './partModels.ts';
import { meshStats } from './quote.ts';
import { bounds } from './blueprint.ts';

test('catalogue: unique ids, no prices or brands, linked motors by reference', () => {
  assert.equal(new Set(PARTS.map((p) => p.id)).size, PARTS.length);
  for (const p of PARTS) {
    assert.equal(p.price, undefined); assert.equal(p.sku, undefined);
    assert.ok(CATEGORY_ORDER.includes(p.category) && p.specs.length >= 2, p.id);
    assert.ok(!/[$₹€]|\bprice\b|in stock/i.test(JSON.stringify(p)), `${p.id}: no price or stock`);
    assert.ok(p.accuracy === 'sourced' ? !!p.source : true, p.id);
  }
  for (const m of MOTORS) { const p = partById(m.id)!; assert.equal(p.source?.url, m.source.url); assert.equal(p.title, m.name); }
  assert.equal(partById('nope'), null);
  assert.ok(partsByCategory('motor').length >= 3);
});

test('every part builds a closed mesh inside its stated envelope, with a blueprint and a thumb', () => {
  for (const p of PARTS) {
    const m = partMesh(p);
    assert.ok(m, `${p.id}: mesh`);
    assert.ok(meshStats(m), `${p.id}: closed`);
    const { size } = bounds(m);
    [size.x, size.y, size.z].forEach((v, i) => assert.ok(Math.abs(v - p.dims[i]) <= 0.7, `${p.id} axis ${i}: ${v.toFixed(2)} vs ${p.dims[i]}`));
    const bp = partBlueprint(p)!;
    assert.ok(bp.startsWith('<svg') && !/WEIGHT|LAYERS|FITS BED|build direction|pricing/.test(bp), `${p.id}: reference sheet`);
    assert.ok(partThumb(p)!.d.length > 50, p.id);
    for (const [k, v] of partReference(p).rows) assert.ok(v.length <= 34, `${p.id} ${k}: title block value too long`);
  }
});
