import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleStl, parseStl, longestSide } from './stlScale.ts';
import { analyzeModel } from './analyzeModel.ts';

// 20 mm cube, 12 triangles, outward winding
const P = [0, 0, 0, 20, 0, 0, 20, 20, 0, 0, 20, 0, 0, 0, 20, 20, 0, 20, 20, 20, 20, 0, 20, 20];
const I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const tris = () => Array.from({ length: 12 }, (_, t) => I.slice(t * 3, t * 3 + 3).flatMap((i) => P.slice(i * 3, i * 3 + 3)));

function binary(): Buffer {
  const b = Buffer.alloc(84 + 12 * 50);
  b.writeUInt32LE(12, 80);
  tris().forEach((t, i) => t.forEach((v, k) => b.writeFloatLE(v, 84 + i * 50 + 12 + k * 4)));
  return b;
}
function ascii(): string {
  return `solid cube\n${tris().map((t) => `facet normal 0 0 0\n outer loop\n${[0, 3, 6].map((o) => `  vertex ${t[o]} ${t[o + 1]} ${t[o + 2]}`).join('\n')}\n endloop\nendfacet`).join('\n')}\nendsolid cube\n`;
}

for (const [name, src] of [['binary', binary()], ['ascii', Buffer.from(ascii())]] as const) {
  test(`${name} 20 mm cube scaled to 50 is 50x50x50 mm and 125 cm3`, () => {
    const out = scaleStl(src, 50);
    assert.equal(out.length, 84 + 12 * 50); // always binary out
    const s = analyzeModel(out, '.stl')!;
    assert.ok(s, 'closed mesh');
    for (const d of ['x', 'y', 'z'] as const) assert.ok(Math.abs(s.sizeMm[d] - 50) < 1e-6);
    assert.ok(Math.abs(s.volumeCm3 - 125) < 1e-6);
  });
}

test('scaling is uniform on the longest side', () => {
  const t = tris().map((v) => v.map((x, k) => (k % 3 === 0 ? x * 2 : x))); // 40 x 20 x 20
  const b = Buffer.alloc(84 + 12 * 50);
  b.writeUInt32LE(12, 80);
  t.forEach((v, i) => v.forEach((x, k) => b.writeFloatLE(x, 84 + i * 50 + 12 + k * 4)));
  const out = scaleStl(b, 80);
  assert.ok(Math.abs(longestSide(parseStl(out)) - 80) < 1e-4);
  const s = analyzeModel(out, '.stl')!;
  assert.ok(Math.abs(s.sizeMm.y - 40) < 1e-4);
});

test('rejects garbage and bad sizes', () => {
  assert.throws(() => scaleStl(Buffer.from('not an stl'), 10), /STL/);
  assert.throws(() => scaleStl(Buffer.alloc(10), 10), /STL/);
  assert.throws(() => scaleStl(binary(), 0), /size/i);
  assert.throws(() => scaleStl(binary(), NaN), /size/i);
});
