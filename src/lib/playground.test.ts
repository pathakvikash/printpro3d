import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeModel } from './analyzeModel.ts';
import { buildMesh, toStl, solidsSize, parseDesign, minZ, DEFAULT_SIZE, type Shape, type Kind } from './playground.ts';

let n = 0;
const sh = (kind: Kind, size: number[], pos: number[], mode: Shape['mode'] = 'solid', rot = [0, 0, 0]): Shape => ({
  id: String(n++), kind, mode,
  size: { x: size[0], y: size[1], z: size[2] },
  position: { x: pos[0], y: pos[1], z: pos[2] },
  rotation: { x: rot[0], y: rot[1], z: rot[2] },
});

/** same path as the UI: shapes -> mesh -> STL bytes -> the server's analyzeModel */
function measure(shapes: Shape[]) {
  const tris = buildMesh(shapes);
  assert.ok(tris, 'mesh built');
  return { stats: analyzeModel(Buffer.from(toStl(tris)), '.stl'), tris };
}
function check(name: string, shapes: Shape[], expectCm3: number) {
  const { stats } = measure(shapes);
  console.log(`${name}: measured ${stats?.volumeCm3.toFixed(4)} cm3, expected ${expectCm3.toFixed(4)} cm3, size ${JSON.stringify(stats?.sizeMm)}`);
  assert.ok(stats, `${name}: stats must be non-null (closed manifold)`);
  assert.ok(Math.abs(stats.volumeCm3 - expectCm3) / expectCm3 < 0.02, `${name}: volume ${stats.volumeCm3} vs ${expectCm3}`);
  return stats;
}

test('(a) single 20 mm box = 8 cm3', () => {
  check('a', [sh('box', [20, 20, 20], [0, 0, 10])], 8);
});

test('(b) two overlapping boxes offset 10 mm = 12 cm3 (union, not 16)', () => {
  check('b', [sh('box', [20, 20, 20], [0, 0, 10]), sh('box', [20, 20, 20], [10, 0, 10])], 12);
});

test('(c) 30x30x10 box minus through-hole r=5 = 8.215 cm3', () => {
  check('c', [sh('box', [30, 30, 10], [0, 0, 5]), sh('cylinder', [10, 10, 20], [0, 0, 5], 'hole')], 9 - Math.PI * 0.25);
});

test('(d) sphere r=10 union cylinder r=4 h=40 through it', () => {
  const R = 10, a = 4, H = 40;
  const half = Math.sqrt(R * R - a * a), cap = R - half;
  const inside = Math.PI * a * a * 2 * half + 2 * (Math.PI * cap * cap * (3 * R - cap)) / 3;
  const expect = ((4 / 3) * Math.PI * R ** 3 + Math.PI * a * a * H - inside) / 1000;
  const stats = check('d', [sh('sphere', [20, 20, 20], [0, 0, 20]), sh('cylinder', [8, 8, 40], [0, 0, 20])], expect);
  // Z-up: the cylinder's 40 mm axis is the vertical extent of the STL
  assert.ok(Math.abs(stats.sizeMm.z - 40) < 1e-3 && Math.abs(stats.sizeMm.x - 20) < 1e-3);
});

test('every primitive, and a rotated one, prices as a closed mesh', () => {
  for (const k of ['box', 'cylinder', 'sphere', 'cone', 'torus', 'wedge'] as Kind[]) {
    const s = sh(k, Object.values(DEFAULT_SIZE[k]), [0, 0, 10]);
    assert.ok(measure([s]).stats, k);
  }
  assert.ok(measure([sh('box', [20, 20, 20], [0, 0, 20], 'solid', [30, 20, 10]), sh('wedge', [20, 20, 20], [5, 0, 10])]).stats, 'rotated union');
});

test('STL vertical extent equals the height the UI shows, and drop-to-plate math', () => {
  const shapes = [sh('box', [20, 20, 30], [0, 0, 15]), sh('cone', [20, 20, 25], [0, 0, 42.5])];
  const ui = solidsSize(shapes)!;
  const { stats, tris } = measure(shapes);
  assert.ok(Math.abs(ui.z - 55) < 1e-9 && Math.abs(stats!.sizeMm.z - ui.z) < 1e-3);
  let lo = Infinity;
  for (let i = 2; i < tris.length; i += 3) lo = Math.min(lo, tris[i]);
  assert.equal(lo, 0); // sits on the plate
  assert.ok(Math.abs(minZ(sh('box', [10, 10, 10], [0, 0, 20])) - 15) < 1e-9);
});

test('no solids -> no mesh; hole-only -> no mesh; a hole that eats everything -> no mesh', () => {
  assert.equal(buildMesh([]), null);
  assert.equal(buildMesh([sh('box', [10, 10, 10], [0, 0, 5], 'hole')]), null);
  assert.equal(solidsSize([sh('box', [10, 10, 10], [0, 0, 5], 'hole')]), null);
});

test('parseDesign drops junk and clamps', () => {
  assert.deepEqual(parseDesign('nope'), []);
  assert.deepEqual(parseDesign(null), []);
  const d = parseDesign(JSON.stringify([{ id: 'a', kind: 'box', size: { x: -5, y: 'x' } }, { id: 'b', kind: 'evil' }, 7, { id: 'a', kind: 'box' }]));
  assert.equal(d.length, 1);
  assert.equal(d[0].size.x, 0.1);
  assert.equal(d[0].size.y, 20);
  assert.equal(d[0].mode, 'solid');
});

