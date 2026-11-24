import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, defaultCfg, normalizeCfg, templateById, cfgKey, type Cfg, type TemplateDef } from './templateDefs.ts';
import { addLine, lineTotal, lineKey, parseCart, type CartLine } from './cart.ts';
import { mergeChecked } from './orderChecks.ts';
import { MAX_QTY } from './quote.ts';
import { buildTemplate, priceTemplate, templateMesh, templateOrderLine } from './templates.ts';
import { fitsBed, meshStats, quote } from './quote.ts';
import { analyzeMesh } from './meshAnalysis.ts';

const topology = (p: Float32Array) => { const t = analyzeMesh(p)!; return { pieces: t.pieces, genus: t.throughHoles }; };

const claim = (t: TemplateDef, cfg: Cfg) => {
  const b = buildTemplate(t, cfg);
  const mesh = templateMesh(b.shapes);
  assert.ok(mesh, `${t.id} builds`);
  const stats = meshStats(mesh);
  assert.ok(stats, `${t.id} mesh is closed`);
  return { b, mesh, stats };
};

test('every template default builds a closed mesh inside the bed, and its description matches the mesh', () => {
  assert.equal(TEMPLATES.length, 10);
  for (const t of TEMPLATES) {
    const { b, mesh, stats } = claim(t, defaultCfg(t));
    assert.ok(fitsBed(stats.sizeMm), `${t.id} fits the bed: ${JSON.stringify(stats.sizeMm)}`);
    const top = topology(mesh);
    assert.equal(top.pieces, b.parts, `${t.id} pieces`);
    assert.equal(top.genus, b.holes, `${t.id} through-holes`);
    if (b.holes) assert.ok(b.description.includes(`Openings through the part: ${b.holes}.`), t.id);
    if (b.parts > 1) assert.ok(b.description.includes(`Prints as ${b.parts} separate pieces.`), t.id);
    assert.ok(!/NaN|undefined/.test(b.description), t.id);
    assert.equal(t.marketLinks.length, 0); // owner fills these in
  }
});

test('config extremes and options still build closed meshes that fit and match', () => {
  const edge = (t: TemplateDef, pick: 'min' | 'max'): Cfg =>
    Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f[pick] : f.default]));
  const cases: [string, Cfg][] = [];
  for (const t of TEMPLATES) {
    cases.push([t.id, edge(t, 'min')], [t.id, edge(t, 'max')]);
    for (const f of t.fields) {
      if (f.type === 'select') for (const o of f.options) cases.push([t.id, { ...defaultCfg(t), [f.key]: o.value }]);
      if (f.type === 'bool') cases.push([t.id, { ...defaultCfg(t), [f.key]: !f.default }]);
    }
  }
  for (const [id, raw] of cases) {
    const t = templateById(id)!;
    const cfg = normalizeCfg(t, raw, true);
    const { b, mesh, stats } = claim(t, cfg);
    const label = `${id} ${cfgKey(t, cfg)}`;
    assert.ok(fitsBed(stats.sizeMm), `${label} fits: ${JSON.stringify(stats.sizeMm)}`);
    const top = topology(mesh);
    assert.deepEqual([top.pieces, top.genus], [b.parts, b.holes], label);
  }
});

test('seeded random configs build closed, fitting meshes whose pieces and holes match the description', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const t of TEMPLATES) {
    for (let i = 0; i < 6; i++) {
      const raw = Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f.min + rnd() * (f.max - f.min) : f.type === 'select' ? f.options[Math.floor(rnd() * f.options.length)].value : rnd() < 0.5]));
      const cfg = normalizeCfg(t, raw, true);
      const { b, mesh, stats } = claim(t, cfg);
      assert.ok(fitsBed(stats.sizeMm), `${t.id} ${cfgKey(t, cfg)}`);
      const top = topology(mesh);
      assert.deepEqual([top.pieces, top.genus], [b.parts, b.holes], `${t.id} ${cfgKey(t, cfg)}`);
    }
  }
});

