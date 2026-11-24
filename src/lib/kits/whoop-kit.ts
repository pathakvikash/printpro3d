// Our own 65/75 mm brushless whoop kit: a one-piece ducted frame, a canopy with a tilted camera sleeve and an antenna tube,
// and a battery strap tab. Original design; dimensions come from public sizes and every assumed one is marked "typical".
// Coordinates: mm, Z up, +X is the front of the quad. Frame and tab are built as assembled; the canopy is built upside down
// (roof on the bed, print z = roofTop - assembled z) and is flipped back by its assembly rotation. Prices never live here:
// they come from quote.ts on the mesh volume.
import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, ShapeUtils, Vector2 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { AssemblyPart, V3 } from '../assembly.ts';
import { cleanTriangles, LATE, shapeMatrix, type Shape } from '../playground.ts';
import { meshStats } from '../quote.ts';
import { normalizeCfg, type Cfg, type Field, type TemplateDef } from '../templateDefs.ts';

const SQ = Math.SQRT2;
const RAD = Math.PI / 180;

// ---------- config ----------

export const fields: Field[] = [
  { key: 'duct', label: 'Duct size (motor to motor wheelbase)', type: 'select', options: [{ value: '65', label: '65 mm (typical 31 mm props)' }, { value: '75', label: '75 mm (typical 40 mm props)' }], default: '65' },
  { key: 'motorPattern', label: 'Motor bolt spacing (4 holes, M1.4)', type: 'range', min: 5, max: 8, step: 0.2, default: 6.6, unit: 'mm', help: 'Distance between neighbouring holes. 6.6 mm is typical for 1102/1103 class motors: check yours.' },
  { key: 'aio', label: 'AIO board hole spacing (M2)', type: 'select', options: [{ value: '25.5', label: '25.5 x 25.5 mm (typical AIO)' }, { value: '20', label: '20 x 20 mm (typical)' }], default: '25.5' },
  { key: 'camAngle', label: 'Camera tilt up from level', type: 'range', min: 10, max: 35, step: 1, default: 25, unit: 'deg' },
];
const DEF: TemplateDef = { id: 'whoop-kit', name: 'Whoop kit', category: 'Drone & RC', material: 'PETG', colour: '', blurb: '', fields, marketLinks: [] };
export const defaults: Cfg = Object.fromEntries(fields.map((f) => [f.key, f.default]));
/** Fills missing or out-of-range fields with defaults; strict throws instead (what an order endpoint should use). */
export const validate = (raw: unknown, strict = false): Cfg => normalizeCfg(DEF, raw, strict);

// ---------- dimensions (all from the config, in one place) ----------

const WALL = 1.2, DUCT_H = 14, PLATE_T = 2.4, BEAM_T = 3.0, BEAM_W = 5.4, HUB_H = 4.0, BOSS_H = 4.0, BOSS_D = 4.4;
const BOLT_TURN = 9.3; // the bolt square is turned a few degrees so no hole centre lines up with the bore (aligned centres upset the CSG kernel)
const BOLT_D = 1.5, BORE_D = 3.6, PILOT_D = 1.7, STRAP_X = 9, LEAD_D = 3.4;
const FC_TOP = BOSS_H + 1.6; // the AIO board is 1.6 mm thick and rests on the frame bosses
const RIM_Z = BEAM_T; // the canopy rim rests on the frame beams
const CAN_WALL = 1.0, ROOF_T = 1.2, CAM_IN = 14.4, CAM_OUT = CAM_IN + 2 * CAN_WALL, SLEEVE_L = 18, LENS_D = 9;
const TUBE_OD = 4.4, TUBE_BORE = 2.4, TUBE_Z = 12, TUBE_LEN = 10;

