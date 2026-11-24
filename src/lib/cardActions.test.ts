import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from './catalog.ts';
import { exampleById } from './examples.ts';
import { cardActions } from './cardActions.ts';

test('every card kind has exactly a primary and a secondary with a destination', () => {
  assert.equal(cardActions('item', 'pawn', 'pawn').secondary.href, '/playground?mode=build&example=pawn');
  assert.equal(cardActions('item', 'x', null).secondary.href, '/shop/x');
  assert.deepEqual(cardActions('template', 't1').secondary, { label: 'Customise', hint: 'Customise this product', icon: 'wrench', href: '/shop/t1' });
  assert.equal(cardActions('kit', 'k').primary.label, 'Add');
  assert.equal(cardActions('part', 'a b').primary.href, '/request?part=a%20b');
  assert.equal(cardActions('part', 'm').secondary.href, '/shop/part/m');
});

test('every catalog item maps to a real builder example', () => {
  for (const i of CATALOG) assert.ok(exampleById(i.exampleId), i.id);
});
