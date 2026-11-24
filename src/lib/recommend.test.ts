import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendFor } from './recommend.ts';
import { CATALOG } from './catalog.ts';
import { MOTORS } from './motors.ts';
import { TEMPLATES } from './templateDefs.ts';

test('unknown id -> empty', () => {
  assert.deepEqual(recommendFor('nope'), { pairsWith: [], boughtParts: [] });
});

test('only existing ids are returned, never the product itself', () => {
  for (const id of ['drone-plate', 'motor-mount', 'drone-camera-mount', 'motor-wheel']) {
    const { pairsWith } = recommendFor(id);
    for (const p of pairsWith) assert.ok(CATALOG.some((x) => x.id === p) || TEMPLATES.some((x) => x.id === p), p);
    assert.ok(!pairsWith.includes(id));
  }
  assert.ok(recommendFor('drone-plate').pairsWith.includes('drone-camera-mount'));
});

test('motor data passes through from motors.ts', () => {
  const prop = MOTORS.find((m) => m.kind === 'prop')!;
  const part = recommendFor('drone-plate').boughtParts.find((b) => b.name === prop.name)!;
  assert.ok(part);
  assert.ok(part.spec.includes(prop.source.label) && part.spec.includes(prop.source.kind));
  const gear = recommendFor('motor-mount').boughtParts.filter((b) => MOTORS.some((m) => m.name === b.name));
  assert.equal(gear.length, MOTORS.filter((m) => m.kind === 'gear').length);
});
