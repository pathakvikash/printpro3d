import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, SHOP_CATEGORIES, shopCat, shopVisible } from './catalog';
import { TEMPLATES } from './templateDefs';
import { PRODUCTS } from './shopProducts';

test('shop ids are unique across fixed items and templates', () => {
  const ids = [...CATALOG, ...TEMPLATES].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('every visible item has a valid shop category and a design', () => {
  for (const x of shopVisible([...CATALOG, ...TEMPLATES])) assert.ok(SHOP_CATEGORIES.some((c) => c.id === shopCat(x.id)), x.id);
  for (const item of shopVisible(CATALOG)) assert.ok(PRODUCTS.some((p) => p.item.id === item.id), item.id);
});
test('unrelated household items are hidden from the shop but still in the catalogue', () => {
  for (const id of ['phone-stand', 'shelf-bracket', 'cable-clip', 'phone-stand-pro', 'cable-clip-pro', 'name-plate']) {
    assert.equal(shopCat(id), null, id);
  }
  assert.ok(CATALOG.some((i) => i.id === 'shelf-bracket'));
});
test('every shop category has at least one item', () => {
  for (const c of SHOP_CATEGORIES) assert.ok(shopVisible([...CATALOG, ...TEMPLATES]).some((x) => shopCat(x.id) === c.id), c.id);
});
