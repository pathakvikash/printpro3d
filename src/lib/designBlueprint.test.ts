import test from 'node:test';
import assert from 'node:assert/strict';
import { toDesign } from './aiDesign.ts';
import { blueprintToShapes, diffBlueprints, shapesToBlueprint, validateBlueprint, type BlueprintResult } from './designBlueprint.ts';

const sh = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'box', mode: 'solid', position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 }, ...over,
});
const bp = (shapes: unknown[], extra: Record<string, unknown> = {}) => ({
  title: 'T', notes: 'N', units: 'mm', envelope: { x: 1, y: 1, z: 1 },
  parts: [{ id: 'p1', name: 'Base', role: 'body', shapes }], features: [], constraints: { fitsBed: true, minWall: 1.2 }, ...extra,
});
const ok = (r: BlueprintResult) => { assert.ok(r.ok, r.ok ? '' : r.reason); return r.blueprint; };
const bad = (r: BlueprintResult) => { assert.ok(!r.ok); return r.reason; };

test('valid blueprint: envelope recomputed, ids kept', () => {
  const b = ok(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 8, y: 0, z: 5 } })])));
  assert.deepEqual(b.envelope, { x: 18, y: 10, z: 10 });
  assert.deepEqual(b.parts[0].shapes.map((s) => s.id), ['a', 'b']);
});

test('drops the design to z=0', () => {
  const b = ok(validateBlueprint(bp([sh('a', { position: { x: 0, y: 0, z: 30 } })])));
  assert.ok(Math.abs(b.parts[0].shapes[0].position.z - 5) < 1e-6);
});

test('rejections', () => {
  assert.match(bad(validateBlueprint(bp([sh('a', { size: { x: 300, y: 10, z: 10 } })]))), /bed|within/);
  assert.match(bad(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 200, y: 0, z: 5 } }), sh('c', { position: { x: 100, y: 0, z: 5 } })]))), /bed|overlap/);
  assert.match(bad(validateBlueprint(bp([sh('a', { mode: 'hole' })]))), /solid/);
  assert.match(bad(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 100, y: 0, z: 5 } })]))), /overlap/);
  // pieces (templates): side by side on the plate is fine, a floating piece is not
  ok(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 100, y: 0, z: 5 } })]), { pieces: true }));
  assert.match(bad(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 100, y: 0, z: 30 } })]), { pieces: true })), /overlap/);
  assert.match(bad(validateBlueprint(bp(Array.from({ length: 21 }, (_, i) => sh(`s${i}`))))), /at most 20/);
  assert.match(bad(validateBlueprint(bp([sh('a', { size: { x: NaN, y: 1, z: 1 } })]))), /finite/);
  assert.match(bad(validateBlueprint(bp([sh('a', { position: { x: 1e9, y: 0, z: 0 } })]))), /finite/);
  assert.match(bad(validateBlueprint(bp([sh('a')], { extra: 1 }))), /unknown field/);
  assert.match(bad(validateBlueprint(JSON.parse('{"title":"t","__proto__":{"x":1}}'))), /forbidden/);
  assert.match(bad(validateBlueprint(bp([JSON.parse('{"__proto__":{},"id":"a"}')]))), /forbidden/);
  assert.match(bad(validateBlueprint(bp([sh('a')], { title: 'x'.repeat(61) }))), /title/);
  assert.match(bad(validateBlueprint(null)), /object/);
});

test('toDesign keeps valid incoming ids, replaces bad or duplicate ones', () => {
  const r = toDesign({ shapes: [sh('keep'), sh('keep'), sh('bad id!')] });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.shapes[0].id, 'keep'); assert.equal(new Set(r.shapes.map((s) => s.id)).size, 3); }
});

test('diff: add, remove, change', () => {
  const two = ok(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 5, y: 0, z: 5 } })])));
  const one = ok(validateBlueprint(bp([sh('a', { size: { x: 12, y: 10, z: 10 } })])));
  const d = diffBlueprints(two, one);
  assert.equal(d.removed.length, 1);
  assert.equal(d.added.length, 0);
  assert.ok(d.changed.some((c) => c.id === 'a' && c.field === 'size.x' && c.from === 10 && c.to === 12));
  assert.equal(diffBlueprints(one, two).added.length, 1);
});

test('diff: reassigned ids fall back to part name', () => {
  const a = ok(validateBlueprint(bp([sh('a'), sh('b', { position: { x: 5, y: 0, z: 5 } })])));
  const b = ok(validateBlueprint(bp([sh('x', { size: { x: 11, y: 10, z: 10 } }), sh('y', { position: { x: 5, y: 0, z: 5 } })])));
  const d = diffBlueprints(a, b);
  assert.equal(d.added.length + d.removed.length, 0);
  assert.deepEqual(d.changed.map((c) => [c.field, c.from, c.to]), [['size.x', 10, 11]]);
});

test('playground round trip', () => {
  const b = ok(validateBlueprint(bp([sh('a')])));
  const s = blueprintToShapes(b);
  assert.deepEqual(shapesToBlueprint(s).parts[0].shapes, s);
});