function dims(c: Cfg) {
  const D = Number(c.duct), p = c.motorPattern as number, aio = Number(c.aio), ang = c.camAngle as number;
  const prop = D === 65 ? 31 : 40;
  const rIn = prop / 2 + 1, rOut = rIn + WALL, a = D / (2 * SQ);
  const g = aio / SQ; // AIO holes sit on the axes (board turned 45 degrees so its screws fall between the ducts)
  const hubD = p * SQ + 4, r = p / SQ; // motor bolt holes on the axes too: neighbouring holes are p apart
  const e = D / 2 - rOut + 0.9; // plate half-side: its edge just overlaps the duct walls
  const E = D / 2 - rOut - 0.15; // canopy half-side: its edge stays clear of the ducts
  const t = ang * RAD, ca = Math.cos(t), sa = Math.sin(t);
  const v = CAM_OUT * ca + SLEEVE_L * sa;
  const xp = 12.2 - ((SLEEVE_L / 2) * ca + (CAM_OUT / 2) * sa); // front edge of the sleeve stays behind the front ducts
  const zp = FC_TOP + 2.4 + v / 2; // the sleeve clears the board and its parts
  const T = (E * SQ + 0.5 - xp) / ca; // lens hole length, out through the front tip
  const zi = Math.max(zp + v / 2 + 0.8, zp + T * sa + LENS_D / 2 / ca + 0.3); // roof underside
  const zr = zi + ROOF_T;
  return { D, p, aio, ang, prop, rIn, rOut, a, g, hubD, r, e, E, ca, sa, v, xp, zp, T, zi, zr };
}

// ---------- shape helpers (same conventions as templates.ts) ----------

// A shape with its own cylinder segment count: the kit has many small holes, and the stock 48-segment cylinder makes the
// frame too slow to build. Small holes get 12-16 segments (a printer cannot tell), big walls 40.
type W = Shape & { seg?: number };
type Kind = Shape['kind'];
let n = 0;
const S = (kind: Kind, size: V3, pos: V3, mode: Shape['mode'] = 'solid', rot: V3 = [0, 0, 0], late = false, seg = 24): W => ({
  id: `${late ? LATE : ''}w${n++}`, kind, mode, seg,
  size: { x: size[0], y: size[1], z: size[2] }, position: { x: pos[0], y: pos[1], z: pos[2] }, rotation: { x: rot[0], y: rot[1], z: rot[2] },
});
const box = (size: V3, pos: V3, mode: Shape['mode'] = 'solid', rotZ = 0, late = false) => S('box', size, pos, mode, [0, 0, rotZ], late);
const cyl = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid', late = false, seg = d < 6 ? 14 : d < 12 ? 22 : 46) =>
  S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode, [0, 0, 0], late, seg);

const units = new Map<string, BufferGeometry>();
function unit(s: W): BufferGeometry {
  const key = s.kind === 'box' ? 'box' : `cyl${s.seg}`;
  let g = units.get(key);
  if (!g) {
    g = s.kind === 'box' ? new BoxGeometry(1, 1, 1) : new CylinderGeometry(0.5, 0.5, 1, s.seg!).rotateX(Math.PI / 2);
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g = mergeVertices(g, 1e-6);
    units.set(key, g);
  }
  return g;
}
function brush(s: W): Brush {
  const b = new Brush(unit(s).clone());
  shapeMatrix(s).decompose(b.position, b.quaternion, b.scale);
  b.updateMatrixWorld(true);
  return b;
}
/** A brush's triangles in world space as a fresh identity brush (CSG results use drawRange and sit in brush A's frame). */
function bake(b: Brush): Brush {
  const g = b.geometry, { start, count } = g.drawRange, end = Number.isFinite(count) ? start + count : Infinity;
  const ng = new BufferGeometry();
  ng.setAttribute('position', new BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
  if (g.index) ng.setIndex(Array.from(g.index.array as ArrayLike<number>).slice(start, end));
  const out = new Brush(ng.applyMatrix4(b.matrixWorld));
  out.updateMatrixWorld(true);
  return out;
}
/** The brush's triangles, welded and cleaned (cleanTriangles incl. T-junction repair), as an index-free soup. */
const flatTriangles = (b: Brush) => cleanTriangles(b.geometry.attributes.position.array, b.geometry.index?.array ?? null, true);

/** A brush from clean triangles (indexed, as the kernel wants). */
function fromTriangles(t: Float32Array): Brush {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(t, 3));
  const b = new Brush(mergeVertices(g, 1e-6));
  b.updateMatrixWorld(true);
  return b;
}

/** Same shape, moved and resized by a few hundredths of a mm: a different roll of the dice for the kernel. */
const jitter = (s: W, k: number): W => k === 0 ? s : ({
  ...s,
  position: { x: s.position.x + 0.011 * k * (((k * 3) % 5) - 2), y: s.position.y + 0.013 * k * (((k * 2) % 5) - 2), z: s.position.z },
  size: { x: s.size.x + 0.007 * k, y: s.size.y + 0.009 * k, z: s.size.z + 0.008 * k },
  rotation: { ...s.rotation, z: s.rotation.z + 0.03 * k * (k % 2 ? 1 : -1) },
});

