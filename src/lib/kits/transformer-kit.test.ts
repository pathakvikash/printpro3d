import test from 'node:test';
import assert from 'node:assert/strict';
import { eulerQuat, type AssemblyPart, type Quat, type V3 } from '../assembly.ts';
import type { Cfg } from '../templateDefs.ts';
import { analyzeMesh } from '../meshAnalysis.ts';
import { fitsBed, quote } from '../quote.ts';
import { BOSSES, GENUS, KIT_TRANSFORMER_KIT as K, VENTS, WINDOWS, assembledBox, buildPart, transformerPose, type PartId } from './transformer-kit.ts';

const CONFIGS = [K.config.defaults(), { clearance: 0.2, magnets: false }, { clearance: 0.5, magnets: true }];
const ids = K.printedParts.map((p) => p.id as PartId);

test('config: defaults, extremes valid, junk rejected', () => {
  const d = K.config.defaults();
  assert.equal(d.clearance, 0.35);
  for (const c of CONFIGS) assert.deepEqual(K.config.validate(c), c);
  assert.throws(() => K.config.validate({ clearance: 0.6, magnets: true }));
  assert.throws(() => K.config.validate({ clearance: 0.3, magnets: true, x: 1 }));
});

test('every printed part is a closed single piece, fits the bed, prices from its mesh, holes match the blurb', () => {
  for (const cfg of CONFIGS) for (const p of K.printedParts) {
    const b = buildPart(p.id as PartId, cfg);
    assert.ok(fitsBed(b.stats.sizeMm), `${p.id} fits the bed`);
    assert.ok(Math.abs(b.stats.sizeMm.z - assembledBoxPrintZ(p.id as PartId, cfg)) < 0.2, `${p.id} print height`);
    const t = analyzeMesh(b.print)!;
    assert.equal(t.pieces, 1, `${p.id} pieces`);
    assert.equal(t.throughHoles, GENUS(p.id as PartId), `${p.id} through holes (${JSON.stringify(cfg)})`);
    assert.ok(quote(b.stats, p.material, p.qty).total > 0);
    const g = p.build(cfg);
    assert.equal(g.getAttribute('position').count * 3, b.print.length);
  }
});

function assembledBoxPrintZ(id: PartId, cfg: Cfg) {
  return KIT_SIZE(id, cfg)[2];
}
const KIT_SIZE = (id: PartId, cfg: Cfg) => K.assembly(cfg).find((a) => a.geometry === id)!.size;

test('blurb states what the geometry has', () => {
  assert.match(K.blurb, new RegExp(`${VENTS} hood vent slots`));
  assert.match(K.blurb, new RegExp(`${BOSSES} screw bosses`));
  assert.match(K.blurb, new RegExp(`${WINDOWS} spoke windows`));
  assert.equal(GENUS('chassis'), VENTS + 4); // 2 cross-pin holes + 2 head-pivot holes (one per fork)
  const s = buildPart('chassis').stats.sizeMm;
  assert.ok(Math.abs(s.x - 100) < 0.1 && Math.abs(s.y - 36) < 0.1 && Math.abs(s.z - 24) < 0.1, 'chassis 100 x 36 x 24'); // CSG may nudge solids by a few hundredths of a mm
  assert.match(K.blurb, /100 x 36 x 24/);
  assert.match(K.blurb, /8 pockets \(4 in the chassis sides, 4 in the limbs\)/);
  assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(K.blurb + JSON.stringify(K.boughtParts)));
});

// parity ray cast along +Z: is the point inside the closed mesh?
function inside(m: Float32Array, [px, py, pz]: V3) {
  let hits = 0;
  for (let i = 0; i < m.length; i += 9) {
    const a = [m[i], m[i + 1], m[i + 2]], b = [m[i + 3], m[i + 4], m[i + 5]], c = [m[i + 6], m[i + 7], m[i + 8]];
    const d = (p: number[], q: number[]) => (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0]);
    const e = [d(a, b), d(b, c), d(c, a)];
    if (!(e.every((v) => v >= 0) || e.every((v) => v <= 0))) continue;
    const area = e[0] + e[1] + e[2];
    if (!area) continue;
    const z = (e[1] * a[2] + e[2] * b[2] + e[0] * c[2]) / area;
    if (z > pz) hits++;
  }
  return hits % 2 === 1;
}

