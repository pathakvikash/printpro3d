import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, SHOP_CATEGORIES, shopCat, shopVisible } from './catalog.ts';
import { TEMPLATES } from './templateDefs.ts';
import { KITS } from './kits.ts';
import { PRODUCTS, productById } from './shopProducts.ts';
import { PRODUCT_CARDS } from './productCards.ts';
import { KIT_METAS } from './kitMeta.ts';
import { isKitKey, kitPartByKey } from './kits/adapt.ts';
import { templateById } from './templateDefs.ts';

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
  for (const c of SHOP_CATEGORIES) assert.ok(shopVisible([...CATALOG, ...TEMPLATES, ...KITS]).some((x) => shopCat(x.id) === c.id), c.id);
});
test('the shop lists 9 new parts and 15 kits per their categories (counts)', () => {
  const count = (c: string) => shopVisible(TEMPLATES).filter((t) => shopCat(t.id) === c).length;
  assert.equal(shopVisible(TEMPLATES).length, 17); // 7 older shop templates + 9 new + the 3 inch frame
  assert.equal(count('drone-rc'), 8);
  assert.equal(count('robotics'), 8);
  assert.equal(count('accessories'), 1);
  assert.deepEqual(KITS.map((k) => shopCat(k.id)), ['drone-rc', 'robotics', 'drone-rc', 'drone-rc', 'toys-hobby', 'robotics', 'smart-home', 'drone-rc', 'robotics', 'robotics', 'robotics', 'drone-rc', 'robotics', 'drone-rc', 'robotics', 'toys-hobby']);
  for (const id of ['gps-antenna-mount', 'landing-gear', 'prop-guard', 'rc-bumper', 'battery-tray', 'servo-bracket', 'robot-chassis', 'robot-gripper', 'wheel-hub']) assert.ok(shopCat(id), id);
});

test('the light /shop card data (productCards.ts, kitMeta.ts) matches the real products and kits', () => {
  assert.deepEqual(PRODUCT_CARDS.map((p) => p.item.id), PRODUCTS.map((p) => p.item.id));
  const name = (i: { templateId: string; label?: string }) => isKitKey(i.templateId) ? (i.label ?? kitPartByKey(i.templateId)?.part.label ?? i.templateId) : templateById(i.templateId)?.name ?? productById(i.templateId)?.item.name ?? i.templateId;
  const want = KITS.map((k) => ({ id: k.id, title: k.title, blurb: k.blurb, category: k.category, ...(k.badge ? { badge: k.badge } : {}), ...(k.credit ? { design: { author: k.credit.author, licence: k.credit.licence } } : {}), ...(k.variants ? { products: k.variants.map((v) => v.title) } : {}), hasAssembly: !!k.assembly, ...(k.assemblyData === false ? { assemblyData: false } : {}), parts: k.items.map((i) => ({ name: name(i), qty: i.qty })), bought: k.boughtParts.length }));
  assert.deepEqual(KIT_METAS, want, 'src/lib/kitMeta.ts is stale: paste JSON.stringify of the expected list into KIT_METAS');
});