/** Solids, then early holes, then late solids, then late holes. After every operation the result must still be one closed
 * mesh; if the kernel leaves an open edge (it does, on near-degenerate cuts) that one operation is redone with a jittered shape,
 * and the repaired mesh is what the next operation starts from. */
export function csg(shapes: W[]): Float32Array | null {
  const ev = new Evaluator() as Evaluator & { useCDTClipping: boolean };
  ev.attributes = ['position'];
  ev.useGroups = false;
  ev.useCDTClipping = true;
  const pick = (late: boolean, mode: Shape['mode']) => shapes.filter((s) => s.id.startsWith(LATE) === late && s.mode === mode);
  const solids = pick(false, 'solid');
  let acc = bake(brush(solids[0]));
  const step = (s: W, op: typeof ADDITION) => {
    let last: Float32Array | null = null;
    for (let k = 0; k <= 12; k++) {
      const t = flatTriangles(bake(ev.evaluate(acc, brush(jitter(s, k)), op)));
      last = t;
      if (meshStats(t)) break;
    }
    acc = fromTriangles(last!); // carry the repaired mesh forward, so defects do not pile up
  };
  solids.slice(1).forEach((s) => step(s, ADDITION));
  pick(false, 'hole').forEach((s) => step(s, SUBTRACTION));
  pick(true, 'solid').forEach((s) => step(s, ADDITION));
  pick(true, 'hole').forEach((s) => step(s, SUBTRACTION));
  const tris = flatTriangles(acc);
  return tris.length ? tris : null;
}

/** Cuts a closed triangle mesh flat at z = 0 and caps the cut, without the CSG kernel (the kernel is unreliable on this big
 * planar cut). Triangles above z stay; each one that crosses the plane is split, and the cut outlines are chained into loops,
 * nested into outers and holes, and triangulated (earcut, via three's ShapeUtils). Cut points are computed once per edge from
 * its two end points in a fixed order, so neighbours get identical floats and the result stays closed. */
export function clipFlat(src: Float32Array, z0 = 0): Float32Array | null {
  const out: number[] = [];
  const segs = new Map<string, { a: string; b: string }>(); // start key -> segment, directed so the kept solid is on its left
  const pt = (p: number[], q: number[]): [number, number, number] => {
    const [lo, hi] = p[0] < q[0] || (p[0] === q[0] && (p[1] < q[1] || (p[1] === q[1] && p[2] < q[2]))) ? [p, q] : [q, p];
    const t = (z0 - lo[2]) / (hi[2] - lo[2]);
    return [Math.fround(lo[0] + t * (hi[0] - lo[0])), Math.fround(lo[1] + t * (hi[1] - lo[1])), z0];
  };
  const key = (p: number[]) => `${p[0]},${p[1]},${p[2]}`;
  const pts = new Map<string, [number, number, number]>();
  for (let i = 0; i < src.length; i += 9) {
    const v = [0, 1, 2].map((k) => [src[i + 3 * k], src[i + 3 * k + 1], src[i + 3 * k + 2]]);
    const up = v.map((p) => p[2] > z0);
    const n = up.filter(Boolean).length;
    if (n === 3) { for (const p of v) out.push(...p); continue; }
    if (n === 0) continue;
    const poly: number[][] = [];
    let enter: number[] | null = null, exit: number[] | null = null;
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3];
      if (up[k]) poly.push(a);
      if (up[k] !== up[(k + 1) % 3]) {
        const c = pt(a, b);
        poly.push(c);
        if (up[k]) exit = c; else enter = c;
      }
    }
    for (let k = 1; k + 1 < poly.length; k++) for (const p of [poly[0], poly[k], poly[k + 1]]) out.push(...p);
    if (enter && exit) { const ka = key(exit), kb = key(enter); pts.set(ka, exit as [number, number, number]); pts.set(kb, enter as [number, number, number]); segs.set(ka, { a: ka, b: kb }); }
  }
  // chain the cut outline into loops
  const loops: [number, number, number][][] = [];
  const used = new Set<string>();
  for (const start of segs.keys()) {
    if (used.has(start)) continue;
    const loop: [number, number, number][] = [];
    let k = start;
    while (!used.has(k)) { used.add(k); loop.push(pts.get(k)!); const next = segs.get(k); if (!next) return null; k = next.b; }
    if (k !== start) return null;
    loops.push(loop);
  }
  const area = (l: number[][]) => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);
  const inside = (p: number[], l: number[][]) => { let c = false; for (let i = 0, j = l.length - 1; i < l.length; j = i++) if ((l[i][1] > p[1]) !== (l[j][1] > p[1]) && p[0] < ((l[j][0] - l[i][0]) * (p[1] - l[i][1])) / (l[j][1] - l[i][1]) + l[i][0]) c = !c; return c; };
  const parents = loops.map((l, i) => loops.map((m, j) => (j !== i && Math.abs(area(m)) > Math.abs(area(l)) && inside(l[0], m) ? j : -1)).filter((j) => j >= 0));
  const depth = parents.map((p) => p.length);
  loops.forEach((l, i) => {
    if (depth[i] % 2) return; // a hole: triangulated with its outer
    const holes = loops.filter((_, j) => depth[j] === depth[i] + 1 && parents[j].includes(i));
    const flat = (m: number[][]) => m.map((p) => new Vector2(p[0], p[1]));
    const all = [...l, ...holes.flat()];
    for (const t of ShapeUtils.triangulateShape(flat(l), holes.map(flat))) {
      const [a, b, c] = t.map((k) => all[k]);
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      for (const p of cross < 0 ? [a, b, c] : [a, c, b]) out.push(...p); // outward normal of the bed face is -z
    }
  });
  return Float32Array.from(out);
}