import { EXAMPLES } from './examples.ts';
import { BED_MM, fitsBed, meshStats } from './quote.ts';
import { MAX_SHAPES } from './playground.ts';

test('every example prices, fits the bed, sits on the plate', () => {
  assert.ok(EXAMPLES.length >= 6);
  for (const e of EXAMPLES) {
    assert.ok(e.shapes.length < 12, e.id);
    const t0 = Date.now();
    const { stats, tris } = measure(e.shapes);
    console.log(`example ${e.id}: ${stats?.volumeCm3.toFixed(3)} cm3, bbox ${JSON.stringify(stats?.sizeMm && { x: +stats.sizeMm.x.toFixed(1), y: +stats.sizeMm.y.toFixed(1), z: +stats.sizeMm.z.toFixed(1) })}, ${Date.now() - t0} ms`);
    assert.ok(stats, `${e.id}: stats non-null`);
    assert.ok(stats.volumeCm3 > 0 && fitsBed(stats.sizeMm), e.id);
    let lo = Infinity;
    for (let i = 2; i < tris.length; i += 3) lo = Math.min(lo, tris[i]);
    assert.ok(Math.abs(lo) < 0.01, `${e.id}: lowest point ${lo}`); // the grown retry may move faces by a few microns
    assert.ok(Math.abs(minZ(e.shapes.filter((s) => s.mode === 'solid').reduce((a, b) => (minZ(a) < minZ(b) ? a : b)))) < 1e-6, e.id);
    for (const s of e.shapes) assert.ok(Math.abs(s.position.x) < BED_MM.x / 2 && Math.abs(s.position.y) < BED_MM.y / 2, e.id);
  }
});

test('the design that used to throw (stale edge index) does not throw', () => {
  const s = [sh('sphere', [10, 25, 10], [5, -10, 10]), sh('cylinder', [10, 35, 25], [5, -5, 5], 'solid', [45, 0, 0]), sh('box', [10, 30, 30], [5, 10, 25], 'hole'), sh('box', [35, 30, 5], [-5, 10, 10], 'hole'), sh('cylinder', [10, 20, 20], [5, 5, 5], 'hole')];
  assert.doesNotThrow(() => buildMesh(s));
});

test('20 shapes: timing and parse cap', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ ...sh('box', [10, 10, 10], [(i % 5) * 12 - 24, Math.floor(i / 5) * 12 - 24, 5]), id: `m${i}` }));
  assert.equal(parseDesign(JSON.stringify(many)).length, MAX_SHAPES);
  const heavy = Array.from({ length: MAX_SHAPES }, (_, i) =>
    i < 10 ? { ...sh('sphere', [20, 20, 20], [i * 8 - 36, (i % 2) * 6, 10]), id: `h${i}` }
      : { ...sh('cylinder', [5, 5, 40], [(i - 10) * 8 - 32, 3, 10], 'hole'), id: `h${i}` });
  const t0 = Date.now();
  const hm = buildMesh(heavy);
  assert.ok(hm && meshStats(hm), '20-shape design closes');
  console.log(`20-shape build: ${Date.now() - t0} ms`);
  assert.equal(parseDesign(JSON.stringify([{ id: 'a', kind: 'box', position: { x: 1e9 } }]))[0].position.x, 10000);
});

// fuzz-found designs: each stage of buildMesh earns its keep (found by trying random designs with a stage switched off)
const closed = (s: Shape[], o = {}) => { const t = buildMesh(s, o); return !!t && meshStats(t) !== null; };
const fz = (kind: Kind, size: number[], pos: number[], mode: Shape['mode'] = 'solid', rot = [0, 0, 0]) => sh(kind, size, pos, mode, rot);

test('T-junction repair is needed: these go open without it', () => {
  const a = [fz('box', [25, 20, 25], [10, 15, 10], 'solid', [30, 0, 0]), fz('box', [15, 15, 15], [10, -10, 15]), fz('box', [30, 15, 25], [-5, 5, 20], 'hole'), fz('cone', [25, 25, 20], [10, -15, 30], 'hole')];
  const b = [fz('cone', [30, 20, 15], [10, -10, 15]), fz('wedge', [30, 25, 20], [5, 5, 15], 'solid', [0, 0, 90])];
  for (const d of [a, b]) { assert.ok(closed(d)); assert.ok(!closed(d, { repair: false })); }
});

test('grown retry is needed: these go open without it', () => {
  const a = [fz('cone', [30, 20, 10], [-15, 5, 10], 'solid', [0, 0, 90]), fz('sphere', [25, 20, 10], [-10, 5, 10], 'hole', [0, 0, 90]), fz('wedge', [20, 10, 15], [-10, 10, 20], 'hole', [0, 0, 45])];
  const b = [fz('box', [90, 62, 12], [0, 0, 6]), fz('cylinder', [6, 6, 7], [-29, -24.5, 3.5])]; // a part flush with the plate inside a bigger one
  for (const d of [a, b]) { assert.ok(closed(d)); assert.ok(!closed(d, { grow: false })); }
});
