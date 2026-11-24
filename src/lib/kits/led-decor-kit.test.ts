import test from 'node:test';
import assert from 'node:assert/strict';
import { DoubleSide, IcosahedronGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { KIT_LED_DECOR_KIT as K, ledClockPixels, validateLedDecorConfig } from './led-decor-kit.ts';
import { analyzeMesh } from '../meshAnalysis.ts';
import { fitsBed, meshStats } from '../quote.ts';
import type { Cfg } from '../templateDefs.ts';

const base = K.config.defaults;
// default and the extremes of each product's own fields
const CONFIGS: Record<string, Cfg[]> = {
  matrix: [{}, { grid: '16', pitch: 12 }, { grid: '8', pitch: 8 }],
  clock: [{ display: 'seg7' }, { display: 'oled' }],
  lamp: [{}, { lampD: 100 }, { lampD: 180, facets: '2' }],
};

test('config: defaults validate strictly, bad values and unknown keys throw', () => {
  assert.deepEqual(validateLedDecorConfig(base), base);
  assert.throws(() => validateLedDecorConfig({ ...base, pitch: 20 }));
  assert.throws(() => validateLedDecorConfig({ ...base, grid: '12' }));
  assert.throws(() => validateLedDecorConfig({ ...base, nope: 1 }));
  assert.equal(K.id, 'led-decor-kit');
  assert.equal(K.category, 'Smart Home & Decor');
});

test('every printed part is one closed piece that fits the bed, at default and at extremes; the stated opening counts match the mesh', () => {
  for (const [product, cfgs] of Object.entries(CONFIGS)) {
    for (const over of cfgs) {
      const cfg = validateLedDecorConfig({ ...base, ...over, product });
      for (const p of K.products[product as 'matrix'].printedParts) {
        const pos = p.build(cfg).attributes.position.array as Float32Array;
        const label = `${p.id} ${JSON.stringify(over)}`;
        const stats = meshStats(pos);
        assert.ok(stats, `${label} is a closed manifold`);
        assert.ok(fitsBed(stats.sizeMm), `${label} fits the bed (${JSON.stringify(stats.sizeMm)})`);
        const a = analyzeMesh(pos)!;
        assert.equal(a.pieces, 1, `${label} pieces`);
        assert.equal(a.throughHoles, p.holes(cfg), `${label} openings`);
        assert.equal(Number(/(\d+) openings?/.exec(p.describe(cfg))![1]), a.throughHoles, `${label} text states the mesh's opening count`);
        assert.ok(p.orientation.length > 10 && p.qty >= 1);
      }
    }
  }
});

test('blurb claims: baffles have one cell per LED, the lamp wall is 1.2 mm, facet counts are real', () => {
  const m8 = validateLedDecorConfig({ ...base, grid: '8' });
  assert.equal(analyzeMesh(K.printedParts.find((p) => p.id === 'led-baffle')!.build(m8).attributes.position.array as Float32Array)!.throughHoles, 64);
  assert.match(K.blurb, /1\.2 mm wall/);
  assert.match(K.blurb, /8x8 or 16x16/);
  assert.match(K.blurb, /typical 10 mm/);
  for (const [lampD, facets] of [[120, '1'], [100, '2']] as const) {
    const cfg = validateLedDecorConfig({ ...base, product: 'lamp', lampD, facets });
    const shell = K.printedParts.find((p) => p.id === 'lamp-shell')!;
    const mesh = new Mesh(shell.build(cfg), new MeshBasicMaterial({ side: DoubleSide }));
    mesh.updateMatrixWorld(true);
    const R = lampD / 2, hits = new Raycaster(new Vector3(0.31, 0.17, 0.2 * R), new Vector3(0, 0, 1)) /* off the axis: a vertex or edge may lie on it */.intersectObject(mesh);
    assert.equal(hits.length, 2, 'ray through the dome crosses inner and outer surface once each');
    const wall = hits[1].distance - hits[0].distance;
    assert.ok(wall >= 1.2 - 1e-3 && wall < 1.5, `wall along the axis ${wall}`);
    const tris = new IcosahedronGeometry(1, Number(facets)).attributes.position.count / 3;
    assert.equal(tris, 20 * (Number(facets) + 1) ** 2);
    assert.ok(shell.describe(cfg).includes(`${tris} triangular facets`));
  }
});

test('assembly: unique ids, every printed part of the product is referenced once, bought parts are placeholders, joints in range', () => {
  for (const product of ['matrix', 'clock', 'lamp'] as const) {
    for (const over of CONFIGS[product]) {
      const cfg = validateLedDecorConfig({ ...base, ...over, product });
      const parts = K.assembly(cfg);
      assert.deepEqual(parts.map((p) => p.id), K.products[product].assembly(cfg).map((p) => p.id));
      assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, `${product} unique ids`);
      const geoms = K.geometries(cfg);
      for (const pp of K.products[product].printedParts) {
        const refs = parts.filter((p) => p.geometry === pp.id);
        assert.equal(refs.length, pp.qty, `${pp.id} referenced`);
        assert.equal(refs[0].material, pp.material);
        assert.ok(geoms[pp.id], `${pp.id} geometry`);
      }
      assert.ok(parts.filter((p) => p.bought).length >= 3, `${product} has bought placeholders`);
      for (const p of parts) {
        assert.ok(p.size.every((s) => s > 0), `${p.id} size`);
        assert.ok([...p.position, ...p.rotation, ...p.explode].every(Number.isFinite), `${p.id} numbers`);
        if (p.bought) { assert.equal(p.material, 'bought'); assert.equal(p.geometry, undefined); } else assert.equal(typeof p.geometry, 'string');
        if (p.joint) assert.ok(p.joint.min <= p.joint.max, `${p.id} joint range`);
        if (p.spin) assert.ok(Number.isFinite(p.spin.rpm));
      }
    }
  }
  // the clock leans back on its stand: the case sits above the slab and its centre is over the slab
  const clock = K.assembly(validateLedDecorConfig({ ...base, product: 'clock' }));
  const stand = clock.find((p) => p.id === 'clock-stand')!, shell = clock.find((p) => p.id === 'clock-shell')!;
  assert.ok(shell.position[2] > 4 && Math.abs(shell.position[1] - stand.position[1]) < stand.size[1] / 2);
});

