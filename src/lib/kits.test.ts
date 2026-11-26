import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, shopCat } from './catalog.ts';
import { MAX_TPL_LINES, addLine, lineKey, type CartLine } from './cart.ts';
import { isKitKey } from './kits/adapt.ts';
import { KITS, boughtPartIds, boughtText, kitBlocked, kitById, kitLines, kitsUsingPart } from './kits.ts';
import { partById } from './parts.ts';
import { TEMPLATES, normalizeCfg, templateById } from './templateDefs.ts';
import { priceTemplate } from './templates.ts';
import { eulerQuat, type AssemblyPart, type V3 } from './assembly.ts';

// the two kits made of shop templates; the kits of src/lib/kits/ are covered by kitOrder.test.ts and their own tests
const OWN = KITS.filter((k) => k.items.every((i) => !isKitKey(i.templateId)));

test('kit ids are unique and do not clash with parts; each has a shop category and bought parts', () => {
  const ids = [...CATALOG, ...TEMPLATES, ...KITS].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const k of KITS) {
    assert.equal(shopCat(k.id), k.category, k.id);
    assert.ok(k.boughtParts.length >= (k.id === 'car-robot' ? 0 : 2) && k.items.length >= 3, k.id); // the car-robot upstream lists no bought parts
    assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(k.blurb + k.boughtParts.map(boughtText).join(' ')), `${k.id}: no prices or links`);
  }
  assert.equal(kitById('nope'), null);
});

test('every kit item exists, its config is valid, it prices and fits the bed, and a kit fits one order', () => {
  for (const k of OWN) {
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

test('adding a kit is all or nothing and respects the 6 configured-part cap', () => {
  const k = kitById('fpv-3in-kit')!;
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
  assert.match(msg ?? '', /at most 6 different configured parts/);
  assert.notEqual(lineKey(extra), lineKey(lines[1]));
  // the other kit shares battery-tray settings only if equal: different config is a different line
  assert.ok(kitLines(kitById('rover-kit')!, () => 1).filter((l) => l.kind === 'tpl').length <= MAX_TPL_LINES);
});

// axis-aligned box of a part after its rotation, from its 8 corners
function box(p: AssemblyPart) {
  const [x, y, z, w] = eulerQuat(p.rotation);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const c of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const v = [0, 1, 2].map((i) => ((c >> i) & 1 ? 1 : -1) * p.size[i] / 2);
    const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    const r = [v[0] + w * t[0] + y * t[2] - z * t[1], v[1] + w * t[1] + z * t[0] - x * t[2], v[2] + w * t[2] + x * t[1] - y * t[0]];
    r.forEach((a, i) => { lo[i] = Math.min(lo[i], p.position[i] + a); hi[i] = Math.max(hi[i], p.position[i] + a); });
  }
  return { lo, hi };
}
const TOL = 0.5;
const meshSizes = (k: (typeof KITS)[number]) => Object.fromEntries(k.items.filter((i) => templateById(i.templateId)).map((i) => { const z = priceTemplate(i.templateId, i.config, 1).stats.sizeMm; return [i.templateId, [z.x, z.y, z.z] as V3]; }));

test('kit assemblies: the right parts, nominal sizes match the real meshes, printed parts neither float nor overlap', () => {
  for (const k of OWN) {
    assert.ok(k.assembly, k.id);
    const real = meshSizes(k);
    for (const [id, sz] of Object.entries(real)) sz.forEach((v, i) => assert.ok(Math.abs(v - (k.assembly!()[0] && sizeOf(k, id)[i])) <= TOL, `${k.id} ${id} nominal size drifted`));
    const parts = k.assembly!(real);
    assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, `${k.id}: unique ids`);
    // every kit item is drawn, in its quantity
    for (const i of k.items) assert.equal(parts.filter((p) => p.geometry === i.templateId).length, i.qty, `${k.id} ${i.templateId} count`);
    for (const p of parts) assert.ok(!!p.bought === (p.material === 'bought') && !!p.bought === (p.geometry === undefined), `${k.id} ${p.id} bought flag`);
    const printed = parts.filter((p) => !p.bought).map((p) => ({ p, ...box(p) }));
    for (const a of printed) {
      const supported = a.lo[2] <= TOL || parts.some((o) => o !== a.p && (Math.abs(box(o).hi[2] - a.lo[2]) <= TOL || Math.abs(box(o).lo[2] - a.hi[2]) <= TOL) && [0, 1].every((i) => Math.min(a.hi[i], box(o).hi[i]) - Math.max(a.lo[i], box(o).lo[i]) > 0));
      assert.ok(supported, `${k.id}: ${a.p.id} floats (neither rests on nor hangs from a part)`);
      for (const b of printed) if (a.p.id < b.p.id) assert.ok([0, 1, 2].some((i) => Math.min(a.hi[i], b.hi[i]) - Math.max(a.lo[i], b.lo[i]) <= TOL), `${k.id}: ${a.p.id} overlaps ${b.p.id}`);
    }
  }
});
const sizeOf = (k: (typeof KITS)[number], id: string) => k.assembly!().find((p) => p.geometry === id)!.size;

test('bought-separately rows that reference a part point at a real part page', () => {
  for (const k of KITS) for (const b of k.boughtParts) for (const id of boughtPartIds(b)) assert.ok(partById(id), `${k.id}: ${id}`);
  assert.deepEqual(kitsUsingPart('stack-20x20', KITS).map((k) => k.id), ['fpv-3in-kit']);
});
