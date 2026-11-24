import test from 'node:test';
import assert from 'node:assert/strict';
import { BED_MM, fitsBed, meshStats, quote } from '../quote.ts';
import { analyzeMesh } from '../meshAnalysis.ts';
import { KIT_WHOOP_KIT as kit, canopyBox, clipFlat, defaults, describe, facts, validate } from './whoop-kit.ts';

const EXTREMES = [
  { name: 'default', cfg: defaults },
  { name: 'large', cfg: { duct: '75', motorPattern: 8, aio: '20', camAngle: 35 } },
  { name: 'small', cfg: { duct: '65', motorPattern: 5, aio: '25.5', camAngle: 10 } },
];

// every build is expensive (CSG), so each part and config is built once and shared by the tests below
const cache = new Map<string, Float32Array>();
function mesh(id: string, cfg: Record<string, unknown>) {
  const key = id + JSON.stringify(cfg);
  if (!cache.has(key)) {
    const g = kit.printedParts.find((p) => p.id === id)!.build(cfg as never);
    cache.set(key, g.attributes.position.array as Float32Array);
  }
  return cache.get(key)!;
}

test('config: defaults are valid, bad values fall back, strict rejects them', () => {
  assert.deepEqual(validate(defaults, true), defaults);
  assert.deepEqual(validate({ duct: '99', motorPattern: 50, camAngle: 'x' }), defaults);
  assert.throws(() => validate({ duct: '99' }, true));
  assert.equal(kit.id, 'whoop-kit');
  assert.equal(kit.category, 'Drone & RC');
});

test('every printed part is one closed piece that fits the bed, at default and at config extremes', { timeout: 180000 }, () => {
  for (const { name, cfg } of EXTREMES) {
    for (const p of kit.printedParts) {
      const m = mesh(p.id, cfg);
      const s = meshStats(m);
      assert.ok(s, `${p.id} (${name}) is a closed manifold`);
      assert.ok(fitsBed(s.sizeMm), `${p.id} (${name}) fits ${BED_MM.x}x${BED_MM.y}x${BED_MM.z}`);
      assert.equal(analyzeMesh(m)!.pieces, 1, `${p.id} (${name}) is one piece`);
      // price only ever comes from the shared formula, through the mesh volume
      assert.ok(quote(s, p.material, p.qty).unitPrice > 0);
    }
  }
});