test('description numbers follow the config', () => {
  const t = templateById('spacer-set')!;
  const b = buildTemplate(t, normalizeCfg(t, { screw: 'M4', od: 5, len: 12, count: 3 }));
  assert.ok(b.description.includes('3 round spacers') && b.description.includes('4.5 mm clearance hole') && b.description.includes('M4'));
  assert.ok(b.description.includes('raised to 6.5 mm')); // 4.5 + 2 > 5
  const e = templateById('enclosure-box')!;
  const d = buildTemplate(e, normalizeCfg(e, { ...defaultCfg(e), l: 60, vents: true })).description;
  assert.ok(d.includes('10 vent slots (5 in each long side)'), d); // floor((60 - 20) / 8) = 5 per side
});

test('normalizeCfg: strict rejects, lenient repairs', () => {
  const t = templateById('motor-mount')!;
  assert.throws(() => normalizeCfg(t, { motor: 'nope', base: 4 }, true));
  assert.throws(() => normalizeCfg(t, { motor: 'n20', base: 99 }, true));
  assert.throws(() => normalizeCfg(t, { motor: 'n20', base: 4, extra: 1 }, true));
  assert.throws(() => normalizeCfg(t, { motor: 'n20' }, true));
  assert.throws(() => normalizeCfg(t, null, true));
  // JSON bodies: __proto__/constructor arrive as own keys and are unknown fields; NaN-ish and huge numbers are refused
  assert.throws(() => normalizeCfg(t, JSON.parse('{"motor":"n20","base":4,"__proto__":{"polluted":1}}'), true), /unknown config field "__proto__"/);
  assert.throws(() => normalizeCfg(t, { motor: 'n20', base: 4, constructor: 1 }, true), /unknown/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  for (const base of [1e308, -1e308, Number.NaN, Infinity, '4', null]) assert.throws(() => normalizeCfg(t, { motor: 'n20', base }, true), /bad value/);
  assert.throws(() => normalizeCfg(t, { motor: '<img src=x onerror=alert(1)>', base: 4 }, true), /bad value/);
  assert.deepEqual(normalizeCfg(t, { motor: 'x', base: 99 }), defaultCfg(t));
  assert.equal(normalizeCfg(t, { motor: 'tt', base: 4.26 }, true).base, 4.5); // snapped to the step
});

test('server price: recomputed from the config, ignoring anything the client claims', () => {
  const t = templateById('phone-stand-pro')!;
  const small = priceTemplate(t.id, normalizeCfg(t, { ...defaultCfg(t), width: 50 }, true), 1);
  const big = priceTemplate(t.id, normalizeCfg(t, { ...defaultCfg(t), width: 100 }, true), 1);
  assert.ok(big.quote.total > small.quote.total, 'bigger config costs more');
  assert.equal(small.quote.total, quote(small.stats, t.material, 1).total);
  assert.equal(priceTemplate(t.id, defaultCfg(t), 5).quote.total, quote(priceTemplate(t.id, defaultCfg(t), 1).stats, t.material, 5).total);
  assert.throws(() => priceTemplate('nope', {}, 1), /unknown template/);
});

test('order line: price comes from the config; a cart line cannot set it', () => {
  const t = templateById('spacer-set')!;
  const cfg = normalizeCfg(t, { screw: 'M3', od: 12, len: 40, count: 12 }, true);
  const line = templateOrderLine(t, cfg, 3);
  assert.equal(line.total, line.quote.total);
  assert.equal(line.total, quote(priceTemplate(t.id, cfg, 3).stats, 'PETG', 3).total);
  assert.ok(line.config.includes('Screw size: M3') && line.config.includes('Length: 40'));
  // a cart line claiming unitPrice 0.01 is only a display figure; the server never reads it
  const cheat: CartLine = { kind: 'tpl', id: t.id, cfg, qty: 3, unitPrice: 0.01 };
  assert.ok((lineTotal(cheat) ?? 0) < line.total);
  assert.notEqual(line.total, lineTotal(cheat));
  // different settings are different cart lines; the same settings merge
  const other = { ...cheat, cfg: { ...cfg, len: 38 } };
  assert.equal(addLine(addLine([cheat], cheat), other).length, 2);
  assert.notEqual(lineKey(cheat), lineKey(other));
  assert.equal(parseCart([cheat, { ...cheat, id: 'nope' }, { ...cheat, unitPrice: 'x' }, { ...cheat, cfg: { screw: 'M9' } }]).length, 1); // stale/bad cfg, unknown id and bad price are all dropped
  assert.deepEqual(parseCart([{ ...cheat, cfg: { ...cfg, len: 38.4 } }]).map((l) => l.kind === 'tpl' && l.cfg.len), [38]); // in range: snapped, kept
  const a = { n: 1, kind: 'tpl' as const, tpl: t, cfg, qty: MAX_QTY };
  assert.throws(() => mergeChecked([a, { ...a, n: 2, qty: 1 }]), /over/);
  assert.equal(mergeChecked([{ ...a, qty: 1 }, { ...a, n: 2, qty: 2 }, { ...a, n: 3, cfg: { ...cfg, len: 38 }, qty: 1 }]).length, 2);
});

test('grid bin and drone mount: descriptions state what the mesh has; server price covers both', () => {
  const g = templateById('grid-bin')!;
  const gb = buildTemplate(g, normalizeCfg(g, { ux: 3, uy: 1, hu: 4, wall: 1.6, div: 2, label: true }, true));
  assert.ok(gb.description.includes('3 × 1 units') && gb.description.includes('28 mm') && gb.description.includes('2 dividers across the X length, 3 compartments') && gb.description.includes('label tab'), gb.description);
  assert.ok(/check fit on your baseplate/.test(gb.description) && /not the certified Gridfinity/.test(gb.description));
  const d = templateById('drone-camera-mount')!;
  const db = buildTemplate(d, normalizeCfg(d, { cam: '20', tilt: 35, pattern: '30.5', strap: 10 }, true));
  assert.ok(db.description.includes('4 M3 holes') && db.description.includes('2 strap slots') && db.description.includes('30.5 × 30.5') && db.description.includes('Openings through the part: 8.'), db.description);
  for (const t of [g, d]) {
    const lo = priceTemplate(t.id, normalizeCfg(t, Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f.min : f.default])), true), 1);
    const hi = priceTemplate(t.id, normalizeCfg(t, Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f.max : f.default])), true), 1);
    assert.ok(hi.quote.total > lo.quote.total, t.id);
    assert.equal(hi.quote.total, quote(hi.stats, t.material, 1).total);
    assert.equal(templateOrderLine(t, defaultCfg(t), 2).total, quote(priceTemplate(t.id, defaultCfg(t), 2).stats, t.material, 2).total);
  }
});

