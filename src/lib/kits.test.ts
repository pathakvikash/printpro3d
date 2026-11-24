import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, shopCat } from './catalog.ts';
import { MAX_TPL_LINES, addLine, lineKey, type CartLine } from './cart.ts';
import { KITS, kitBlocked, kitById, kitLines } from './kits.ts';
import { TEMPLATES, normalizeCfg, templateById } from './templateDefs.ts';
import { priceTemplate } from './templates.ts';

test('kit ids are unique and do not clash with parts; each has a shop category and bought parts', () => {
  const ids = [...CATALOG, ...TEMPLATES, ...KITS].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const k of KITS) {
    assert.equal(shopCat(k.id), k.category, k.id);
    assert.ok(k.boughtParts.length >= 4 && k.items.length >= 5, k.id);
    assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(k.blurb + k.boughtParts.join(' ')), `${k.id}: no prices or links`);
  }
  assert.equal(kitById('nope'), null);
});

test('every kit item exists, its config is valid, it prices and fits the bed, and a kit fits one order', () => {
  for (const k of KITS) {
    const tplItems = k.items.filter((i) => templateById(i.templateId));
    for (const i of k.items) {
      assert.ok(Number.isInteger(i.qty) && i.qty >= 1, `${k.id} ${i.templateId} qty`);
      const t = templateById(i.templateId);
      if (!t) { assert.ok(CATALOG.some((c) => c.id === i.templateId), `${k.id}: ${i.templateId} exists`); continue; }
      const cfg = normalizeCfg(t, i.config, true); // strict: every field present and in range
      priceTemplate(t.id, cfg, i.qty); // builds, closed mesh, fits the bed
    }
    assert.equal(new Set(tplItems.map((i) => i.templateId)).size, tplItems.length, `${k.id}: a repeated part is a quantity`);
    assert.ok(tplItems.length <= MAX_TPL_LINES, `${k.id} has ${tplItems.length} configured lines`);
    // the blurb states the quantities the kit really holds
    for (const i of k.items.filter((x) => x.qty > 1)) assert.ok(k.blurb.includes(`${i.qty} `), `${k.id} blurb mentions ${i.qty}`);
  }
});

test('adding a kit is all or nothing and respects the 5 configured-part cap', () => {
  const k = KITS[0];
  const lines = kitLines(k, () => 1);
  assert.equal(lines.length, k.items.length);
  assert.equal(kitBlocked([], lines), null);
  // the same kit twice merges into the same lines: still fine
  const twice = lines.reduce<CartLine[]>((c, l) => addLine(c, l), lines.slice());
  assert.equal(kitBlocked(twice, lines), null);
  // a different configured part already in the cart pushes it over the cap
  const t = templateById('spacer-set')!;
  const extra: CartLine = { kind: 'tpl', id: t.id, cfg: normalizeCfg(t, {}), qty: 1, unitPrice: 1 };
  const msg = kitBlocked([extra], lines);
  assert.match(msg ?? '', /at most 5 different configured parts/);
  assert.notEqual(lineKey(extra), lineKey(lines[1]));
  // the other kit shares battery-tray settings only if equal: different config is a different line
  assert.ok(kitLines(KITS[1], () => 1).filter((l) => l.kind === 'tpl').length <= MAX_TPL_LINES);
});
