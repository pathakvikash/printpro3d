import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fitsBed, meshStats, quote } from '../quote.ts';
import { rcCarKit as kit } from './rc-car-kit.ts';

const PUB = join(import.meta.dirname, '../../../public');
function load(file: string) {
  const b = readFileSync(join(PUB, file)), n = b.readUInt32LE(80);
  assert.equal(84 + n * 50, b.length, `${file} is binary STL`);
  const p = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) for (let j = 0; j < 9; j++) p[i * 9 + j] = b.readFloatLE(84 + i * 50 + 12 + j * 4);
  return p;
}

test('rc-car printed parts exist, parse, are closed with positive volume, fit the bed and match the declared size', () => {
  for (const part of kit.printedParts) {
    assert.ok(existsSync(join(PUB, part.file)), part.file);
    const s = meshStats(load(part.file));
    assert.ok(s && s.volumeCm3 > 0, `${part.id} closed mesh`);
    assert.ok(fitsBed(s.sizeMm), `${part.id} fits 220x220x250`);
    [s.sizeMm.x, s.sizeMm.y, s.sizeMm.z].forEach((d, i) => assert.ok(Math.abs(d - part.size[i]) < 0.15, `${part.id} size axis ${i}`));
    const q = quote(s, part.material, part.qty); // price comes from the real mesh, never hard-coded
    assert.ok(q.total > 0 && q.grams > 0);
  }
});

test('rc-car credit, licence files, assembly and bought parts', () => {
  assert.ok(kit.credit.author && kit.credit.url.startsWith('https://github.com/') && kit.credit.licence === 'GPL-3.0');
  const dir = join(PUB, 'models/kits/rc-car');
  for (const f of ['LICENSE', 'CREDITS.md']) assert.ok(existsSync(join(dir, f)), f);
  assert.match(readFileSync(join(dir, 'LICENSE'), 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 3/);
  const ids = kit.assembly().map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const part of kit.printedParts) assert.ok(ids.includes(part.id), part.id);
  assert.ok(kit.boughtParts.length >= 4 && !/[$₹]|https?:/.test(JSON.stringify(kit.boughtParts)));
});
