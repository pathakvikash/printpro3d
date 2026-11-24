// Original mini-RC-helicopter printed airframe, sized for a BOUGHT rotor head (single or coaxial), blades and motors.
// Nothing here is a copy of anyone's design; every size is either ours or a public standard marked "typical".
// Prices are never stored here: price each printed part from its mesh with quote.ts like any other part.
// Assembled frame: mm, x = nose, y = left, z = up, ground at z = 0. Each part builds in its PRINT orientation
// (xy-centred, resting on z = 0); the assembly rotates it into place.
import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Path, Shape as Outline } from 'three';
import { LATE, type Kind, type Shape } from '../playground.ts';
import { templateMesh } from '../templates.ts';
import { normalizeCfg, type Cfg, type Field, type TemplateDef } from '../templateDefs.ts';
import type { AssemblyPart, PartMaterial, V3 } from '../assembly.ts';

// ---------- config ----------
const fields: Field[] = [
  { key: 'shaft', label: 'Rotor shaft diameter', type: 'select', options: [{ value: '2', label: '2 mm (typical micro)' }, { value: '3', label: '3 mm (typical)' }], default: '2', help: 'Sets the bearing seats: 2x5x2.5 mm bearing for 2 mm, 3x8x3 mm for 3 mm (typical sizes).' },
  { key: 'len', label: 'Body length, nose to tail', type: 'range', min: 150, max: 220, step: 5, default: 180, unit: 'mm' },
  { key: 'servos', label: 'Micro servos', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }], default: '2' },
  { key: 'servoClass', label: 'Servo class', type: 'select', options: [{ value: '1.7', label: '1.7 g class' }, { value: '3.7', label: '3.7 g class' }], default: '1.7', help: 'Typical bodies: 1.7 g about 12 x 5.5 x 11 mm, 3.7 g about 20 x 8.5 x 17 mm. Check yours.' },
];
const def: TemplateDef = { id: 'heli-kit', name: 'Mini RC helicopter airframe', category: 'drone-rc', material: 'PETG', colour: 'any', blurb: '', fields, marketLinks: [] };
export const defaultConfig = (): Cfg => normalizeCfg(def, {});

// 3 servos of the 3.7 g class need a longer frame to sit in the rear bay
export const minLenFor = (servos: number, cls: string) => (servos === 3 && cls === '3.7' ? 165 : 150);

/** Strict (server): bad, missing or unknown values throw. Lenient: bad values fall back to defaults and an impossible servo combo drops to 2 servos. */
export function validate(raw: unknown, strict = false): Cfg {
  const c = normalizeCfg(def, raw, strict);
  if ((c.len as number) < minLenFor(+c.servos, c.servoClass as string)) {
    if (strict) throw new Error('3 servos of the 3.7 g class need a body length of at least 165 mm');
    c.servos = '2';
  }
  return c;
}

// ---------- sizes (typical, labelled) ----------
const GAP = 28; // inner width between the two side frames
const T = 3; // side frame thickness
const HF = 50; // side frame height
const FRAME_Z0 = 14.5; // frame bottom above the ground
const BEARING = { '2': { od: 5, t: 2.5 }, '3': { od: 8, t: 3 } } as const; // MR52-size and MR83-size, typical
const SERVO = { '1.7': { w: 12, d: 5.5, h: 11 }, '3.7': { w: 20, d: 8.5, h: 17 } } as const; // typical, assumed
const BOOM_D = 4.1; // for a 4 mm carbon tube (typical)
const MOTOR_D = 7.2; // tail motor pocket for a 7 mm coreless motor (typical)
const SKID_STRUT_X = 8;

/** Fixed hole counts, used by the blurb and by the tests. Frame also has one servo screw hole per servo. */
export const HOLES = { frameFixed: 10, canopyVents: 4, canopyMast: 1, bridgeBearing: 1, clamp: 4, holder: 2, skid: 2, servoMount: 2 };

