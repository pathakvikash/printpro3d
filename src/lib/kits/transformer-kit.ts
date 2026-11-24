// Transformer kit: an original mini car <-> robot toy, every part printed, snap-pin hinges, one fold slider (0 = car, 1 = robot).
// Our own blocky design; sizes are plain millimetres chosen for a 220 x 220 bed, bought sizes (6 x 2 mm magnets, M3 x 8 screws) are typical.
// BETA: clearances are untested without a physical print. Pins and axles print SEPARATELY (not print-in-place) so a tight fit can be re-printed alone.
//
// Frame: assembled car pose, mm, Z up, car points to +X, wheels on z = 0. Every part is designed in that frame, built by CSG, then rotated
// into its print orientation (flat on the bed, no supports where it matters) and re-centred (xy centre, z from 0). The assembly rotation is the inverse.
// Robot pose: the chassis stays put and the limbs fold 90 degrees about Y so +X becomes the robot's up. Stand the toy on its feet by hand.
import { BufferAttribute, BufferGeometry, Euler, Matrix4 } from 'three';
import { jointTransform, lerp, type AssemblyPart, type Pose, type V3 } from '../assembly.ts';
import { LATE, buildMesh, worldVertices, type Kind, type Shape } from '../playground.ts';
import { meshStats, type MaterialKey, type MeshStats } from '../quote.ts';
import { normalizeCfg, type Cfg, type Field, type TemplateDef } from '../templateDefs.ts';

// ---------- facts the blurb states (the test ties each to the mesh) ----------
export const VENTS = 3; // hood vent slots, cut right through the chassis
export const BOSSES = 4; // M3 pilot bosses under the belly tray
export const WINDOWS = 5; // spoke windows per wheel
const PIN_D = 3, AXLE_D = 4, MAGNET_D = 6, MAGNET_T = 2; // pin and axle diameters, magnet disc size (typical bought size)
const BARB = 0.25; // snap ring stands this far proud of the hole

// ---------- geometry constants (assembled frame, mm) ----------
const L = 100, W = 36, ZB = 24, ZT = 48; // chassis length, width, underside and roof heights
const G = 0.5, T = 9; // assembly gap between parts, limb thickness
const Y_IN = W / 2 + G, Y_OUT = Y_IN + T; // limb inner and outer face (left side; the right side mirrors)
const PZ = 36, WZ = 12; // limb pivot height, wheel centre height (wheel diameter 24)
const LEG_X = -40, ARM_X = 30, HEAD_X = 44, HEAD_Z = 44, FRONT_DX = ARM_X - LEG_X;
const BAY_X = 38.4; // head bay: the front 11.6 mm of the chassis is open between two forks
const BOSS_XY: [number, number][] = [[-19, -9.5], [-19, 9.5], [19, -9.5], [19, 9.5]];

// ---------- config ----------
const FIELDS: Field[] = [
  { key: 'clearance', label: 'Hinge clearance', type: 'range', min: 0.2, max: 0.5, step: 0.05, default: 0.35, unit: 'mm', help: 'Added to every pin, axle and magnet hole diameter. Beta: untested without a physical print.' },
  { key: 'magnets', label: 'Magnet pockets (6 x 2 mm discs)', type: 'bool', default: true },
];
const DEF: TemplateDef = { id: 'transformer-kit', name: 'Transformer kit', category: 'Toys & Hobby', material: 'PLA', colour: 'two colours, body and limbs', blurb: '', fields: FIELDS, marketLinks: [] };
const defaults = (): Cfg => normalizeCfg(DEF, {});
const cfgOf = (raw: Cfg | undefined) => { const c = normalizeCfg(DEF, raw ?? {}); return { c: c.clearance as number, mag: c.magnets as boolean }; };

