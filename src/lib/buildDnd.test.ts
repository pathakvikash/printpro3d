import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneShapes, membersOf, moveBy, placeTemplate, rotateZ90, snapGrid } from './buildDnd.ts';
import { solidsSize, type Shape } from './playground.ts';
import { TEMPLATES, defaultCfg } from './templateDefs.ts';
import { buildTemplate } from './templates.ts';

const box = (id: string, x: number, y: number, z: number, size = { x: 20, y: 10, z: 10 }): Shape =>
  ({ id, kind: 'box', mode: 'solid', position: { x, y, z }, rotation: { x: 0, y: 0, z: 0 }, size });

test('snapGrid rounds to 5 mm and never returns -0', () => {
  assert.equal(snapGrid(12.4), 10);
  assert.equal(snapGrid(12.6), 15);
  assert.ok(Object.is(snapGrid(-1), 0));
});

test('a built template drops as one group, centred on the grid, resting on the plate', () => {
  const t = TEMPLATES.find((x) => x.category === 'drone')!;
  const built = buildTemplate(t, defaultCfg(t)).shapes;
  const placed = placeTemplate(built, t.id, 'g1', { x: 33, y: -41 });
  assert.equal(placed.length, built.length);
  assert.ok(placed.every((s) => s.group === 'g1' && s.tpl === t.id && s.id.endsWith('~g1')));
  const sz = solidsSize(placed)!, sz0 = solidsSize(built)!;
  assert.ok(Math.abs(sz.x - sz0.x) < 0.01 && Math.abs(sz.z - sz0.z) < 0.01);
  assert.equal(membersOf(placed, placed[0].id).length, placed.length);
});

test('moving a group moves every member; a loose shape moves alone', () => {
  const all = [{ ...box('a', 0, 0, 5), group: 'g' }, { ...box('b', 30, 0, 5), group: 'g' }, box('c', 50, 50, 5)];
  assert.deepEqual(membersOf(all, 'a'), ['a', 'b']);
  assert.deepEqual(membersOf(all, 'c'), ['c']);
  const m = moveBy(all, membersOf(all, 'b'), { x: 5, y: -5, z: 0 });
  assert.deepEqual(m.map((s) => [s.position.x, s.position.y]), [[5, -5], [35, -5], [50, 50]]);
});

test('R turns a group 90 degrees about Z as a rigid body; four turns come back', () => {
  const all: Shape[] = [{ ...box('a', 0, 0, 5), group: 'g' }, { ...box('b', 30, 0, 5), group: 'g' }];
  const ids = ['a', 'b'];
  const once = rotateZ90(all, ids);
  const [a, b] = once;
  assert.ok(Math.abs(b.position.x - a.position.x) < 1e-6 && Math.abs(b.position.y - a.position.y - 30) < 1e-6); // the +X offset became +Y
  assert.ok(Math.abs(a.position.x - 15) < 1e-6, 'turns about the footprint centre'); // centre of x-extent [-10, 40] is 15
  assert.ok(Math.abs(a.rotation.z - 90) < 1e-6);
  const s = solidsSize(once)!, s0 = solidsSize(all)!;
  assert.ok(Math.abs(s.x - s0.y) < 1e-6 && Math.abs(s.y - s0.x) < 1e-6);
  let back = all;
  for (let i = 0; i < 4; i++) back = rotateZ90(back, ids);
  back.forEach((s2, i) => { assert.ok(Math.abs(s2.position.x - all[i].position.x) < 1e-6 && Math.abs(s2.position.y - all[i].position.y) < 1e-6); });
});

test('duplicating a group gives a new group with fresh ids', () => {
  const all: Shape[] = [{ ...box('a', 0, 0, 5), group: 'g' }, { ...box('b', 30, 0, 5), group: 'g' }];
  let n = 0;
  const c = cloneShapes(all, ['a', 'b'], { x: 10, y: 10, z: 0 }, () => `n${n++}`);
  assert.equal(c.length, 2);
  assert.ok(c[0].group === c[1].group && c[0].group !== 'g');
  assert.ok(c.every((s) => !['a', 'b'].includes(s.id)));
  assert.equal(c[0].position.x, 10);
});