/** Closed print mesh. `shapes(v)` gives variant v of the model: the kernel very occasionally cannot close one particular
 * hole layout, so a variant turns the bolt squares and changes the bore facets by a hair. Deterministic, so preview and price agree.
 * Throws when no variant closes. */
function toGeometry(shapes: (variant: number) => W[], what: string, flat = false): BufferGeometry {
  let mesh: Float32Array | null = null;
  for (let v = 0; v < 6 && !mesh; v++) {
    try { let m = csg(shapes(v)); if (m && flat) m = clipFlat(m); if (m && meshStats(m)) mesh = m; } catch {}
  }
  if (!mesh) throw new Error(`${what} could not be built as a closed mesh`);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- frame ----------

// Four ducts on a 45 degree X, joined by a diamond centre plate with four M2 bosses. Each motor hub hangs from the plate by a
// diagonal beam and a cross spoke. Prints flat on its underside.
const SIGNS: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
export function frameShapes(c: Cfg, variant = 0): W[] {
  const d = dims(c);
  const { a, g, rIn, rOut, hubD, r } = d;
  const bossAt: [number, number][] = [[g, 0], [-g, 0], [0, g], [0, -g]];
  // Every solid hangs a little below the bed, each by its own amount, and clipFlat shaves them flat afterwards: no two bottom faces
  // are coplanar, which is what makes the CSG kernel leave open edges.
  let nb = 0;
  const bottom = () => -0.6 - 0.07 * nb++;
  const sol = (dia: number, x: number, y: number, z1: number, late = false) => cyl(dia, x, y, bottom(), z1, 'solid', late);
  const slab = (w: number, l: number, x: number, y: number, z1: number, rot: number) => { const z0 = bottom(); return box([l, w, z1 - z0], [x, y, (z0 + z1) / 2], 'solid', rot, true); };
  const sh: W[] = [];
  for (const [sx, sy] of SIGNS) sh.push(sol(2 * rOut, sx * a, sy * a, DUCT_H));
  { const z0 = bottom(); sh.push(box([2 * d.e, 2 * d.e, PLATE_T - z0], [0, 0, (PLATE_T + z0) / 2], 'solid', 45)); }
  for (const [x, y] of bossAt) sh.push(sol(BOSS_D, x, y, BOSS_H));
  for (const [sx, sy] of SIGNS) sh.push(cyl(2 * rIn, sx * a, sy * a, -3, DUCT_H + 1, 'hole'));
  for (const [x, y] of bossAt) sh.push(cyl(PILOT_D, x, y, 2, BOSS_H + 0.5, 'hole')); // blind pilot for the M2 board screw
  for (const sx of [-1, 1]) sh.push(cyl(PILOT_D, sx * STRAP_X, 0, -3, PLATE_T + 1, 'hole')); // strap tab screws
  for (const s of [-1, 1]) sh.push(cyl(LEAD_D, 0, s * 9, -3, PLATE_T + 1, 'hole')); // battery lead holes, clear of the beams and bosses
  // late: what crosses the duct openings (beams, spokes, hubs), then the motor holes; the bed face is then cut flat by clipFlat
  sh.push(sol(11, 0, 0, BEAM_T + 0.2, true)); // centre pad the four beams meet in
  const mid = (d.D / 2 + 4.5) / 2 / SQ; // beam centre on each axis: beams run from the pad rim to the hub, so they never touch each other
  for (const [sx, sy] of SIGNS) sh.push(slab(BEAM_W, d.D / 2 - 4.5, mid * sx, mid * sy, BEAM_T, sx * sy > 0 ? 45 : -45));
  for (const [sx, sy] of SIGNS) sh.push(slab(2, 2 * rIn + WALL, sx * a, sy * a, 2, sx * sy > 0 ? -45 : 45));
  for (const [sx, sy] of SIGNS) sh.push(sol(hubD, sx * a, sy * a, HUB_H, true));
  for (const [sx, sy] of SIGNS) {
    const cx = sx * a, cy = sy * a;
    for (const k of [0, 1, 2, 3]) { const th = (BOLT_TURN + 3.7 * variant + 90 * k) * RAD, dx = r * Math.cos(th), dy = r * Math.sin(th); sh.push(cyl(BOLT_D, cx + dx, cy + dy, -3, HUB_H + 1, 'hole', true)); }
    sh.push(cyl(BORE_D, cx, cy, -3, HUB_H + 1, 'hole', true, [22, 20, 24, 26, 18, 28][variant % 6]));
  }
  return sh;
}

// ---------- canopy ----------

// Built upside down. Heights called "assembled" are z in the finished quad; pz maps them to the print.
export function canopyShapes(c: Cfg): W[] {
  const d = dims(c);
  const { E, g, zr, zi, xp, zp, T, ca, sa, ang } = d;
  const pz = (az: number) => zr - az;
  const cz = (z0: number, z1: number) => (pz(z0) + pz(z1)) / 2; // centre of an assembled height range, in print z
  const bodyH = zr - RIM_Z;
  const along = (t: number): V3 => [xp + t * ca, 0, pz(zp + t * sa)]; // a point on the camera axis (print coordinates)
  const tilted = (kind: Kind, size: V3, t: number, mode: Shape['mode'], rotY: number) => S(kind, size, along(t), mode, [0, rotY, 0], false, 32);
  const sh: W[] = [box([2 * E, 2 * E, bodyH], [0, 0, cz(RIM_Z, zr)], 'solid', 45)];
  sh.push(tilted('box', [SLEEVE_L, CAM_OUT, CAM_OUT], 0, 'solid', ang)); // assembled tilt up is a tilt down in the print
  // two ribs tie the sleeve to the roof so the part prints without supports
  const topAt = (x: number) => zp + (x - xp) * (sa / ca) + CAM_OUT / 2 / ca;
  const rx0 = xp - 7, rx1 = xp + 5, rz0 = topAt(rx0) - 1.0, rz1 = zi + 0.4;
  for (const s of [-1, 1]) sh.push(box([rx1 - rx0, 1.6, rz1 - rz0], [(rx0 + rx1) / 2, s * 4.5, cz(rz0, rz1)]));
  // antenna tube: sticks out of the rear tip, between the rear ducts
  const tx0 = -(E * SQ - 1), tx1 = -(E * SQ + TUBE_LEN);
  sh.push(S('cylinder', [TUBE_OD, TUBE_OD, tx0 - tx1], [(tx0 + tx1) / 2, 0, pz(TUBE_Z)], 'solid', [0, 90, 0], false, 24));
  // holes
  const inner = E - CAN_WALL;
  sh.push(box([2 * inner, 2 * inner, bodyH], [0, 0, pz(zi) + bodyH / 2], 'hole', 45)); // cavity, open on the print top
  sh.push(tilted('box', [SLEEVE_L + 2, CAM_IN, CAM_IN], 0, 'hole', ang)); // camera tunnel
  sh.push(tilted('cylinder', [LENS_D, LENS_D, T], T / 2, 'hole', 90 + ang)); // lens window through the front tip
  sh.push(S('cylinder', [TUBE_BORE, TUBE_BORE, 26], [-(13 + 13), 0, pz(TUBE_Z)], 'hole', [0, 90, 0], false, 16));
  for (const x of [-10, -13.2]) sh.push(box([2, 8, ROOF_T + 2], [x, 0, pz(zr) + ROOF_T / 2 - 1], 'hole')); // roof vents
  // late: two screw pillars on the side axes (the front one would block the lens, the rear one the antenna tube)
  for (const s of [-1, 1]) {
    sh.push(cyl(4.8, 0, s * g, pz(zr) + 0.6, pz(FC_TOP), 'solid', true)); // starts inside the roof, so no face is coplanar with the bed face
    sh.push(cyl(2.2, 0, s * g, pz(zr) - 1, pz(FC_TOP) + 1, 'hole', true));
  }
  return sh;
}

/** Bounding box of the canopy in assembled x and height, from the definition above (the test compares it with the mesh). */
export const canopyBox = (c: Cfg) => {
  const d = dims(c), x1 = d.E * SQ, x0 = -(d.E * SQ + TUBE_LEN);
  return { x0, x1, yHalf: x1, z0: RIM_Z, z1: d.zr };
};

// ---------- strap tab ----------

const TAB = { x: 40, y: 14, z: 1.6, slotX: 17.5, slotL: 9, slotW: 2.4, hole: 2.2 };
export function tabShapes(): W[] {
  const sh: W[] = [box([TAB.x, TAB.y, TAB.z], [0, 0, TAB.z / 2])];
  for (const sx of [-1, 1]) sh.push(cyl(TAB.hole, sx * STRAP_X, 0, -1, TAB.z + 1, 'hole'));
  for (const sx of [-1, 1]) sh.push(box([TAB.slotW, TAB.slotL, TAB.z + 2], [sx * TAB.slotX, 0, TAB.z / 2], 'hole'));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) sh.push(box([3.7, 3.7, TAB.z + 2.2], [sx * (TAB.x / 2 + 0.15), sy * (TAB.y / 2 + 0.15), TAB.z / 2 + 0.05], 'hole', 45)); // corner chamfers
  return sh;
}