function dims(c: Cfg) {
  const L = c.len as number, sh = String(c.shaft) as '2' | '3', cls = c.servoClass as '1.7' | '3.7', n = +c.servos;
  const Lf = Math.round(0.55 * L), xm = Math.round(0.25 * Lf * 10) / 10, Lc = Math.round(0.5 * L);
  const b = BEARING[sh], s = SERVO[cls];
  const bossD = b.od + 5, bw = bossD + 6;
  const pd = s.d + 0.4, pw = s.w + 0.4, mw = pd + 10; // servo mount width in x
  const Ls = Lf + 36;
  return { L, Lf, xm, Lc, W: 42, Hc: 44, b, bossD, bw, s, n, pd, pw, mw, Ls, shaft: +sh };
}

// ---------- shape helpers ----------
let id = 0;
const S = (kind: Kind, size: V3, pos: V3, mode: Shape['mode'] = 'solid', rot: V3 = [0, 0, 0]): Shape => ({ id: `h${id++}`, kind, mode, size: { x: size[0], y: size[1], z: size[2] }, position: { x: pos[0], y: pos[1], z: pos[2] }, rotation: { x: rot[0], y: rot[1], z: rot[2] } });
const box = (size: V3, pos: V3, mode: Shape['mode'] = 'solid', rot?: V3) => S('box', size, pos, mode, rot);
const ell = (size: V3, pos: V3, mode: Shape['mode'] = 'solid') => S('sphere', size, pos, mode);
const cyl = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode);
// a cylinder along y (y0..y1) or x (x0..x1)
const cylY = (d: number, x: number, z: number, y0: number, y1: number, mode: Shape['mode'] = 'hole') => S('cylinder', [d, d, y1 - y0], [x, (y0 + y1) / 2, z], mode, [90, 0, 0]);
const cylX = (d: number, y: number, z: number, x0: number, x1: number, mode: Shape['mode'] = 'hole') => S('cylinder', [d, d, x1 - x0], [(x0 + x1) / 2, y, z], mode, [0, 90, 0]);
const late = (s: Shape): Shape => ({ ...s, id: LATE + s.id });

/** Triangles -> geometry, centred on x/y and resting on z = 0 (the contract in assembly.ts). */
function toGeometry(src: Shape[] | Float32Array, what: string): BufferGeometry {
  const m = src instanceof Float32Array ? src : templateMesh(src);
  if (!m) throw new Error(`heli-kit: ${what} did not build as a closed mesh`);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.length; i++) { lo[i % 3] = Math.min(lo[i % 3], m[i]); hi[i % 3] = Math.max(hi[i % 3], m[i]); }
  const out = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = m[i] - (i % 3 === 2 ? lo[2] : (lo[i % 3] + hi[i % 3]) / 2);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  return g;
}

// ---------- part builders (print orientation) ----------
// side frame: lies flat, plate in xy. Local origin = plate centre; in the assembly local y is up and x is the nose.
function frameHoles(c: Cfg) {
  const d = dims(c), h: [number, number][] = [];
  for (const yy of [12.5, -13.5]) for (const dx of [-5, 5]) h.push([d.xm + dx, yy]); // 4 bridge screws
  for (const sx of [-1, 1]) h.push([sx * (d.Lf / 2 - 8), -17]); // 2 skid screws
  for (const dx of [7, 17]) h.push([-d.Lf / 2 + dx, -10]); // 2 boom clamp screws
  for (let i = 0; i < d.n; i++) h.push([-d.Lf / 2 + 4 + i * (d.mw + 1), 21]); // servo mount screws
  return h;
}
// Extruded (not CSG): a plate with 5 mm rounded corners and round holes is exact and instant this way, where a dozen
// cylinder cuts in a thin plate leave open edges in the CSG kernel.
function sideFrame(c: Cfg): Float32Array {
  const d = dims(c), r = 5, hw = d.Lf / 2, hh = HF / 2, o = new Outline();
  o.moveTo(-hw + r, -hh).lineTo(hw - r, -hh).absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false).lineTo(hw, hh - r).absarc(hw - r, hh - r, r, 0, Math.PI / 2, false)
    .lineTo(-hw + r, hh).absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false).lineTo(-hw, -hh + r).absarc(-hw + r, -hh + r, r, Math.PI, 1.5 * Math.PI, false);
  const holes: [number, number, number][] = [...frameHoles(c).map(([x, y]) => [x, y, 2.2] as [number, number, number]), ...[-0.14 * d.Lf, 0.36 * d.Lf].map((x) => [x, 0, 12] as [number, number, number])];
  for (const [x, y, dia] of holes) o.holes.push(new Path().absarc(x, y, dia / 2, 0, Math.PI * 2, true));
  return new Float32Array(new ExtrudeGeometry(o, { depth: T, bevelEnabled: false, curveSegments: 24 }).attributes.position.array);
}

