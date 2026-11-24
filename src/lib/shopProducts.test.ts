import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, SHOP_CATEGORIES, shopCat, shopVisible } from './catalog.ts';
import { TEMPLATES } from './templateDefs.ts';
import { KITS } from './kits.ts';
import { PRODUCTS } from './shopProducts.ts';

test('shop ids are unique across fixed items and templates', () => {
  const ids = [...CATALOG, ...TEMPLATES, ...KITS].map((x) => x.id);
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
test('the shop lists 9 new parts and 2 kits per their categories (counts)', () => {
  const count = (c: string) => shopVisible(TEMPLATES).filter((t) => shopCat(t.id) === c).length;
  assert.equal(shopVisible(TEMPLATES).length, 16); // 7 older shop templates + 9 new
  assert.equal(count('drone-rc'), 7);
  assert.equal(count('robotics'), 8);
  assert.equal(count('accessories'), 1);
  assert.deepEqual(KITS.map((k) => shopCat(k.id)), ['drone-rc', 'robotics']);
  for (const id of ['gps-antenna-mount', 'landing-gear', 'prop-guard', 'rc-bumper', 'battery-tray', 'servo-bracket', 'robot-chassis', 'robot-gripper', 'wheel-hub']) assert.ok(shopCat(id), id);
});