// ---------- parts ----------

export type PrintedPart = { id: string; label: string; build: (c: Cfg) => BufferGeometry; material: 'PLA' | 'PETG' | 'ABS' | 'TPU'; qty: number; orientation: string };
export const printedParts: PrintedPart[] = [
  { id: 'frame', label: 'Frame with 4 ducts', build: (c) => toGeometry((v) => frameShapes(validate(c), v), 'frame', true), material: 'PETG', qty: 1, orientation: 'flat on its underside, ducts pointing up' },
  { id: 'canopy', label: 'Canopy with camera sleeve', build: (c) => toGeometry(() => canopyShapes(validate(c)), 'canopy'), material: 'PLA', qty: 1, orientation: 'upside down: roof on the bed, open side up' },
  { id: 'strap-tab', label: 'Battery strap tab', build: () => toGeometry(() => tabShapes(), 'strap tab'), material: 'PETG', qty: 1, orientation: 'flat' },
];

export const boughtParts = [
  { name: 'Brushless motor', spec: '1102 or 1103 class, 4 bolt holes M1.4', qty: 4, typical: true },
  { name: 'AIO flight controller', spec: '1S, about 27 mm square, M2 holes on a 25.5 mm (or 20 mm) square', qty: 1, typical: true },
  { name: 'LiPo battery', spec: '1S 300 to 450 mAh, about 30 x 17 x 9 mm', qty: 1, typical: true },
  { name: 'Propeller', spec: '31 mm (65 mm kit) or 40 mm (75 mm kit), with both spin directions', qty: 4, typical: true },
  { name: 'Nano FPV camera', spec: 'about 14 x 14 mm board, 15 mm long with lens', qty: 1, typical: true },
  { name: 'M2 screws', spec: '2 long (about 30 mm) for the canopy pillars, 2 short (about 5 mm) for the other bosses, 2 short for the strap tab', qty: 6, typical: true },
  { name: 'M1.4 screws', spec: 'short, for the motor bolt holes (check your motor)', qty: 16, typical: true },
];

