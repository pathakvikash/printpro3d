import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MADE_ITEMS, MADE_GROUPS, madeById, madeHref, madeCategory } from './madeToOrder.ts';
import { CATEGORIES } from './catalog.ts';

test('made to order: unique ids, enquiry-only, groups filled, lookup, links and categories', () => {
  assert.equal(new Set(MADE_ITEMS.map((x) => x.id)).size, MADE_ITEMS.length);
  for (const x of MADE_ITEMS) {
    assert.equal(x.price, undefined); assert.equal(x.sku, undefined);
    assert.ok(x.needs.length > 0, x.id);
    assert.ok(!/[$₹€]|\bprice\b|in stock/i.test(JSON.stringify({ ...x, needs: 0 })), `${x.id}: no price or stock`);
    assert.ok(CATEGORIES.some((c) => c.id === madeCategory(x)), x.id);
  }
  for (const g of MADE_GROUPS) assert.ok(MADE_ITEMS.some((x) => x.group === g.id), g.id);
  for (const x of MADE_ITEMS) for (const g of [x.group, ...(x.alsoIn ?? [])]) assert.ok(MADE_GROUPS.some((k) => k.id === g), `${x.id}: group ${g}`);
  assert.ok(MADE_ITEMS.every((x) => !x.alsoIn?.includes(x.group)));
  assert.equal(madeById('name-sign')?.via, 'laser');
  assert.equal(madeById('nope'), null);
  assert.equal(madeById(undefined), null);
  assert.equal(madeHref(madeById('name-sign')!), '/laser?item=name-sign');
  assert.equal(madeHref(madeById('phone-stand')!), '/request?item=phone-stand');
  assert.equal(madeHref(madeById('name-keychain')!), '/request?item=name-keychain');
});