// ---------- shape helpers ----------
let n = 0;
const S = (kind: Kind, size: V3, pos: V3, mode: Shape['mode'] = 'solid', rot: V3 = [0, 0, 0]): Shape => ({
  id: `x${n++}`, kind, mode, size: { x: size[0], y: size[1], z: size[2] }, position: { x: pos[0], y: pos[1], z: pos[2] }, rotation: { x: rot[0], y: rot[1], z: rot[2] },
});
const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, mode: Shape['mode'] = 'solid') => S('box', [sx, sy, sz], [x, y, z], mode);
/** cylinder along Y from y0 to y1 */
const cylY = (d: number, x: number, y0: number, y1: number, z: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, y1 - y0], [x, (y0 + y1) / 2, z], mode, [90, 0, 0]);
/** square pocket along Y from y0 to y1 (a 6 mm disc drops into a square a bit wider; fewer facets than a round pocket keeps the CSG clean) */
const pocketY = (w: number, x: number, y0: number, y1: number, z: number, mode: Shape['mode'] = 'hole') => box(w, y1 - y0, w, x, (y0 + y1) / 2, z, mode);
/** cylinder along Z from z0 to z1 */
const cylZ = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode);
const late = (s: Shape): Shape => ({ ...s, id: LATE + s.id });
/** a square turned 45 degrees about Y, centred near a corner: cuts a chamfer with legs `leg` */
const chamfer = (x: number, z: number, leg: number, sx: number, sz: number) => S('box', [leg * Math.SQRT2, W + 4, leg * Math.SQRT2], [x + sx * 0.3, 0, z + sz * 0.3], 'hole', [0, 45, 0]); // nudged outward so no box vertex sits exactly on a face

// ---------- the parts ----------
export type PartId = 'chassis' | 'belly-plate' | 'leg' | 'arm' | 'head' | 'wheel' | 'axle' | 'cross-pin' | 'head-pin';

function pinShapes(headD: number, ht: number, d: number, x: number, z: number, yHead: number, yTip: number, c: number): Shape[] {
  // a pin along Y, head at yHead (high y), snap ring and slit at yTip; the slit lets the two prongs squeeze through the hole
  const ring = 1.2, slit = 6.2;
  return [
    cylY(headD, x, yHead - ht, yHead, z),
    cylY(d, x, yTip, yHead - ht + 0.1, z),
    cylY(d + c + BARB, x, yTip, yTip + ring, z),
    box(0.8, slit, headD + 1, x, yTip + slit / 2 - 0.1, z, 'hole'),
  ];
}

function limbShapes(kind: 'leg' | 'arm', c: number, mag: boolean): Shape[] {
  const px = kind === 'leg' ? LEG_X : ARM_X, wl = kind === 'leg' ? 16 : 14, yc = (Y_IN + Y_OUT) / 2;
  return [
    box(wl, T, PZ - WZ, px, yc, (PZ + WZ) / 2),
    cylY(wl, px, Y_IN, Y_OUT, PZ), cylY(wl, px, Y_IN, Y_OUT, WZ), // rounded ends
    cylY(PIN_D + c, px, Y_IN - 1, Y_OUT + 1, PZ, 'hole'), // hinge hole
    cylY(PIN_D * 2 + c, px, Y_OUT - 1.8, Y_OUT + 1, PZ, 'hole'), // counterbore for the pin head or snap ring
    cylY(AXLE_D + c, px, Y_IN - 1, Y_OUT + 1, WZ, 'hole'), // axle hole
    cylY(7.5 + c, px, Y_IN - 1, Y_IN + 1.4, WZ, 'hole'), // counterbore for the axle head
    ...(mag ? [pocketY(MAGNET_D + c, px, Y_IN - 1, Y_IN + MAGNET_T + 0.2, PZ - 7, 'hole')] : []),
  ];
}