test('grid bin foot fits the opening of a bin with the thickest wall; tilted drone cheeks are bonded along their bottom edge', () => {
  const g = templateById('grid-bin')!;
  const wall = g.fields.find((f) => f.key === 'wall')!;
  for (const ux of [1, 4]) {
    const b = buildTemplate(g, normalizeCfg(g, { ...defaultCfg(g), ux, uy: ux, wall: wall.type === 'range' ? wall.max : 0 }, true));
    const cavity = b.shapes.find((s) => s.mode === 'hole')!;
    const feet = b.shapes.filter((s) => s.mode === 'solid' && s.position.z < 2);
    const outer = Math.max(...feet.map((s) => s.position.x + s.size.x / 2));
    assert.ok(outer <= cavity.size.x / 2 - 0.25, `${ux} units: foot edge ${outer} vs opening ${cavity.size.x / 2}`);
  }
  const d = templateById('drone-camera-mount')!;
  const b = buildTemplate(d, normalizeCfg(d, { ...defaultCfg(d), tilt: 40 }, true));
  const cheeks = b.shapes.filter((s) => s.rotation.x === 40 && s.kind === 'box');
  assert.equal(cheeks.length, 2);
  for (const c of cheeks) {
    const th = (40 * Math.PI) / 180, hiCornerZ = c.position.z + (c.size.y / 2) * Math.sin(th) - (c.size.z / 2) * Math.cos(th);
    const fill = b.shapes.find((s) => s.mode === 'solid' && s.rotation.x === 0 && Math.abs(s.position.x - c.position.x) < 0.01 && s.position.z > 3);
    assert.ok(fill && fill.position.z - fill.size.z / 2 < 3 && fill.position.z + fill.size.z / 2 > hiCornerZ - 1, 'cheek wedge reaches from the plate to its high corner');
  }
});