test('magnet option cuts a pocket in the chassis sides and in each limb, sized 6 mm + clearance', () => {
  const off = { clearance: 0.35, magnets: false }, on = { clearance: 0.35, magnets: true };
  // raw frame: pocket centres, 1 mm in from the chassis side and from the limb's inner face; z ray goes up from below the pocket centre
  for (const x of [-40, 30]) for (const s of [1, -1]) {
    // a ray along z at y = 17.4 would run along the pocket wall, so probe at the pocket floor: x offset 2.9 mm from centre keeps inside the 6.35 mm circle
    assert.equal(inside(buildPart('chassis', on).raw, [x + 0.37, s * 17.41, 29]), false, `chassis pocket ${x},${s} open`);
    assert.equal(inside(buildPart('chassis', off).raw, [x + 0.37, s * 17.41, 29]), true, `chassis ${x},${s} solid without magnets`);
  }
  for (const [id, x] of [['leg', -40], ['arm', 30]] as const) {
    assert.equal(inside(buildPart(id, on).raw, [x + 0.37, 19.51, 29]), false, `${id} pocket open`);
    assert.equal(inside(buildPart(id, off).raw, [x + 0.37, 19.51, 29]), true, `${id} solid without magnets`);
  }
  assert.equal(K.assembly(on).filter((p) => p.bought && p.id.startsWith('magnet')).length, 8);
  assert.equal(K.assembly(off).filter((p) => p.id.startsWith('magnet')).length, 0);
});

test('assembly: unique ids, printed parts referenced with the right counts, bought parts are placeholders', () => {
  for (const cfg of CONFIGS) {
    const a = K.assembly(cfg);
    assert.equal(new Set(a.map((p) => p.id)).size, a.length);
    for (const p of a) {
      if (p.bought) { assert.equal(p.material, 'bought'); assert.equal(p.geometry, undefined); continue; }
      assert.ok(ids.includes(p.geometry as PartId), `${p.id} references a printed part`);
    }
    for (const p of K.printedParts) assert.equal(a.filter((x) => x.geometry === p.id).length, p.qty, `${p.id} qty`);
    assert.equal(a.filter((p) => p.bought && p.id.startsWith('screw')).length, K.boughtParts.find((b) => b.name.includes('screw'))!.qty);
  }
  assert.ok(K.boughtParts.every((b) => b.typical === true && b.qty > 0));
});

// ---- placement: print geometry + assembly rotation/position must reproduce the assembled frame ----
function qrot(q: Quat, v: V3): V3 {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
  return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx];
}
type Box = { lo: V3; hi: V3 };
function placed(p: AssemblyPart, pos: V3, q: Quat): { box: Box; centroid: V3 } {
  const m = buildPart(p.geometry as PartId).print;
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity], c: V3 = [0, 0, 0];
  for (let i = 0; i < m.length; i += 9) {
    const w = [0, 3, 6].map((o) => { const r = qrot(q, [m[i + o], m[i + o + 1], m[i + o + 2] - p.size[2] / 2]); return [pos[0] + r[0], pos[1] + r[1], pos[2] + r[2]] as V3; });
    for (const v of w) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
    for (let k = 0; k < 3; k++) c[k] += (w[0][k] + w[1][k] + w[2][k]) / 3; // vertex-mean of triangle centres: a stable shape signature
  }
  const nT = m.length / 9;
  return { box: { lo, hi }, centroid: c.map((v) => v / nT) as V3 };
}

test('placing the print geometry with the assembly rotation reproduces the assembled shape (orientation, not just size)', () => {
  for (const p of K.assembly().filter((x) => !x.bought)) {
    const id = p.geometry as PartId;
    const { box, centroid } = placed(p, p.position, eulerQuat(p.rotation));
    const right = p.id.endsWith('-r') && ['leg', 'arm', 'axle', 'wheel'].some((k) => id === k);
    // expected: the canonical raw mesh's triangle-centre mean, offset like the instance (x shift for front parts, y mirrored for right parts)
    const raw = buildPart(id).raw, bc = assembledBox(id).centre;
    const rc: V3 = [0, 0, 0];
    for (let i = 0; i < raw.length; i += 9) for (let k = 0; k < 3; k++) rc[k] += (raw[i + k] + raw[i + 3 + k] + raw[i + 6 + k]) / 3;
    const nT = raw.length / 9;
    const off: V3 = [rc[0] / nT - bc[0], rc[1] / nT - bc[1], rc[2] / nT - bc[2]];
    const flip = right && id !== 'wheel'; // right limbs and axles are the left ones turned 180 degrees about Z
    const want = [p.position[0] + (flip ? -off[0] : off[0]), p.position[1] + (flip ? -off[1] : off[1]), p.position[2] + off[2]];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(centroid[k] - want[k]) < 0.15, `${p.id} axis ${k}: ${centroid[k]} vs ${want[k]}`);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs((box.lo[k] + box.hi[k]) / 2 - p.position[k]) < 0.2, `${p.id} centre ${k}`);
  }
});