export function rawShapes(id: PartId, c: number, mag: boolean): Shape[] {
  switch (id) {
    case 'chassis': {
      const sh: Shape[] = [
        box(L, W, ZT - ZB, 0, 0, (ZT + ZB) / 2),
        box(48, 28, 15, 0, 0, 30.5, 'hole'), // belly tray, open underneath
        box(13.6, 27.4, 26, BAY_X + 6.8, 0, 36, 'hole'), // head bay between the two front forks
        ...[-27.5, -31, -34.5].map((x) => box(2.4, 20, ZT - ZB + 2, x, 0, 36, 'hole')), // hood vent slots, through the whole body
        cylY(PIN_D + c, LEG_X, -W / 2 - 2, W / 2 + 2, PZ, 'hole'), cylY(PIN_D + c, ARM_X, -W / 2 - 2, W / 2 + 2, PZ, 'hole'), // cross-pin holes
        ...[1, -1].map((s) => cylY(PIN_D + c, HEAD_X, s > 0 ? 13 : -W / 2 - 2, s > 0 ? W / 2 + 2 : -13, HEAD_Z, 'hole')), // head pivot, one hole through each fork
        box(27, 2.4, 3.5, -37.5, 0, 24.75, 'hole'), // cable channel from the tray to the rear face
      ];
      if (mag) for (const x of [LEG_X, ARM_X]) for (const s of [1, -1]) {
        sh.push(pocketY(MAGNET_D + c, x, s > 0 ? W / 2 - MAGNET_T - 0.2 : -W / 2 - 1, s > 0 ? W / 2 + 1 : -W / 2 + MAGNET_T + 0.2, PZ - 7, 'hole'));
      }
      for (const [x, y] of BOSS_XY) { sh.push(late(cylZ(6, x, y, ZB, 38.2))); sh.push(late(cylZ(2.5, x, y, ZB - 1, ZB + 7, 'hole'))); } // M3 pilot bosses
      return sh;
    }
    case 'belly-plate': return [
      box(56, 32, 2.4, 0, 0, ZB - 1.2),
      ...BOSS_XY.map(([x, y]) => cylZ(3.4, x, y, ZB - 3, ZB + 1, 'hole')), // M3 clearance
      box(8, 6, 5, -25, 0, ZB - 1.2, 'hole'), // cable notch
    ];
    case 'leg': case 'arm': return limbShapes(id, c, mag);
    case 'head': return [
      box(24, 26, 14, HEAD_X - 12, 0, 55), // helmet block, lies on the roof in car mode
      cylY(10, HEAD_X, -13, 13, HEAD_Z), // knuckle
      cylY(PIN_D + c, HEAD_X, -14, 14, HEAD_Z, 'hole'),
      box(14, 16, 1.2, HEAD_X - 12, 0, 48.5, 'hole'), // visor groove on the face that ends up facing out
      chamfer(HEAD_X - 24, 62, 3, -1, 1), chamfer(HEAD_X - 24, 48, 3, -1, -1),
    ];
    case 'wheel': {
      const x = LEG_X, yw = (Y_OUT + G + Y_OUT + G + 8) / 2; // wheel sits G outside the limb, 8 mm wide
      return [
        cylY(24, x, yw - 3.2, yw + 3.2, WZ), cylY(22.8, x, yw - 4, yw - 3, WZ), cylY(22.8, x, yw + 3, yw + 4, WZ), // tyre with two stepped edges
        cylY(AXLE_D + c, x, yw - 5, yw + 5, WZ, 'hole'),
        ...Array.from({ length: WINDOWS }, (_, k) => cylY(5, x + 7.5 * Math.cos((k * 2 * Math.PI) / WINDOWS), yw - 5, yw + 5, WZ + 7.5 * Math.sin((k * 2 * Math.PI) / WINDOWS), 'hole')),
      ];
    }
    case 'axle': return [
      cylY(7.5, LEG_X, Y_IN + 0.1, Y_IN + 1.3, WZ),
      cylY(AXLE_D, LEG_X, Y_IN + 1.2, Y_OUT + G + 8 + 1.2, WZ),
      cylY(AXLE_D + c + BARB, LEG_X, Y_OUT + G + 8, Y_OUT + G + 8 + 1.2, WZ),
      box(0.8, 6.2, 8.5, LEG_X, Y_OUT + G + 8 + 1.2 + 0.1 - 3.1, WZ, 'hole'),
    ];
    case 'cross-pin': return pinShapes(PIN_D * 2, 1.5, PIN_D, LEG_X, PZ, Y_OUT - 0.3, -(Y_OUT - 0.3), c);
    case 'head-pin': return pinShapes(PIN_D * 2, 1.5, PIN_D, HEAD_X, HEAD_Z, W / 2 + 1.5, -W / 2 - 1.2, c);
  }
}