/** The assembled kit. Printed parts point at their printed part by id (the viewer resolves the geometry). */
export function assembly(config: Cfg = defaults): AssemblyPart[] {
  const c = validate(config), d = dims(c), cb = canopyBox(c);
  const half = d.a + d.rOut;
  const parts: AssemblyPart[] = [
    { id: 'frame', label: 'Frame', geometry: 'frame', material: 'PETG', size: [2 * half, 2 * half, DUCT_H], position: [0, 0, DUCT_H / 2], rotation: [0, 0, 0], explode: [0, 0, 0] },
    // printed upside down, so it is turned over about its own box centre
    { id: 'canopy', label: 'Canopy', geometry: 'canopy', material: 'PLA', size: [cb.x1 - cb.x0, 2 * cb.yHalf, cb.z1 - cb.z0], position: [(cb.x0 + cb.x1) / 2, 0, (cb.z0 + cb.z1) / 2], rotation: [180, 0, 0], explode: [0, 0, 40] },
    { id: 'strap-tab', label: 'Battery strap tab', geometry: 'strap-tab', material: 'PETG', size: [TAB.x, TAB.y, TAB.z], position: [0, 0, -TAB.z / 2], rotation: [0, 0, 0], explode: [0, 0, -14] },
  ];
  const bought = (id: string, label: string, size: V3, position: V3, explode: V3, o: Partial<AssemblyPart> = {}): AssemblyPart =>
    ({ id, label, material: 'bought', size, position, rotation: [0, 0, 0], explode, bought: true, ...o });
  SIGNS.forEach(([sx, sy], i) => {
    const x = sx * d.a, y = sy * d.a;
    parts.push(bought(`motor${i + 1}`, `Motor ${i + 1}`, [11, 11, 8], [x, y, HUB_H + 4], [sx * 12, sy * 12, 16], { shape: 'cylinder' }));
    // props turn in alternate directions; rpm is a display speed, not the real one
    parts.push(bought(`prop${i + 1}`, `Propeller ${i + 1}`, [d.prop, d.prop, 1.2], [x, y, HUB_H + 8.8], [sx * 12, sy * 12, 30], { shape: 'cylinder', spin: { axis: [0, 0, 1], rpm: sx * sy > 0 ? 300 : -300 } }));
  });
  parts.push(bought('aio', 'AIO flight controller', [27, 27, 1.6], [0, 0, BOSS_H + 0.8], [0, 0, 16], { rotation: [0, 0, 45] }));
  parts.push(bought('battery', 'LiPo battery 1S', [30, 17, 9], [0, 0, -TAB.z - 4.5], [0, 0, -26]));
  parts.push(bought('camera', 'Nano FPV camera', [15, 14, 14], [d.xp, 0, d.zp], [-10 * d.ca, 0, 40 - 10 * d.sa], { rotation: [0, -d.ang, 0] }));
  return parts;
}