// bearing bridge: a plate across the gap with a boss; the bought bearing sits in the seat, the shaft runs through.
function bridge(c: Cfg) {
  const d = dims(c), top = 4, bt = top + 2;
  const sh: Shape[] = [box([d.bw, GAP, top], [0, 0, top / 2]), cyl(d.bossD, 0, 0, top - 0.5, bt)];
  sh.push(cyl(d.shaft + 1, 0, 0, -1, bt + 1, 'hole'));
  sh.push(cyl(d.b.od + 0.15, 0, 0, bt - d.b.t, bt + 1, 'hole')); // bearing seat, open at the top
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) sh.push(cylY(1.8, sx * 5, 2, sy > 0 ? GAP / 2 - 6 : -GAP / 2 - 1, sy > 0 ? GAP / 2 + 1 : -GAP / 2 + 6)); // blind pilots for the frame screws
  return sh;
}

// canopy: stacked ellipsoids (nose, body, tail taper), shelled, open underneath, printed dome-up on its flat rim.
function canopy(c: Cfg) {
  const { Lc, W, Hc } = dims(c), w = 1.6, hx = -0.08 * Lc;
  const E: [number, number, number, number][] = [[0.64 * Lc, W, 2 * Hc, -0.08 * Lc], [0.4 * Lc, 0.8 * W, 1.6 * Hc, 0.3 * Lc], [0.42 * Lc, 0.6 * W, 1.76 * Hc, -0.29 * Lc]];
  const sh: Shape[] = E.map(([a, b, h, x]) => ell([a, b, h], [x, 0, 0]));
  for (const [a, b, h, x] of E) sh.push(ell([a - 2 * w, b - 2 * w, h - 2 * w], [x, 0, 0], 'hole'));
  sh.push(box([Lc + 10, W + 10, Hc + 10], [0, 0, -(Hc + 10) / 2], 'hole')); // open underside
  sh.push(cyl(14, hx, 0, 0.3 * Hc, Hc + 5, 'hole')); // mast opening
  for (const x of [-0.22 * Lc, -0.32 * Lc]) for (const y of [-7, 7]) sh.push(box([6, 2.5, 0.65 * Hc], [x, y, 0.775 * Hc], 'hole')); // vent slots
  for (const x of [hx - 0.15 * Lc, hx + 0.15 * Lc]) for (const s of [-1, 1]) sh.push(late(box([8, 2.5, 8], [x, s * 18.45, 4]))); // friction tabs on the inside of the rim
  return sh;
}

// boom clamp: C-clamp round a boom lying along x, split from the bore up through the top, one clamp screw across the split.
function clamp() {
  const sh: Shape[] = [box([18, GAP, 14], [0, 0, 7]), cylX(BOOM_D, 0, 7, -10, 10), box([20, 1.6, 8], [0, 0, 11], 'hole')];
  sh.push(cylY(2.2, 0, 11, -GAP / 2 - 1, GAP / 2 + 1)); // clamp screw, crosses the split: one hole in each jaw
  for (const x of [-5, 5]) sh.push(cylY(2.2, x, 3.5, -GAP / 2 - 1, GAP / 2 + 1)); // mount screws into the side frames
  return sh;
}

// tail boom holder: boom bore (blind) and tail motor pocket (blind) plus 2 vertical holes for a bought tail fin.
function holder() {
  const sh: Shape[] = [box([30, 16, 14], [0, 0, 7]), cylX(BOOM_D, 0, 7, 1, 16), cylY(MOTOR_D, -8, 7, -3, 9)];
  for (const x of [-8, 8]) sh.push(cyl(2.2, x, -5.2, -1, 15, 'hole'));
  return sh;
}

