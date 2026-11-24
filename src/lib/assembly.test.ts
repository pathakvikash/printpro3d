import test from 'node:test';
import assert from 'node:assert/strict';
import { flatLayLayout, explodedTransform, jointTransform, spinDeg, basePose, type AssemblyPart } from './assembly.ts';

const part = (id: string, size: [number, number, number], over: Partial<AssemblyPart> = {}): AssemblyPart => ({
  id, label: id, material: 'PLA', size, position: [0, 0, 0], rotation: [0, 0, 0], explode: [0, 0, 0], ...over,
});
const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));

test('explodedTransform moves along the explode vector, clamped to 0..1', () => {
  const p = part('a', [1, 1, 1], { position: [1, 2, 3], explode: [10, 0, -4] });
  near(explodedTransform(p, 0).position, [1, 2, 3]);
  near(explodedTransform(p, 0.5).position, [6, 2, 1]);
  near(explodedTransform(p, 9).position, [11, 2, -1]);
  near(explodedTransform(p, -1).position, [1, 2, 3]);
});

test('jointTransform turns about the pivot, clamps to the limits and carries the pivot with an exploded part', () => {
  const p = part('flap', [10, 2, 2], { position: [10, 0, 0], joint: { axis: [0, 0, 1], pivot: [0, 0, 0], min: 0, max: 90 } });
  near(jointTransform(p, 0).position, [10, 0, 0]);
  near(jointTransform(p, 90).position, [0, 10, 0]);
  near(jointTransform(p, 500).position, [0, 10, 0]); // clamped to max
  near(jointTransform(p, -20).position, [10, 0, 0]); // clamped to min
  const q = jointTransform(p, 90).quaternion; // 90 degrees about z
  near(q, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
  const moved = { ...p, explode: [0, 0, 5] as [number, number, number] };
  near(jointTransform(moved, 90, explodedTransform(moved, 1)).position, [0, 10, 5]);
  assert.deepEqual(jointTransform(part('x', [1, 1, 1]), 40), basePose(part('x', [1, 1, 1]))); // no joint: unchanged
});

test('spinDeg is rpm * 6 degrees per second', () => {
  assert.equal(spinDeg({ rpm: 60 }, 1), 360);
  assert.equal(spinDeg({ rpm: 10 }, 3), 180);
});

test('flatLayLayout: no overlap, inside the bed when it fits, flat on the table', () => {
  const parts = [part('a', [80, 60, 3]), part('b', [80, 40, 10]), part('c', [50, 50, 5]), part('d', [30, 30, 30]), part('e', [100, 20, 2])];
  const lay = flatLayLayout(parts);
  assert.ok(lay.fits);
  for (const p of parts) {
    const [x, y, z] = lay.positions[p.id];
    assert.equal(z, p.size[2] / 2);
    assert.ok(x - p.size[0] / 2 >= -110 && x + p.size[0] / 2 <= 110 && y - p.size[1] / 2 >= -110 && y + p.size[1] / 2 <= 110, p.id);
  }
  for (const a of parts) for (const b of parts) {
    if (a.id >= b.id) continue;
    const [ax, ay] = lay.positions[a.id], [bx, by] = lay.positions[b.id];
    const apart = Math.abs(ax - bx) >= (a.size[0] + b.size[0]) / 2 || Math.abs(ay - by) >= (a.size[1] + b.size[1]) / 2;
    assert.ok(apart, `${a.id} overlaps ${b.id}`);
  }
});

test('flatLayLayout reports parts that overrun the bed, still without overlap, and handles no parts', () => {
  const many = Array.from({ length: 12 }, (_, i) => part(`p${i}`, [90, 90, 4]));
  const lay = flatLayLayout(many);
  assert.equal(lay.fits, false);
  const keys = new Set(Object.values(lay.positions).map((v) => `${v[0]},${v[1]}`));
  assert.equal(keys.size, 12);
  assert.deepEqual(flatLayLayout([]).positions, {});
  assert.ok(flatLayLayout([]).fits);
});