// ---------- facts the blurb states (the tests check them against the meshes) ----------

export const facts = (config: Cfg) => {
  const c = validate(config), d = dims(c);
  return { ducts: 4, prop: d.prop, ductInner: d.rIn * 2, ductHeight: DUCT_H, boltHoles: 16, bolt: d.p, wireBores: 4, boardBosses: 4, leadHoles: 2, strapHoles: 2, pillarHoles: 2, vents: 2, tabHoles: 2, tabSlots: 2, angle: d.ang, aio: c.aio };
};

export function describe(config: Cfg = defaults): string {
  const f = facts(config);
  return `A ${validate(config).duct} mm whoop in three printed parts. The frame is one piece with ${f.ducts} ducts (${f.ductInner} mm inside for ${f.prop} mm props, ${f.ductHeight} mm tall); each motor hub has 4 M1.4 bolt holes ${f.bolt} mm apart and a ${BORE_D} mm wire bore, so ${f.boltHoles} bolt holes in all. The centre plate has ${f.boardBosses} M2 bosses on a ${f.aio} mm square for the board, ${f.leadHoles} battery lead holes and ${f.strapHoles} strap screw holes. The canopy has a ${CAM_IN} mm camera sleeve tilted ${f.angle} degrees, ${f.pillarHoles} screw pillars, ${f.vents} roof vents and a rear antenna tube. The strap tab has ${f.tabHoles} screw holes and ${f.tabSlots} strap slots. Motors, board, battery, props and camera are bought. Sizes marked typical are common ones: check yours.`;
}

export const KIT_WHOOP_KIT = {
  id: 'whoop-kit',
  title: '65/75 mm whoop kit',
  category: 'Drone & RC',
  blurb: describe(defaults),
  config: { fields, defaults, validate },
  printedParts,
  assembly,
  boughtParts,
};