// skid: lies on its side (bar on the bed); the two struts bolt to the outside of a side frame. Extruded for the same reason as the frame.
function skid(c: Cfg): Float32Array {
  const d = dims(c), B = d.Ls / 2, sx = d.Lf / 2 - 8, k = SKID_STRUT_X / 2, o = new Outline();
  o.moveTo(-B + 3.5, -3.5).lineTo(B - 3.5, -3.5).absarc(B - 3.5, 0, 3.5, -Math.PI / 2, Math.PI / 2, false)
    .lineTo(sx + k, 3.5).lineTo(sx + k, 25).lineTo(sx - k, 25).lineTo(sx - k, 3.5)
    .lineTo(-sx + k, 3.5).lineTo(-sx + k, 25).lineTo(-sx - k, 25).lineTo(-sx - k, 3.5)
    .lineTo(-B + 3.5, 3.5).absarc(-B + 3.5, 0, 3.5, Math.PI / 2, 1.5 * Math.PI, false);
  for (const x of [-sx, sx]) o.holes.push(new Path().absarc(x, 19, 1.1, 0, Math.PI * 2, true));
  return new Float32Array(new ExtrudeGeometry(o, { depth: 5, bevelEnabled: false, curveSegments: 24 }).attributes.position.array);
}
// servo mount: flat plate, servo-body pocket through it (the body hangs below), one screw tunnel across, a cable channel groove on top.
function servoMount(c: Cfg) {
  const d = dims(c), th = 4, px = -d.mw / 2 + 6.6 + d.pd / 2;
  const sh: Shape[] = [box([d.mw, GAP, th], [0, 0, th / 2]), box([d.pd, d.pw, th + 2], [px, 0, th / 2], 'hole')];
  sh.push(cylY(2.2, -d.mw / 2 + 3.5, 2, -GAP / 2 - 1, GAP / 2 + 1));
  sh.push(box([d.mw / 2 - px - d.pd / 2 + 1, 3, 2.5], [(px + d.pd / 2 + d.mw / 2) / 2 + 0.5, 0, th - 0.75 + 0.5], 'hole'));
  return sh;
}

// ---------- kit definition ----------
type Printed = { id: string; label: string; build: (c: Cfg) => BufferGeometry; material: PartMaterial; qty: (c: Cfg) => number };
const P = (id: string, label: string, mk: (c: Cfg) => Shape[] | Float32Array, material: PartMaterial, qty: (c: Cfg) => number = () => 1): Printed => ({ id, label, build: (c) => toGeometry(mk(validate(c)), id), material, qty });

const printedDefs: Printed[] = [
  P('side-frame', 'Side frame (print flat)', sideFrame, 'PETG', () => 2),
  P('bearing-bridge', 'Bearing bridge (print flat, boss up)', bridge, 'PETG', () => 2),
  P('canopy', 'Canopy (print dome up on its rim)', canopy, 'PLA'),
  P('boom-clamp', 'Tail boom clamp (print as shown)', clamp, 'PETG'),
  P('boom-holder', 'Tail boom holder (print as shown)', holder, 'PETG'),
  P('skid', 'Landing skid (print on its side)', skid, 'PETG', () => 2),
  P('servo-mount', 'Servo mount (print flat)', servoMount, 'PETG', (c) => +c.servos),
];

/** Bounding box of each printed part in its print orientation (mm); the tests check it against the real meshes. */
export function partSizes(cfg: Cfg): Record<string, V3> {
  const c = validate(cfg), d = dims(c);
  return {
    'side-frame': [d.Lf, HF, T], 'bearing-bridge': [d.bw, GAP, 6], canopy: [d.Lc, d.W, d.Hc * Math.sqrt(1 - (7 / (0.32 * d.Lc)) ** 2)], // the 14 mm mast opening takes the crest off
    'boom-clamp': [18, GAP, 14],
    'boom-holder': [30, 16, 14], skid: [d.Ls, 28.5, 5], 'servo-mount': [d.mw, GAP, 4],
  };
}

function boomLen(c: Cfg) {
  const d = dims(c), nose = d.xm + 0.08 * d.Lc + d.Lc / 2, xh = nose - d.L + 15, xc = -d.Lf / 2 + 12;
  return xc + 4 - (xh + 1);
}
const boomRange = [150, 220].map((len) => Math.round(boomLen(validate({ len }))));

