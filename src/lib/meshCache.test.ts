import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMesh, encodeMesh, hash, kitKey, shapesKey } from './meshCache.ts';
import type { Shape } from './playground.ts';

const s = (id: string, x = 1): Shape => ({ id, kind: 'box', mode: 'solid', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x, y: 2, z: 3 } });

test('hash is stable and 14 hex chars', () => {
  assert.equal(hash('a'), hash('a'));
  assert.notEqual(hash('a'), hash('b'));
  assert.match(hash('whoop'), /^[0-9a-f]{14}$/);
});

test('shape key ignores counter ids, sees size, template flag and late order', () => {
  assert.equal(shapesKey([s('p1')], true), shapesKey([s('p9')], true));
  assert.notEqual(shapesKey([s('p1')], true), shapesKey([s('p1', 1.5)], true));
  assert.notEqual(shapesKey([s('p1')], true), shapesKey([s('p1')], false));
  assert.notEqual(shapesKey([s('p1')], true), shapesKey([s('late1')], true));
});

test('kit key ignores property order', () => {
  assert.equal(kitKey('k:a', { x: 1, y: 2 }), kitKey('k:a', { y: 2, x: 1 }));
  assert.notEqual(kitKey('k:a', { x: 1 }), kitKey('k:a', { x: 2 }));
});

test('mesh round trip, bad sizes rejected', () => {
  const m = Float32Array.from({ length: 18 }, (_, i) => i * 0.37 - 2);
  const bytes = encodeMesh(m);
  const back = decodeMesh(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  assert.deepEqual(Array.from(back!), Array.from(m));
  assert.equal(decodeMesh(new ArrayBuffer(10)), null);
  assert.equal(decodeMesh(new ArrayBuffer(0)), null);
});
