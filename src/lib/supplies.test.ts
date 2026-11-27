import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPLIES, SUPPLY_GROUPS, supplyById } from './supplies.ts';

test('supplies: unique ids, enquiry-only, every group filled, lookup', () => {
  assert.equal(new Set(SUPPLIES.map((s) => s.id)).size, SUPPLIES.length);
  for (const s of SUPPLIES) {
    assert.equal(s.price, undefined); assert.equal(s.sku, undefined);
    assert.ok(!/[$₹€]|\bprice\b|in stock/i.test(JSON.stringify(s)), `${s.id}: no price or stock`);
  }
  for (const g of SUPPLY_GROUPS) assert.ok(SUPPLIES.some((s) => s.group === g.id), g.id);
  assert.equal(supplyById('filament-pla')?.title, 'PLA filament');
  assert.equal(supplyById('nope'), null);
  assert.equal(supplyById(undefined), null);
});