export function assembly(cfg: Cfg): AssemblyPart[] {
  const c = validate(cfg), d = dims(c), sz = partSizes(c), fz = FRAME_Z0 + HF / 2, xm = d.xm;
  const nose = xm + 0.08 * d.Lc + d.Lc / 2, xh = nose - d.L + 15, xc = -d.Lf / 2 + 12, xcan = xm + 0.08 * d.Lc;
  const out: AssemblyPart[] = [];
  const printed = (pid: string, label: string, material: PartMaterial, position: V3, rotation: V3, explode: V3, extra: Partial<AssemblyPart> = {}) => {
    const key = pid.replace(/-([lr]|\d)$/, ''); // 'side-frame-l' builds from 'side-frame'
    out.push({ id: pid, label, geometry: key, material, size: sz[key], position, rotation, explode, ...extra });
  };
  const bought = (pid: string, label: string, size: V3, position: V3, explode: V3, extra: Partial<AssemblyPart> = {}) =>
    out.push({ id: pid, label, material: 'bought', bought: true, size, position, rotation: [0, 0, 0], explode, ...extra });

  for (const s of [-1, 1]) printed(`side-frame-${s < 0 ? 'r' : 'l'}`, `Side frame (${s < 0 ? 'right' : 'left'})`, 'PETG', [0, s * (GAP / 2 + T / 2), fz], [90, 0, 0], [0, s * 30, 0]);
  printed('bearing-bridge-1', 'Bearing bridge (upper)', 'PETG', [xm, 0, 50 + 3], [0, 0, 0], [0, 0, 24]);
  printed('bearing-bridge-2', 'Bearing bridge (lower)', 'PETG', [xm, 0, 24 + 3], [0, 0, 0], [0, 0, -10]);
  printed('canopy', 'Canopy', 'PLA', [xcan, 0, 30 + sz.canopy[2] / 2], [0, 0, 0], [0, 0, 40], { joint: { axis: [0, 1, 0], pivot: [xcan - d.Lc / 2, 0, 30], min: -35, max: 0 } });
  printed('boom-clamp', 'Tail boom clamp', 'PETG', [xc, 0, 33], [0, 0, 0], [-20, 0, 0]);
  printed('boom-holder', 'Tail boom holder', 'PETG', [xh, 0, 33], [0, 0, 0], [-30, 0, 0]);
  for (const s of [-1, 1]) printed(`skid-${s < 0 ? 'r' : 'l'}`, `Landing skid (${s < 0 ? 'right' : 'left'})`, 'PETG', [0, s * (GAP / 2 + T + 2.5), 28.5 / 2], [90, 0, 0], [0, s * 40, -10]);
  for (let i = 0; i < d.n; i++) {
    const xhole = -d.Lf / 2 + 4 + i * (d.mw + 1), cx = xhole - 3.5 + d.mw / 2, pcx = xhole - 3.5 + 6.6 + d.pd / 2;
    printed(`servo-mount-${i + 1}`, `Servo mount ${i + 1}`, 'PETG', [cx, 0, fz + 21], [0, 0, 0], [0, 0, 30]);
    bought(`servo-${i + 1}`, `Micro servo ${i + 1} (${c.servoClass} g class, typical)`, [d.s.d, d.s.w, d.s.h], [pcx, 0, fz + 19 - d.s.h / 2], [0, 0, 18]);
  }
  bought('main-shaft', `Main shaft (${d.shaft} mm) and 2 bearings`, [d.shaft, d.shaft, 46], [xm, 0, 49], [0, 0, 12], { shape: 'cylinder', spin: { axis: [0, 0, 1], rpm: 1500 } });
  bought('main-motor', 'Main motor (typical 8.5 mm coreless)', [8.5, 8.5, 20], [xm, 0, 14], [0, 0, -20], { shape: 'cylinder' });
  bought('rotor-head', 'Rotor head (single or coaxial)', [12, 12, 12], [xm, 0, 72], [0, 0, 55], { shape: 'cylinder', spin: { axis: [0, 0, 1], rpm: 1500 } });
  bought('rotor-blades', 'Rotor blades', [Math.round(0.9 * d.L), 10, 1.5], [xm, 0, 78.5], [0, 0, 70], { spin: { axis: [0, 0, 1], rpm: 1500 } });
  bought('boom', 'Tail boom (4 mm carbon tube, typical)', [4, 4, boomLen(c)], [(xc + 4 + xh + 1) / 2, 0, 33], [-25, 0, 0], { shape: 'cylinder', rotation: [0, 90, 0] });
  bought('tail-motor', 'Tail motor (7 mm coreless, typical)', [7, 7, 16], [xh - 8 + 0, 8 - 1 + 0, 33], [0, 25, 0], { shape: 'cylinder', rotation: [90, 0, 0], spin: { axis: [0, 0, 1], rpm: 5000 } });
  bought('flight-board', '4-in-1 receiver / flight board (typical 25 x 25 mm)', [25, 25, 6], [-12, 0, 33], [0, 0, 25]);
  bought('battery', '1S/2S LiPo battery (typical 35 x 14 x 8 mm)', [35, 14, 8], [-12, 0, 24], [0, 0, -25]);
  return out;
}