// [rx, ry, rz] degrees: assembled frame -> print frame. The assembly rotation is the inverse.
const PRINT_ROT: Record<PartId, V3> = {
  chassis: [180, 0, 0], 'belly-plate': [0, 0, 0], leg: [90, 0, 0], arm: [90, 0, 0], head: [180, 0, 0], wheel: [90, 0, 0], axle: [0, 0, -90], 'cross-pin': [0, 0, -90], 'head-pin': [0, 0, -90],
};
const ORIENTATION: Record<PartId, string> = {
  chassis: 'Underside up, so the belly tray, bosses and channel open upward and need no supports.',
  'belly-plate': 'Flat, as assembled.',
  leg: 'Flat on the inner face (the face with the magnet pocket), pocket and hinge holes pointing up and down.',
  arm: 'Flat on the inner face (the face with the magnet pocket), pocket and hinge holes pointing up and down.',
  head: 'Visor groove up, flat top on the bed.',
  wheel: 'Flat on one side.',
  axle: 'Lying on its side with a brim; slit prongs stay in the print plane.',
  'cross-pin': 'Lying on its side with a brim; slit prongs stay in the print plane.',
  'head-pin': 'Lying on its side with a brim; slit prongs stay in the print plane.',
};
/** expected through-holes (genus) per part, as the blurb states them */
export const GENUS = (id: PartId): number => ({ chassis: VENTS + 2 + 2, 'belly-plate': BOSSES, leg: 2, arm: 2, head: 1, wheel: 1 + WINDOWS, axle: 0, 'cross-pin': 0, 'head-pin': 0 })[id];

const rotMatrix = (r: V3) => new Matrix4().makeRotationFromEuler(new Euler((r[0] * Math.PI) / 180, (r[1] * Math.PI) / 180, (r[2] * Math.PI) / 180, 'XYZ'));
const q4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Solids' box of a part in the assembled frame (cheap: no CSG; holes never cut the outermost faces). */
export function assembledBox(id: PartId, cfg?: Cfg) {
  const { c, mag } = cfgOf(cfg);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const s of rawShapes(id, c, mag)) if (s.mode === 'solid') for (const v of worldVertices(s)) [v.x, v.y, v.z].forEach((k, i) => { lo[i] = Math.min(lo[i], k); hi[i] = Math.max(hi[i], k); });
  return { min: lo as V3, max: hi as V3, centre: lo.map((l, i) => (l + hi[i]) / 2) as V3, size: hi.map((h, i) => h - lo[i]) as V3 };
}


/** CSG on busy faces sometimes leaves a sliver edge. Retry with the holes nudged by hundredths of a mm (far below print resolution) until the mesh is closed. */
function closedMesh(shapes: Shape[]): Float32Array | null {
  for (let k = 0; k < 14; k++) {
    const e = 0.004 * k;
    const sh = k === 0 ? shapes : shapes.map((s, i) => s.mode === 'solid' ? (k < 5 || s.id.startsWith(LATE) ? s : { ...s, size: { x: s.size.x + 0.011 * k * (1 + (i % 3)), y: s.size.y + 0.013 * k * (1 + (i % 2)), z: s.size.z } }) : {
      ...s, size: { x: s.size.x + e * (1 + (i % 5) * 0.37), y: s.size.y + e * (1 + (i % 3) * 0.41), z: s.size.z + e * (1 + (i % 4) * 0.23) },
      position: { x: s.position.x + 0.5 * e * Math.sin(i * 7.3 + k), y: s.position.y, z: s.position.z + 0.5 * e * Math.sin(i * 3.1 + 2 * k) },
    });
    try { const m = buildMesh(sh); if (m && meshStats(m)) return m; } catch { /* next nudge */ }
  }
  return null;
}