test('joints: one axis, min 0, shared fold angle per hinge group, pivots inside the model', () => {
  const a = K.assembly();
  const groups = new Map<number, Set<number>>();
  for (const p of a.filter((x) => x.joint)) {
    const j = p.joint!;
    assert.deepEqual(j.axis, [0, 1, 0]);
    assert.equal(j.min, 0);
    assert.ok(j.max === 90 || j.max === 180, p.id);
    assert.ok(Math.abs(j.pivot[0]) <= 50 && j.pivot[2] > 0 && j.pivot[2] < 62, `${p.id} pivot`);
    const g = groups.get(j.pivot[0]) ?? new Set<number>(); g.add(j.max); groups.set(j.pivot[0], g);
  }
  for (const [px, maxes] of groups) assert.equal(maxes.size, 1, `hinge at x=${px} has one range`);
  assert.deepEqual([...groups.keys()].sort((x, y) => x - y), [-40, 30, 44]);
  assert.ok(['head'].every((id) => a.find((p) => p.id === id)!.joint!.max === 180));
  for (const id of ['leg-l', 'leg-r', 'arm-l', 'arm-r', 'wheel-r-l', 'axle-f-r']) assert.equal(a.find((p) => p.id === id)!.joint!.max, 90, id);
});

function worldBoxes(a: AssemblyPart[], fold: number) {
  const pose = transformerPose(a, fold);
  return a.filter((p) => !p.bought).map((p) => ({ p, box: placed(p, pose[p.id].position, pose[p.id].quaternion).box }));
}
const overlap = (x: Box, y: Box) => [0, 1, 2].reduce((v, k) => v * Math.max(0, Math.min(x.hi[k], y.hi[k]) - Math.max(x.lo[k], y.lo[k])), 1);
const exempt = (p: AssemblyPart, q: AssemblyPart) => {
  const ids2 = [p.geometry, q.geometry];
  if (ids2.includes('cross-pin') || ids2.includes('head-pin') || ids2.includes('axle')) return true; // pins and axles sit inside holes
  return ids2.includes('head') && ids2.includes('chassis'); // the head swings through the empty front bay; boxes overlap, solids do not
};

test('fold 0 and fold 1: no gross overlap between printed parts; the fold really moves the limbs and head', () => {
  for (const cfg of CONFIGS) {
    const a = K.assembly(cfg);
    for (const fold of [0, 1]) {
      const w = worldBoxes(a, fold);
      for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) {
        if (exempt(w[i].p, w[j].p)) continue;
        assert.ok(overlap(w[i].box, w[j].box) < 150, `fold ${fold}: ${w[i].p.id} / ${w[j].p.id} overlap ${overlap(w[i].box, w[j].box).toFixed(1)} mm3`);
      }
    }
  }
  const a = K.assembly();
  const car = worldBoxes(a, 0), robot = worldBoxes(a, 1);
  const get = (w: typeof car, id: string) => w.find((x) => x.p.id === id)!.box;
  // car: wheels on the ground, limbs hang down; robot: legs point to -X, head beyond the front
  for (const id of ['wheel-r-l', 'wheel-f-r']) assert.ok(Math.abs(get(car, id).lo[2]) < 0.05, `${id} on the ground`);
  assert.ok(get(robot, 'leg-l').lo[0] < -70, `leg lo ${get(robot, 'leg-l').lo[0]}`);
  assert.ok(get(robot, 'head').hi[0] > 66, `head hi ${get(robot, 'head').hi[0]}`);
  assert.ok(get(car, 'head').hi[0] < 49.5, 'head tucked');
  assert.ok(get(robot, 'arm-l').hi[0] < 38 && get(robot, 'arm-l').lo[0] > -3, `arm ${get(robot, 'arm-l').lo[0]} ${get(robot, 'arm-l').hi[0]}`);
});