const nPrinted = (c: Cfg) => printedDefs.reduce((n, p) => n + p.qty(c), 0);
export const KIT_HELI_KIT = {
  id: 'heli-kit',
  title: 'Mini RC helicopter airframe',
  category: 'Drone & RC',
  blurb:
    `A printed airframe for a mini RC helicopter: 2 side frames (${HOLES.frameFixed} through holes each plus one servo screw hole per servo, 5 mm rounded 5 mm corners), 2 bearing bridges (${HOLES.bridgeBearing} bearing seat each, sized for a typical 2x5x2.5 or 3x8x3 mm bearing), ` +
    `a canopy (${HOLES.canopyVents} vent slots, ${HOLES.canopyMast} mast opening, 4 friction tabs), a tail boom clamp (${HOLES.clamp} through holes, split for a 4 mm tube), a tail boom holder (${HOLES.holder} through holes, a blind tube bore and a blind pocket for a 7 mm motor), 2 landing skids (${HOLES.skid} screw holes each) and 2 or 3 servo mounts (${HOLES.servoMount} through holes each, with a cable channel). ` +
    'The rotor head (single or coaxial), the blades, the motors, servos, boom tube, bearings, electronics and battery are all bought, never printed. Sizes marked typical are common hobby sizes; check yours.',
  fields,
  defaults: defaultConfig,
  validate,
  printedParts: printedDefs.map((p) => ({ id: p.id, label: p.label, build: p.build, material: p.material, qty: p.qty })),
  printedPartCount: nPrinted,
  assembly,
  boughtParts: [
    { name: 'Rotor head with blades (single or coaxial)', spec: 'Fits a 2 mm or 3 mm main shaft, blade span about 0.9 x body length', qty: 1, typical: true },
    { name: 'Main motor', spec: '8.5 mm coreless, 1 for a single rotor head, 2 for a coaxial one', qty: 1, typical: true },
    { name: 'Main shaft', spec: '2 mm or 3 mm steel rod to match the config, about 46 mm', qty: 1, typical: true },
    { name: 'Shaft bearings', spec: '2x5x2.5 mm (2 mm shaft) or 3x8x3 mm (3 mm shaft)', qty: 2, typical: true },
    { name: 'Tail motor', spec: '7 mm coreless with a small tail rotor', qty: 1, typical: true },
    { name: 'Tail boom tube', spec: `4 mm OD carbon tube, about ${boomRange[0]} to ${boomRange[1]} mm for 150 to 220 mm body length`, qty: 1, typical: true },
    { name: 'Micro servos', spec: '1.7 g or 3.7 g class, 2 or 3 per config', qty: 3, typical: true },
    { name: '4-in-1 receiver / flight board', spec: 'receiver, gyro and motor drivers on one board, about 25 x 25 mm', qty: 1, typical: true },
    { name: 'Battery', spec: '1S or 2S LiPo about 35 x 14 x 8 mm', qty: 1, typical: true },
    { name: 'M2 screws', spec: 'M2 x 6 to 30 mm for frames, bridges, skids and clamp', qty: 1, typical: true },
  ],
} as const;
