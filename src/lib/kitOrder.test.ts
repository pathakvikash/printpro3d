// The six kits of src/lib/kits/: the adapter shape, and the server repricing of their 'kit' order lines (a printed part rebuilt from the kit file or read from its STL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_KIT_LINES, parseCart, type CartLine } from './cart.ts';
import { KITS, boughtPartIds, kitBlocked, kitLines, kitById } from './kits.ts';
import { isKitKey, kitPartByKey, kitPartMesh } from './kits/adapt.ts';
import { checkEntry, mergeChecked } from './orderChecks.ts';
import { priceKit } from './orderPricing.ts';
import { partById } from './parts.ts';
import { meshStats, quote } from './quote.ts';
import { shopCat } from './catalog.ts';
import { readFile } from 'node:fs/promises';

const NEW = ['whoop-kit', 'heli-kit', 'transformer-kit', 'rolling-companion-kit', 'led-decor-kit', 'rc-car', 'desk-pet', 'so101-arm', 'stack-chan'];
const kitKeys = (id: string) => [kitById(id)!, ...(kitById(id)!.variants ?? [])].flatMap((k) => k.items.map((i) => i.templateId));
const read = async (f: string) => { const b = await readFile(`public${f}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

test('all eleven kits are listed, each in a shop category, with unique ids', () => {
  assert.deepEqual(KITS.map((k) => k.id).sort(), ['desk-pet', 'fpv-3in-kit', 'heli-kit', 'led-decor-kit', 'rc-car', 'rolling-companion-kit', 'rover-kit', 'so101-arm', 'stack-chan', 'transformer-kit', 'whoop-kit']);
  for (const k of KITS) assert.equal(shopCat(k.id), k.category, k.id);
  assert.equal(shopCat('led-decor-kit'), 'smart-home');
  assert.equal(kitById('transformer-kit')!.badge, 'Beta');
  assert.equal(kitById('led-decor-kit')!.variants!.length, 3);
});

test('adapted kits: items resolve, assembly geometry keys are items, bought rows and refs point at real parts, credits are set', () => {
  for (const id of NEW) {
    const kit = kitById(id)!;
    for (const k of [kit, ...(kit.variants ?? [])]) {
      const keys = new Set(k.items.map((i) => i.templateId));
      assert.ok(keys.size >= 2, k.id);
      for (const key of keys) assert.ok(kitPartByKey(key), key);
      const asm = k.assembly!();
      for (const p of asm) if (p.geometry) assert.ok(typeof p.geometry === 'string' && keys.has(p.geometry), `${k.id}: geometry ${String(p.geometry)}`);
      for (const key of keys) assert.ok(asm.some((p) => p.geometry === key), `${k.id}: ${key} is in the finished build`);
    }
    for (const b of kit.boughtParts) for (const pid of boughtPartIds(b)) assert.ok(partById(pid), `${id}: part ${pid}`);
    for (const pid of Object.values(kit.refs ?? {})) assert.ok(partById(pid), `${id}: ref ${pid}`);
  }
  for (const id of ['rc-car', 'desk-pet']) {
    const c = kitById(id)!.credit!;
    assert.ok(c.author && c.licence && c.url.startsWith('https://') && c.files.length >= 5, id);
  }
  assert.equal(kitById('rc-car')!.credit!.licence, 'GPL-3.0');
  assert.equal(kitById('desk-pet')!.credit!.licence, 'Apache-2.0');
});

test('whole-kit cart lines are kind kit, fit the caps and survive the cart parser', () => {
  for (const id of NEW) for (const k of [kitById(id)!, ...(kitById(id)!.variants ?? [])]) {
    const lines = kitLines(k, () => 12.5);
    assert.ok(lines.length === k.items.length && lines.every((l) => l.kind === 'kit'), k.id);
    assert.equal(kitBlocked([], lines), null, k.id);
    assert.equal(parseCart(JSON.parse(JSON.stringify(lines))).length, lines.length, k.id);
  }
  // over the kit-line cap: refused whole, never half-added
  const many = ['desk-pet', 'transformer-kit'].flatMap((id) => kitLines(kitById(id)!, () => 1));
  assert.equal(many.length > MAX_KIT_LINES, true);
  assert.match(kitBlocked(kitLines(kitById('desk-pet')!, () => 1), kitLines(kitById('transformer-kit')!, () => 1))!, /kit parts/);
});

// each new kit kind is repriced by the server from the kit file: every printed part of every kit, STL and parametric
for (const id of NEW) {
  test(`server reprices ${id}: each printed part is rebuilt, closed, on the bed, and priced by quote()`, async () => {
    for (const key of kitKeys(id)) {
      const e = checkEntry({ kind: 'kit', id: key, cfg: [kitById(id)!, ...(kitById(id)!.variants ?? [])].flatMap((k) => k.items).find((i) => i.templateId === key)!.config, qty: 3, unitPrice: 0.01, total: 1, estimate: 1, label: 'cheap' }, 1);
      assert.equal(e.kind, 'kit');
      if (e.kind !== 'kit') return;
      const line = await priceKit(e.id, e.cfg, e.qty);
      const mesh = (await kitPartMesh(key, e.cfg, read))!;
      const stats = meshStats(mesh)!;
      const hit = kitPartByKey(key)!;
      assert.ok(stats, `${key}: closed mesh`);
      assert.deepEqual(line.quote, quote(stats, hit.part.material, 3), key);
      assert.equal(line.total, line.quote!.total);
      assert.ok(line.total! >= 99 && line.kind === 'kit' && line.material === hit.part.material, key); // MIN_ORDER
      assert.equal(JSON.stringify(line).includes('cheap'), false, 'the client label is never read');
    }
  });
}

test('checkEntry for kit lines: unknown part, bad config and bad qty are refused; the browser price is ignored; STL kits take no config', () => {
  assert.throws(() => checkEntry({ kind: 'kit', id: 'whoop-kit:nope', cfg: {}, qty: 1 }, 1), /unknown kit part/);
  assert.throws(() => checkEntry({ kind: 'kit', id: 'fpv-3in-kit:x', cfg: {}, qty: 1 }, 1), /unknown kit part/);
  assert.throws(() => checkEntry({ kind: 'kit', id: '../../etc/passwd', cfg: {}, qty: 1 }, 1), /unknown kit part/);
  assert.throws(() => checkEntry({ kind: 'kit', id: 'whoop-kit:frame', cfg: { duct: '999' }, qty: 1 }, 1), /item 1/);
  assert.throws(() => checkEntry({ kind: 'kit', id: 'whoop-kit:frame', cfg: {}, qty: 1 }, 1), /item 1/); // strict: every field present
  assert.throws(() => checkEntry({ kind: 'kit', id: 'rc-car:gear', cfg: {}, qty: 0 }, 1), /qty/);
  const good = checkEntry({ kind: 'kit', id: 'rc-car:gear', cfg: { anything: 1 }, qty: 2, unitPrice: 0 }, 1);
  assert.deepEqual(good, { n: 1, kind: 'kit', id: 'rc-car:gear', cfg: {}, qty: 2 });
  assert.equal(isKitKey('rc-car:gear'), true);
});

test('mergeChecked: the same kit part and config merges; the kit-line cap and MAX_QTY apply', () => {
  const cfg = kitById('heli-kit')!.items[0].config;
  const a = checkEntry({ kind: 'kit', id: 'heli-kit:skid', cfg, qty: 2 }, 1), b = checkEntry({ kind: 'kit', id: 'heli-kit:skid', cfg, qty: 3 }, 2);
  const m = mergeChecked([a, b]);
  assert.equal(m.length, 1);
  assert.equal(m[0].qty, 5);
  assert.throws(() => mergeChecked([a, checkEntry({ kind: 'kit', id: 'heli-kit:skid', cfg, qty: 99 }, 2)]), /quantity over/);
  const lines = kitLines(kitById('desk-pet')!, () => 1).concat(kitLines(kitById('heli-kit')!, () => 1)) as Extract<CartLine, { kind: 'kit' }>[];
  assert.throws(() => mergeChecked(lines.map((l, i) => checkEntry({ kind: 'kit', id: l.id, cfg: l.cfg, qty: 1 }, i + 1))), /different kit parts/);
});
