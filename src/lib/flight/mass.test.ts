import test from 'node:test';
import assert from 'node:assert/strict';
import { meshBody, pointBody, combine, parallelAxis, printedDensity } from './mass.ts';
import { MATERIALS, FILL_FACTOR } from '../quote.ts';

/** Axis-aligned box [x0,x1]x[y0,y1]x[z0,z1], outward winding. */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, flip = false): number[] {
  const v = (i: number) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  const out: number[] = [];
  for (const q of quads) for (const t of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) for (const i of flip ? [...t].reverse() : t) out.push(...v(i));
  return out;
}
const close = (a: number, b: number, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('cube: I = m a^2 / 6, CG at centre, either winding', () => {
  for (const flip of [false, true]) {
    const b = meshBody(box(0, 20, 0, 20, 0, 20, flip), null, 1000)!; // 20 mm cube, 1000 kg/m3
    close(b.massKg, 1000 * 0.02 ** 3);
    for (const c of b.cgMm) close(c, 10);
    close(b.I.xx, (b.massKg * 0.02 ** 2) / 6); close(b.I.yy, b.I.xx); close(b.I.zz, b.I.xx);
    close(b.I.xy, 0, 1e-6); close(b.I.yz, 0, 1e-6); close(b.I.xz, 0, 1e-6);
  }
});

test('offset box: CG and cuboid inertia', () => {
  const b = meshBody(box(10, 30, -5, 5, 100, 104), null, 2000)!; // 20 x 10 x 4 mm
  [20, 0, 102].forEach((c, i) => close(b.cgMm[i], c));
  const m = b.massKg, [a, bb, c] = [0.02, 0.01, 0.004];
  close(b.I.xx, (m * (bb ** 2 + c ** 2)) / 12); close(b.I.zz, (m * (a ** 2 + bb ** 2)) / 12);
});

test('parallel axis and combine: two point masses', () => {
  const t = parallelAxis(2, [0.1, 0, 0]);
  close(t.yy, 0.02); close(t.zz, 0.02); close(t.xx, 0);
  const tot = combine([pointBody(1000, [-100, 0, 0]), pointBody(1000, [100, 0, 0])]);
  close(tot.massKg, 2); close(tot.cgMm[0], 0); close(tot.I.yy, 2 * 1 * 0.1 ** 2); close(tot.I.xx, 0);
});

test('printed density reuses quote MATERIALS x FILL_FACTOR', () => {
  close(printedDensity('PLA'), MATERIALS.PLA.density * 1000 * FILL_FACTOR);
});

test('degenerate mesh returns null', () => {
  assert.equal(meshBody([0, 0, 0, 1, 0, 0, 0, 1, 0], null, 1000), null);
});