test('bought parts: typical sizes, no prices, no links; the union covers ESP32, LED, supply and diffuser', () => {
  const names = K.boughtParts.map((b) => b.name).join('|');
  for (const w of ['ESP32', 'WS2812 LED panel', 'WS2812 LED strip', '5 V 2 A USB-C', 'Diffuser']) assert.ok(names.includes(w), w);
  assert.equal(new Set(K.boughtParts.map((b) => b.name)).size, K.boughtParts.length);
  for (const b of K.boughtParts) {
    assert.equal(b.typical, true);
    assert.ok(b.qty >= 1);
    assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(`${b.name} ${b.spec}`), `${b.name}: no prices or links`);
  }
});

const lit = (px: boolean[], w: number) => px.map((v, i) => (v ? `${i % w},${Math.floor(i / w)}` : '')).filter(Boolean);
const rows = (px: boolean[], w: number, h: number) => Array.from({ length: h }, (_, y) => px.slice(y * w, y * w + w).map((v) => (v ? '#' : '.')).join(''));

test('ledClockPixels renders HH:MM in a 3x5 font, centred, with a blinking colon', () => {
  const px = ledClockPixels(new Date(2024, 0, 1, 9, 41, 0), 16, 16);
  assert.equal(px.length, 256);
  // 15 columns wide on a 16 wide grid (column offset 0), rows 5..9 of 16; colon on at an even second
  assert.deepEqual(rows(px, 16, 16).slice(5, 10).map((r) => r.slice(0, 15)), ['###.###.#.#..#.', '#.#.#.###.#.##.', '#.#.###.###..#.', '#.#...##..#..#.', '###.###...#.###']);
  assert.equal(rows(px, 16, 16).filter((r) => r.includes('#')).length, 5);
  const on = ledClockPixels(new Date(2024, 0, 1, 9, 41, 2), 16, 16), off = ledClockPixels(new Date(2024, 0, 1, 9, 41, 3), 16, 16);
  assert.deepEqual(lit(on, 16).filter((s) => !lit(off, 16).includes(s)), ['7,6', '7,8']); // the colon: column 7, rows 1 and 3 of the 5
  assert.deepEqual(lit(off, 16).filter((s) => !lit(on, 16).includes(s)), []);
});

test('ledClockPixels: other digits, other sizes, and the narrow-grid fallback', () => {
  const g = rows(ledClockPixels(new Date(2024, 0, 1, 12, 30, 0), 16, 16), 16, 16).slice(5, 10).map((r) => r.slice(0, 15));
  assert.deepEqual(g, ['.#..###.###.###', '##....##..#.#.#', '.#..###.###.#.#', '.#..#..#..#.#.#', '###.###.###.###']);
  const wide = ledClockPixels(new Date(2024, 0, 1, 0, 0, 1), 20, 7); // 00:00, colon off: 15 wide, offset 2 across and 1 down
  assert.equal(wide.length, 140);
  const xs = lit(wide, 20).map((s) => Number(s.split(',')[0])), ys = lit(wide, 20).map((s) => Number(s.split(',')[1]));
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [2, 16, 1, 5]);
  // 8x8 cannot hold four 3-wide digits: HH on even seconds, MM on odd, 7 wide, rows 1..5
  const hh = rows(ledClockPixels(new Date(2024, 0, 1, 11, 7, 0), 8, 8), 8, 8), mm = rows(ledClockPixels(new Date(2024, 0, 1, 11, 7, 1), 8, 8), 8, 8);
  assert.deepEqual(hh.slice(1, 6), ['.#...#..', '##..##..', '.#...#..', '.#...#..', '###.###.']);
  assert.deepEqual(mm.slice(1, 6), ['###.###.', '#.#...#.', '#.#...#.', '#.#...#.', '###...#.']);
  assert.equal(hh[0] + hh[7], '................');
  assert.equal(ledClockPixels(new Date(), 0, 0).length, 0);
});