test('clipFlat cuts a closed mesh flat and keeps it closed', () => {
  // a 10 mm cube with its corner cell below z = 0: 12 triangles, built by hand
  const c = [[0, 0, -3], [10, 0, -3], [10, 10, -3], [0, 10, -3], [0, 0, 7], [10, 0, 7], [10, 10, 7], [0, 10, 7]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const flat = clipFlat(Float32Array.from(f.flatMap((t) => t.flatMap((i) => c[i]))))!;
  const s = meshStats(flat)!;
  assert.ok(s && Math.abs(s.volumeCm3 - 0.7) < 1e-6 && Math.abs(s.sizeMm.z - 7) < 1e-6 && Math.abs(Math.min(...flat.filter((_, i) => i % 3 === 2))) < 1e-9);
});

test('the frame fits where it should: size, bolt holes and print height', () => {
  for (const { name, cfg } of EXTREMES) {
    const s = meshStats(mesh('frame', cfg))!;
    const c = validate(cfg), D = Number(c.duct), prop = D === 65 ? 31 : 40;
    const half = D / (2 * Math.SQRT2) + prop / 2 + 1 + 1.2;
    assert.ok(Math.abs(s.sizeMm.x - 2 * half) < 0.3 && Math.abs(s.sizeMm.y - 2 * half) < 0.3, `frame footprint (${name})`);
    assert.ok(Math.abs(s.sizeMm.z - facts(c).ductHeight) < 0.1, `frame height (${name})`);
  }
});

test('blurb hole counts match the meshes', () => {
  // frame openings through the part: 16 bolt holes + 4 wire bores + 2 lead holes + 2 strap holes + the openings the ducts and
  // spokes leave (measured once, constant across configs); the blurb states only the named ones, so check the named ones add up.
  const named = (c: Record<string, unknown>) => { const f = facts(c as never); return f.boltHoles + f.wireBores + f.leadHoles + f.strapHoles; };
  const structural = analyzeMesh(mesh('frame', defaults))!.throughHoles! - named(defaults);
  for (const { name, cfg } of EXTREMES) {
    assert.equal(analyzeMesh(mesh('frame', cfg))!.throughHoles, named(cfg) + structural, `frame openings (${name})`);
  }
  const f = facts(defaults);
  // tab: 2 screw holes + 2 strap slots
  assert.equal(analyzeMesh(mesh('strap-tab', defaults))!.throughHoles, f.tabHoles + f.tabSlots);
  // canopy: 2 pillar holes + 2 roof vents + antenna bore + camera window (lens through the tip)
  const canopyNamed = f.pillarHoles + f.vents;
  const canopyHoles = (cfg: Record<string, unknown>) => analyzeMesh(mesh('canopy', cfg))!.throughHoles!;
  const extra = canopyHoles(defaults) - canopyNamed;
  for (const { name, cfg } of EXTREMES) assert.equal(canopyHoles(cfg), canopyNamed + extra, `canopy openings (${name})`);
  assert.equal(extra, 2, 'the two unnamed canopy openings are the antenna tube bore and the camera window');
  // the blurb states the numbers it was built from
  const text = describe(defaults);
  assert.ok(text.includes('16 bolt holes') && text.includes('6.6 mm apart') && text.includes('3.6 mm wire bore') && text.includes('2 screw pillars') && text.includes('2 roof vents'));
  assert.ok(text.includes('tilted 25 degrees') && text.includes('4 ducts') && text.includes('31 mm props'));
  assert.equal(kit.blurb, text);
  assert.ok(describe({ ...defaults, duct: '75', camAngle: 35 }).includes('40 mm props'));
});

test('the canopy box used by the assembly matches the mesh', () => {
  for (const { name, cfg } of EXTREMES) {
    const m = mesh('canopy', cfg);
    const s = meshStats(m)!;
    const b = canopyBox(validate(cfg));
    assert.ok(Math.abs(s.sizeMm.z - (b.z1 - b.z0)) < 0.05, `canopy height (${name})`);
    assert.ok(Math.abs(s.sizeMm.y - 2 * b.yHalf) < 0.1, `canopy width (${name})`);
    const xs = []; for (let i = 0; i < m.length; i += 3) xs.push(m[i]);
    assert.ok(Math.abs(Math.min(...xs) - b.x0) < 0.1 && Math.abs(Math.max(...xs) - b.x1) < 0.1, `canopy x range (${name})`);
  }
});

test('assembly: unique ids, printed parts referenced, bought parts are placeholders, joints and spin are sane', () => {
  for (const { name, cfg } of EXTREMES) {
    const parts = kit.assembly(cfg as never);
    const ids = parts.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `unique ids (${name})`);
    for (const p of kit.printedParts) {
      const hits = parts.filter((a) => a.geometry === p.id && !a.bought);
      assert.equal(hits.length, p.qty, `${p.id} appears ${p.qty}x (${name})`);
    }
    for (const a of parts) {
      assert.ok(a.size.every((v) => v > 0), `${a.id} has a size`);
      if (a.bought) { assert.equal(a.material, 'bought'); assert.equal(a.geometry, undefined); } else assert.notEqual(a.material, 'bought');
      if (a.joint) assert.ok(a.joint.min <= 0 && a.joint.max >= 0 && a.joint.min < a.joint.max, `${a.id} joint range`);
    }
    const props = parts.filter((a) => a.id.startsWith('prop'));
    assert.equal(props.length, 4);
    assert.ok(props.every((p) => p.spin && p.spin.rpm !== 0));
    assert.equal(props.filter((p) => p.spin!.rpm > 0).length, 2, 'two props turn each way');
    assert.equal(parts.filter((a) => a.id.startsWith('motor')).length, 4);
    for (const id of ['aio', 'battery', 'camera']) assert.ok(parts.some((a) => a.id === id), id);
  }
});

test('assembly: the canopy sits on the frame and the printed bounding boxes match the parts', () => {
  const parts = kit.assembly(defaults);
  const get = (id: string) => parts.find((p) => p.id === id)!;
  const fs = meshStats(mesh('frame', defaults))!.sizeMm;
  assert.ok(get('frame').size.every((v, i) => Math.abs(v - [fs.x, fs.y, fs.z][i]) < 0.3));
  assert.ok(Math.abs(get('canopy').position[2] - get('canopy').size[2] / 2 - 3) < 0.01, 'canopy rim rests on the frame beams (3 mm)');
  assert.deepEqual(get('canopy').rotation, [180, 0, 0], 'canopy is printed upside down');
  assert.ok(get('strap-tab').position[2] < 0, 'tab sits under the frame');
  // motors sit over the hubs, props inside the ducts
  const prop = get('prop1'), motor = get('motor1');
  assert.deepEqual(prop.position.slice(0, 2), motor.position.slice(0, 2));
  assert.ok(prop.position[2] + prop.size[2] / 2 <= 14, 'prop stays inside the 14 mm duct');
});

test('bought parts list: typical sizes, no prices or links', () => {
  assert.ok(kit.boughtParts.length >= 5);
  for (const b of kit.boughtParts) {
    assert.equal(b.typical, true);
    assert.ok(Number.isInteger(b.qty) && b.qty >= 1);
    assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(`${b.name} ${b.spec}`), `${b.name}: no prices or links`);
  }
  assert.ok(!/[$₹]|https?:/i.test(kit.blurb));
  assert.equal(kit.boughtParts.find((b) => b.name === 'Brushless motor')!.qty, 4);
});
