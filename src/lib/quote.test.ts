import test from 'node:test';
import assert from 'node:assert/strict';
import { meshStats, fitsBed, quote } from './quote.ts';

// 10 mm cube, 12 triangles, outward winding
const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10];
const I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

test('cube stats', () => {
  const s = meshStats(P, I)!;
  assert.ok(Math.abs(s.volumeCm3 - 1) < 1e-9);
  assert.deepEqual(s.sizeMm, { x: 10, y: 10, z: 10 });
});

test('non-indexed cube', () => {
  const flat = I.flatMap((i) => P.slice(i * 3, i * 3 + 3));
  const s = meshStats(flat)!;
  assert.ok(Math.abs(s.volumeCm3 - 1) < 1e-9);
  assert.deepEqual(s.sizeMm, { x: 10, y: 10, z: 10 });
});

test('open mesh is rejected', () => {
  assert.equal(meshStats(P, I.slice(3)), null); // one face missing
  assert.equal(meshStats([5, 5, 5, 15, 5, 5, 5, 15, 5]), null); // single triangle off-origin
});

test('cube with top and bottom removed is rejected', () => {
  assert.equal(meshStats(P, I.slice(12)), null); // only the 8 side triangles remain
});

test('fitsBed allows rotation', () => {
  assert.equal(fitsBed({ x: 250, y: 100, z: 100 }), true);
  assert.equal(fitsBed({ x: 300, y: 10, z: 10 }), false);
});

test('quote', () => {
  const tiny = { volumeCm3: 0.001, sizeMm: { x: 1, y: 1, z: 1 } };
  assert.equal(quote(tiny, 'PLA', 1).total, 99);
  const cube = meshStats(P, I)!;
  assert.equal(quote(cube, 'PLA', 100).total, 348); // round(50 + 1*1.24*0.4*6*100)
  assert.ok(quote(cube, 'PLA', 100).total > quote(cube, 'PLA', 10).total);
  assert.throws(() => quote(cube, 'PLA', 0));
  assert.throws(() => quote(cube, 'GOLD', 1));
});
