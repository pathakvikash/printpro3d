import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMesh } from './meshAnalysis.ts';

type V = [number, number, number];
// axis-aligned box as 12 triangles, outward winding; `inward` flips it (a cavity wall)
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, inward = false): number[] {
  const c = (i: number): V => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  const out: number[] = [];
  for (const [a, b, d, e] of quads) for (const t of [[a, b, d], [a, d, e]]) for (const i of inward ? [...t].reverse() : t) out.push(...c(i));
  return out;
}
// n square frames (slab with a square through-hole) side by side, each a closed genus-1 shell
function slabWithHoles(n: number): number[] {
  const out: number[] = [];
  const W = 20, D = 20, H = 5, h = 6;
  for (let k = 0; k < n; k++) {
    const ox = k * W;
    const o: V[] = [[ox, 0, 0], [ox + W, 0, 0], [ox + W, D, 0], [ox, D, 0]];
    const m = (W - h) / 2, q = (D - h) / 2;
    const i: V[] = [[ox + m, q, 0], [ox + m + h, q, 0], [ox + m + h, q + h, 0], [ox + m, q + h, 0]];
    // top/bottom: 4 trapezoids joining outer and inner squares
    for (const z of [0, H]) for (let j = 0; j < 4; j++) {
      const a = o[j], b = o[(j + 1) % 4], c = i[(j + 1) % 4], d = i[j];
      const at = (v: V): V => [v[0], v[1], z];
      const tri = z ? [[a, b, c], [a, c, d]] : [[a, c, b], [a, d, c]];
      for (const t of tri) for (const v of t) out.push(...at(v));
    }
    // outer and inner walls
    for (let j = 0; j < 4; j++) {
      for (const [ring, flip] of [[o, false], [i, true]] as const) {
        const a = ring[j], b = ring[(j + 1) % 4];
        const quad: V[] = [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], H], [a[0], a[1], H]];
        const t = flip ? [[0, 2, 1], [0, 3, 2]] : [[0, 1, 2], [0, 2, 3]];
        for (const tt of t) for (const idx of tt) out.push(...quad[idx]);
      }
    }
  }
  return out;
}

test('cube: closed, one piece, no holes, exact size and volume', () => {
  const a = analyzeMesh(box(0, 0, 0, 10, 10, 10))!;
  assert.equal(a.triangles, 12);
  assert.deepEqual(a.sizeMm, { x: 10, y: 10, z: 10 });
  assert.ok(Math.abs(a.volumeCm3! - 1) < 1e-9);
  assert.equal(a.isClosed, true);
  assert.equal(a.pieces, 1);
  assert.equal(a.throughHoles, 0);
  assert.equal(a.fitsBed, true);
  assert.match(a.orientation, /Flat base/);
  assert.ok(a.limits.length >= 3);
});

test('through-holes: one frame is 1 hole, two frames are 2 pieces and 2 holes', () => {
  const f = slabWithHoles(1);
  const a = analyzeMesh([...f, ...f.map((v, i) => (i % 3 === 0 ? v + 100 : v))])!;
  assert.equal(a.pieces, 2);
  assert.equal(a.throughHoles, 2);
  assert.equal(analyzeMesh(f)!.throughHoles, 1);
});

test('open mesh: not closed, no volume, no hole count', () => {
  const a = analyzeMesh(box(0, 0, 0, 10, 10, 10).slice(0, 11 * 9))!;
  assert.equal(a.isClosed, false);
  assert.equal(a.volumeCm3, null);
  assert.equal(a.throughHoles, null);
});

test('two separate pieces', () => {
  const a = analyzeMesh([...box(0, 0, 0, 10, 10, 10), ...box(50, 0, 0, 60, 10, 10)])!;
  assert.equal(a.pieces, 2);
  assert.equal(a.throughHoles, 0);
  assert.equal(a.isClosed, true);
});

test('too big for the bed, and empty input', () => {
  assert.equal(analyzeMesh(box(0, 0, 0, 900, 10, 10))!.fitsBed, false);
  assert.equal(analyzeMesh([]), null);
});
