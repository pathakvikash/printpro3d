// Customer kit settings: every config field of the four configurable kits is validated by the server (range, options, unknown keys),
// and a non-default valid config is repriced from the rebuilt mesh like any other kit line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kitById, kitLines } from './kits.ts';
import { kitSettings, kitPartMesh, validateKitCfg, settingsSummary } from './kits/adapt.ts';
import { checkEntry } from './orderChecks.ts';
import { priceKit } from './orderPricing.ts';
import { meshStats, quote } from './quote.ts';
import { parseCart } from './cart.ts';
import type { Cfg } from './templateDefs.ts';

// kit (or product variant) -> a valid config other than the defaults, touching every shown field
const ALT: [string, Cfg][] = [
  ['whoop-kit', { duct: '75', motorPattern: 7, aio: '20', camAngle: 30 }],
  ['heli-kit', { shaft: '3', len: 200, servos: '3', servoClass: '3.7' }],
  ['transformer-kit', { clearance: 0.45, magnets: false }],
  ['led-decor-kit/matrix', { grid: '8', pitch: 12 }],
  ['led-decor-kit/clock', { display: 'oled' }],
  ['led-decor-kit/lamp', { lampD: 150, facets: '2' }],
];
const kitFor = (id: string) => { const [k, v] = id.split('/'); return v ? kitById(k)!.variants!.find((x) => x.id === id)! : kitById(k)!; };

for (const [id, alt] of ALT) {
  test(`${id}: settings cover the schema, bad configs are rejected, a non-default config reprices from its own mesh`, async () => {
    const st = kitSettings(kitFor(id))!;
    assert.ok(st && st.fields.length > 0);
    assert.deepEqual(Object.keys(alt).sort(), st.fields.map((f) => f.key).sort(), 'the alternative touches every shown field');
    const kit = st.build(alt);
    const dflt = st.build(st.defaults);
    const key = kit.items[0].templateId;
    const full = (i: (typeof kit.items)[number]) => ({ ...i.config });
    // server: every field rejects out-of-range / unknown values; an unknown key and a missing key are refused
    const good = full(kit.items[0]);
    assert.doesNotThrow(() => validateKitCfg(key, good));
    for (const f of st.fields) {
      const bad = f.type === 'range' ? [f.min - f.step, f.max + f.step, NaN, '5'] : f.type === 'select' ? ['nope', 3] : ['yes', 1];
      for (const v of bad) assert.throws(() => checkEntry({ kind: 'kit', id: key, cfg: { ...good, [f.key]: v }, qty: 1 }, 1), /bad value|item 1/, `${id}.${f.key}=${String(v)}`);
      const missing = Object.fromEntries(Object.entries(good).filter(([k]) => k !== f.key));
      assert.throws(() => checkEntry({ kind: 'kit', id: key, cfg: missing, qty: 1 }, 1), /bad value/, `${id}: ${f.key} missing`);
    }
    assert.throws(() => checkEntry({ kind: 'kit', id: key, cfg: { ...good, bogus: 1 }, qty: 1 }, 1), /unknown config field/);
    // priced from the rebuilt mesh (the first two parts: each is a CSG rebuild), and different from the default for at least one of them
    let differs = false;
    for (const [n, item] of kit.items.slice(0, 2).entries()) {
      const e = checkEntry({ kind: 'kit', id: item.templateId, cfg: full(item), qty: 2, unitPrice: 0.01 }, 1);
      if (e.kind !== 'kit') throw new Error('kind');
      const line = await priceKit(e.id, e.cfg, e.qty);
      if (n === 0) {
        const stats = meshStats((await kitPartMesh(item.templateId, e.cfg))!)!;
        assert.ok(stats, `${item.templateId}: closed mesh`);
        assert.deepEqual(line.quote, quote(stats, line.kind === 'kit' ? line.material : 'PLA', 2), item.templateId);
      }
      const d = await priceKit(dflt.items[n].templateId, dflt.items[n].config, 2);
      if (d.total !== line.total || JSON.stringify(d.quote) !== JSON.stringify(line.quote)) differs = true;
    }
    assert.ok(differs, `${id}: the new settings change at least one of the first two parts' quote`);
  });
}

test('heli: an impossible servo combination is refused', () => {
  const st = kitSettings(kitById('heli-kit')!)!;
  assert.throws(() => st.build({ ...st.defaults, servos: '3', servoClass: '3.7', len: 150 }), /165/);
});

test('cart lines of a configured kit name the kit and the settings, and survive the cart parser', () => {
  const kit = kitById('whoop-kit')!, st = kitSettings(kit)!, cfgd = st.build({ ...st.defaults, duct: '75' });
  const note = settingsSummary(st.fields, { ...st.defaults, duct: '75' });
  assert.match(note, /Duct size 75 mm/);
  const lines = kitLines(cfgd, () => 5, { name: kit.title, note });
  for (const l of lines) assert.ok(l.kind === 'kit' && l.label.startsWith('65/75 mm whoop kit · ') && l.cfg.duct === '75');
  const back = parseCart(JSON.parse(JSON.stringify(lines)));
  assert.equal(back.length, lines.length);
  assert.ok(back.every((l) => l.kind === 'kit' && l.note === note));
});

test('template kits and STL kits have no settings panel', () => {
  for (const id of ['fpv-3in-kit', 'rover-kit', 'rc-car', 'desk-pet']) assert.equal(kitSettings(kitById(id)!), null, id);
});