type Built = { raw: Float32Array; print: Float32Array; stats: MeshStats };
const cache = new Map<string, Built>();
/** The CSG mesh of a part: `raw` in the assembled frame, `print` in its print orientation (xy-centred, resting on z = 0). */
export function buildPart(id: PartId, cfg?: Cfg): Built {
  const { c, mag } = cfgOf(cfg);
  const key = `${id}|${c}|${mag}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = closedMesh(rawShapes(id, c, mag));
  if (!raw) throw new Error(`${id} could not be built`);
  const m = rotMatrix(PRINT_ROT[id]).elements;
  const p = new Float32Array(raw.length);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < raw.length; i += 3) {
    const x = raw[i], y = raw[i + 1], z = raw[i + 2];
    const v = [q4(m[0] * x + m[4] * y + m[8] * z), q4(m[1] * x + m[5] * y + m[9] * z), q4(m[2] * x + m[6] * y + m[10] * z)];
    v.forEach((k, j) => { p[i + j] = k; lo[j] = Math.min(lo[j], k); hi[j] = Math.max(hi[j], k); });
  }
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  for (let i = 0; i < p.length; i += 3) { p[i] = q4(p[i] - cx); p[i + 1] = q4(p[i + 1] - cy); p[i + 2] = q4(p[i + 2] - lo[2]); }
  const stats = meshStats(p);
  if (!stats) throw new Error(`${id} is not a closed mesh`);
  const out = { raw, print: p, stats };
  cache.set(key, out);
  return out;
}

const geometry = (id: PartId) => (cfg?: Cfg) => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(buildPart(id, cfg).print.slice(), 3));
  return g;
};

// ---------- assembly ----------
const inverseRot = (r: V3): V3 => [-r[0], -r[1], -r[2]];
const RIGHT_LIMB: V3 = [90, 0, 180]; // the left limb turned half a turn about Z: same print geometry, mirrored side
const absSize = (id: PartId, cfg?: Cfg): V3 => { // print-frame size = |R| * assembled size
  const m = rotMatrix(PRINT_ROT[id]).elements, s = assembledBox(id, cfg).size;
  return [0, 1, 2].map((r) => Math.abs(m[r]) * s[0] + Math.abs(m[4 + r]) * s[1] + Math.abs(m[8 + r]) * s[2]) as V3;
};
const MAT: Record<PartId, AssemblyPart['material']> = { chassis: 'PLA', 'belly-plate': 'PLA', leg: 'PLA', arm: 'PLA', head: 'PLA', wheel: 'PLA', axle: 'PETG', 'cross-pin': 'PETG', 'head-pin': 'PETG' };

type Inst = { id: string; label: string; part: PartId; dx?: number; right?: boolean; rot: V3; explode: V3; fold?: 'leg' | 'arm' | 'head'; spin?: boolean };
const HINGE = { leg: { px: LEG_X, max: 90 }, arm: { px: ARM_X, max: 90 }, head: { px: HEAD_X, max: 180 } } as const;
const side = (s: 1 | -1, name: string) => name + (s > 0 ? '-l' : '-r');
const INSTANCES: Inst[] = [
  { id: 'chassis', label: 'Chassis', part: 'chassis', rot: inverseRot(PRINT_ROT.chassis), explode: [0, 0, 0] },
  { id: 'belly-plate', label: 'Belly plate', part: 'belly-plate', rot: [0, 0, 0], explode: [0, 0, -40] },
  { id: 'head', label: 'Head', part: 'head', rot: inverseRot(PRINT_ROT.head), explode: [0, 0, 40], fold: 'head' },
  { id: 'pin-head', label: 'Head pivot pin', part: 'head-pin', rot: inverseRot(PRINT_ROT['head-pin']), explode: [0, 40, 0] },
  { id: 'pin-leg', label: 'Leg cross-pin', part: 'cross-pin', rot: inverseRot(PRINT_ROT['cross-pin']), explode: [0, 62, 0] },
  { id: 'pin-arm', label: 'Arm cross-pin', part: 'cross-pin', dx: FRONT_DX, rot: inverseRot(PRINT_ROT['cross-pin']), explode: [0, 62, 0] },
  ...([1, -1] as const).flatMap((s): Inst[] => [
    { id: side(s, 'leg'), label: `Leg (${s > 0 ? 'left' : 'right'})`, part: 'leg', right: s < 0, rot: s > 0 ? inverseRot(PRINT_ROT.leg) : RIGHT_LIMB, explode: [0, s * 16, 0], fold: 'leg' },
    { id: side(s, 'arm'), label: `Arm (${s > 0 ? 'left' : 'right'})`, part: 'arm', right: s < 0, rot: s > 0 ? inverseRot(PRINT_ROT.arm) : RIGHT_LIMB, explode: [0, s * 16, 0], fold: 'arm' },
    { id: side(s, 'wheel-r'), label: `Rear wheel (${s > 0 ? 'left' : 'right'})`, part: 'wheel', right: s < 0, rot: inverseRot(PRINT_ROT.wheel), explode: [0, s * 34, 0], fold: 'leg', spin: true },
    { id: side(s, 'wheel-f'), label: `Front wheel (${s > 0 ? 'left' : 'right'})`, part: 'wheel', dx: FRONT_DX, right: s < 0, rot: inverseRot(PRINT_ROT.wheel), explode: [0, s * 34, 0], fold: 'arm', spin: true },
    { id: side(s, 'axle-r'), label: `Rear axle (${s > 0 ? 'left' : 'right'})`, part: 'axle', right: s < 0, rot: s > 0 ? inverseRot(PRINT_ROT.axle) : [0, 0, -90], explode: [0, s * 52, 0], fold: 'leg' },
    { id: side(s, 'axle-f'), label: `Front axle (${s > 0 ? 'left' : 'right'})`, part: 'axle', dx: FRONT_DX, right: s < 0, rot: s > 0 ? inverseRot(PRINT_ROT.axle) : [0, 0, -90], explode: [0, s * 52, 0], fold: 'arm' },
  ]),
];

/** Printed parts and the same parts as they appear in the assembly (car pose, fold 0). Joints turn about Y: angle = lerp(min, max, fold), min is always 0. */
function assembly(cfg?: Cfg): AssemblyPart[] {
  const { mag } = cfgOf(cfg);
  const parts: AssemblyPart[] = INSTANCES.map((i) => {
    const bc = assembledBox(i.part, cfg).centre;
    const j = i.fold ? HINGE[i.fold] : null;
    return {
      id: i.id, label: i.label, geometry: i.part, material: MAT[i.part], size: absSize(i.part, cfg),
      position: [bc[0] + (i.dx ?? 0), i.right ? -bc[1] : bc[1], bc[2]], rotation: i.rot, explode: i.explode,
      ...(j ? { joint: { axis: [0, 1, 0] as V3, pivot: [j.px, 0, i.fold === 'head' ? HEAD_Z : PZ] as V3, min: 0, max: j.max } } : {}),
      ...(i.spin ? { spin: { axis: [0, 0, 1] as V3, rpm: 30 } } : {}),
    };
  });
  const bought = (id: string, label: string, size: V3, position: V3, rotation: V3, explode: V3, fold?: 'leg' | 'arm'): AssemblyPart => ({
    id, label, material: 'bought', size, position, rotation, explode, bought: true, shape: 'cylinder',
    ...(fold ? { joint: { axis: [0, 1, 0] as V3, pivot: [HINGE[fold].px, 0, PZ] as V3, min: 0, max: HINGE[fold].max } } : {}),
  });
  BOSS_XY.forEach(([x, y], k) => parts.push(bought(`screw-${k + 1}`, 'M3 x 8 screw', [3, 3, 8], [x, y, ZB - 2.4 + 4 + 0.4], [0, 0, 0], [0, 0, -55])));
  if (mag) for (const s of [1, -1] as const) for (const k of ['leg', 'arm'] as const) {
    const px = HINGE[k].px;
    parts.push(bought(`magnet-body-${k}${s > 0 ? '-l' : '-r'}`, 'Magnet 6 x 2 mm (chassis)', [MAGNET_D, MAGNET_D, MAGNET_T], [px, s * (W / 2 - MAGNET_T / 2 - 0.2), PZ - 7], [90, 0, 0], [0, s * 8, 0]));
    parts.push(bought(`magnet-${k}${s > 0 ? '-l' : '-r'}`, 'Magnet 6 x 2 mm (limb)', [MAGNET_D, MAGNET_D, MAGNET_T], [px, s * (Y_IN + MAGNET_T / 2 + 0.2), PZ - 7], [90, 0, 0], [0, s * 8, 0], k));
  }
  return parts;
}

/** Every part's pose at `fold` (0 = car, 1 = robot): each joint turns lerp(min, max, fold) degrees. */
export function transformerPose(parts: AssemblyPart[], fold: number): Record<string, Pose> {
  const f = Math.min(1, Math.max(0, fold));
  return Object.fromEntries(parts.map((p) => [p.id, jointTransform(p, p.joint ? lerp(p.joint.min, p.joint.max, f) : 0)]));
}

export const KIT_TRANSFORMER_KIT = {
  id: 'transformer-kit',
  title: 'Transformer kit: mini car to robot',
  category: 'Toys & Hobby',
  blurb: `Beta: an original blocky toy that folds from a car into a robot, every part printed, tolerances untested without a physical print. Chassis, 100 x 36 x 24 mm, with ${VENTS} hood vent slots cut through, ${BOSSES} screw bosses under a belly tray that a belly plate closes, a cable channel and 2 cross-pin holes plus a head pivot. 2 leg and 2 arm blocks swing 90 degrees on 3 mm pins and carry 4 wheels, each wheel with ${WINDOWS} spoke windows on a 4 mm axle; the head flips 180 degrees out of its roof seat. Hinge clearance is 0.2 to 0.5 mm and adds to every hole. With magnets on, 8 pockets (4 in the chassis sides, 4 in the limbs) take 6 x 2 mm discs that latch car mode. Pins and axles print separately, not print-in-place. One fold slider runs the whole motion, 0 = car, 1 = robot; stand the robot up by hand.`,
  config: {
    fields: FIELDS,
    defaults,
    validate: (raw: unknown) => normalizeCfg(DEF, raw, true),
  },
  printedParts: ([
    ['chassis', 'Chassis', 1], ['belly-plate', 'Belly plate', 1], ['leg', 'Leg block', 2], ['arm', 'Arm block', 2], ['head', 'Head', 1],
    ['wheel', 'Wheel', 4], ['axle', 'Wheel axle', 4], ['cross-pin', 'Cross-pin (leg or arm hinge)', 2], ['head-pin', 'Head pivot pin', 1],
  ] as [PartId, string, number][]).map(([id, label, qty]) => ({
    id, label, qty, material: MAT[id] as MaterialKey, orientation: ORIENTATION[id], build: geometry(id),
  })),
  assembly,
  boughtParts: [
    { name: 'Neodymium disc magnet', spec: '6 mm diameter x 2 mm thick, optional (only with the magnets setting on)', qty: 8, typical: true },
    { name: 'Self-tapping screw', spec: 'M3 x 8 mm, pan head, for the belly plate', qty: 4, typical: true },
  ],
};
