// Rolling companion robot kit: an original ball robot. Two hemispherical shell halves press together (a lip on one half, a socket in the other);
// inside, a chassis rides on two small wheels that grip the shell's inner surface ("hamster wheel" drive: both wheels turn the same way and the
// ball rolls, turn them differently and it steers). The chassis hangs in the lower part of the ball. Our own design, no brand or product copied.
// Primitives: the playground's sphere IS available, so the shells are real spherical shells (outer sphere minus inner sphere, cut at the join plane).
// BETA-style caveat: nothing here is test printed; the press-fit lip clearance and wheel grip will need tuning on a real print.
//
// Frames. Assembled: mm, ball centre at the origin, the ball rolls about X (the axle axis), Y is the rolling direction, Z up.
// Each part is designed in its own print frame (resting on z = 0 or not, then xy-centred and dropped onto z = 0 by finish()):
//   shell halves  rim down on the bed, dome up, with a flat pad on top (no unsupported cap). The front half also stands on its lip ring.
//   chassis, deck flat, as assembled (the deck is a separate flat print screwed to the chassis posts, so nothing bridges or overhangs).
//   wheel         lying flat (axle along Z), rotated onto X in the assembly.
import { BufferAttribute, BufferGeometry } from 'three';
import type { AssemblyPart, V3 } from '../assembly.ts';
import { LATE, buildMesh, type Kind, type Shape } from '../playground.ts';
import { meshStats, type MaterialKey, type MeshStats } from '../quote.ts';
import { normalizeCfg, type Cfg, type Field, type TemplateDef } from '../templateDefs.ts';

// ---------- facts the blurb states (the test ties each to the mesh) ----------
export const LIP = 4; // mm, how far the lip of the front half enters the rear half's socket
const LIP_CLR = 0.15; // radial clearance of the press fit, each side
export const WINDOW: [number, number] = [10, 4.5]; // through window for a ToF sensor lens or a small camera, mm
export const RECESS: [number, number] = [18, 12]; // shallow recess round the window for the sensor board, mm
export const FACE_PAD_DEPTH = 3; // the dome is cut flat this far below its apex
const WHEEL_D = 26, WHEEL_W = 5.2; // mm
const AXLE_HOLE = 3.1; // for a 3 mm N20 shaft
export const ZIP_SLOTS = 2, SCREW_POSTS = 2, STANDOFFS = 4;
const MOTOR_W = 12, MOTOR_H = 10, SHAFT_GAP = 1.5; // N20 cross-section; gap between the gearbox face and the wheel
const MOTOR_LEN = { n20: 24, 'n20-enc': 33 } as const; // body length; the encoder version is longer
const WY = 7.1; // each motor sits this far off the centre line (the two motors lie side by side, shafts pointing apart)
const CH_W = 12.2, CH_Z0 = 4, BLOCK_TOP = 11; // motor channel width and floor, top of the cradle block
export const MOTOR_AXIS = CH_Z0 + 5.1; // motor axis height above the underside of the chassis
const PLATE_R = 24, PLATE_T = 3;
const POST_X = 13.2, POST_Y = 16.4, POST_D = 4.6, POST_TOP = 23; // the deck sits on top of the posts
const BAT: [number, number] = [20.8, 30.8]; // pocket for a 1S LiPo about 20 x 30 x 5 mm
const BAT_Y = -11, ESP_Y = 19, ESP_PATTERN: [number, number] = [15, 20]; // standoff pattern x, y on the deck

// ---------- config ----------
const FIELDS: Field[] = [
  { key: 'diameter', label: 'Ball diameter', type: 'range', min: 96, max: 110, step: 2, default: 100, unit: 'mm', help: 'Outside diameter. 96 mm is the smallest that holds the chassis and wheels.' },
  { key: 'wall', label: 'Shell wall thickness', type: 'range', min: 2.4, max: 4, step: 0.4, default: 2.4, unit: 'mm', help: 'Thicker is stiffer and heavier; the lip is sized from it.' },
  { key: 'motor', label: 'Motor type', type: 'select', options: [{ value: 'n20', label: 'N20 gear motor, 24 mm body' }, { value: 'n20-enc', label: 'N20 gear motor with encoder, 33 mm body' }], default: 'n20', help: 'Sets the cradle and wheel positions. Body length excludes the shaft.' },
];
const DEF: TemplateDef = { id: 'rolling-companion-kit', name: 'Rolling companion robot kit', category: 'Robotics', material: 'PETG', colour: 'two colours, shell and chassis', blurb: '', fields: FIELDS, marketLinks: [] };
const defaults = (): Cfg => normalizeCfg(DEF, {});
const cfgOf = (raw: Cfg | undefined) => {
  const c = normalizeCfg(DEF, raw ?? {});
  const motor = c.motor as keyof typeof MOTOR_LEN;
  return { D: c.diameter as number, w: c.wall as number, motor, L: MOTOR_LEN[motor] };
};

// ---------- shape helpers ----------
let n = 0;
const S = (kind: Kind, size: V3, pos: V3, mode: Shape['mode'] = 'solid'): Shape => ({
  id: `r${n++}`, kind, mode, size: { x: size[0], y: size[1], z: size[2] }, position: { x: pos[0], y: pos[1], z: pos[2] }, rotation: { x: 0, y: 0, z: 0 },
});
const box = (sx: number, sy: number, sz: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('box', [sx, sy, z1 - z0], [x, y, (z0 + z1) / 2], mode);
const cylZ = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode);
const ball = (d: number, z: number, mode: Shape['mode'] = 'solid') => S('sphere', [d, d, d], [0, 0, z], mode);
const late = (s: Shape): Shape => ({ ...s, id: LATE + s.id });

// ---------- the parts ----------
export type PartId = 'shell-front' | 'shell-rear' | 'chassis' | 'deck' | 'wheel';

/** Shell half: sphere shell cut at the join plane, flat pad on top. `front` has the lip ring and the sensor window; the rear has the socket.
 * The sphere centre sits 0.4 mm off the join plane so no ring of facets lies exactly in it (a coplanar cut leaves open edges). */
function shellShapes(front: boolean, D: number, w: number): Shape[] {
  const R = D / 2, ri = R - w;
  const rim = front ? LIP : 0, zc = rim + 0.4, zf = zc + R - FACE_PAD_DEPTH; // join plane, sphere centre, top of the flat pad
  const rb = Math.sqrt(6 * R - 9) - 0.4; // the pad disc, a little inside the cut cap's edge
  const sh: Shape[] = [
    ball(D, zc), ball(D - 2 * w, zc, 'hole'),
    box(D + 10, D + 10, 0, 0, 0, rim - R - 10, rim, 'hole'), // everything below the join plane
    box(D + 10, D + 10, 0, 0, 0, zf, zf + 10, 'hole'), // the cap above the pad plane
    late(cylZ(2 * rb, 0, 0, zf - 2, zf + 0.02)), // flat pad, 2 mm thick; 0.02 proud of the cut so the two faces are not coplanar
  ];
  if (front) {
    sh.push(late(cylZ(2 * (R - w / 2 - LIP_CLR), 0, 0, 0, rim + 1))); // lip ring: this disc ...
    sh.push(late(cylZ(2 * (ri - 0.8), 0, 0, -1, rim + 2, 'hole'))); // ... minus this one
    sh.push(late(box(RECESS[0], RECESS[1], 0, 0, 0, zf - 1, zf + 3, 'hole'))); // sensor board recess in the pad, 1 mm floor left
    sh.push(late(box(WINDOW[0], WINDOW[1], 0, 0, 0, zf - 8, zf - 0.6, 'hole'))); // window through the floor
  } else sh.push(cylZ(D - w, 0, 0, -1, LIP + 0.3, 'hole')); // socket for the lip, leaves a w/2 skin
  return sh;
}

function chassisShapes(L: number): Shape[] {
  const Lb = Math.min(L - 4, 20), x0 = L / 2 + 0.5;
  return [
    cylZ(2 * PLATE_R, 0, 0, 0, PLATE_T),
    box(Lb, 29.2, 0, 0, 0, PLATE_T - 0.1, BLOCK_TOP), // cradle block for both motors
    ...[WY, -WY].map((y) => box(Lb + 6, CH_W, 0, 0, y, CH_Z0, BLOCK_TOP + 1, 'hole')), // motor channels, open at both ends and on top
    box(40, 28.5, 0, x0 + 20, 7.25, -1, PLATE_T + 1, 'hole'), box(40, 28.5, 0, -x0 - 20, -7.25, -1, PLATE_T + 1, 'hole'), // wheel slots
    ...[[POST_X, -POST_Y], [-POST_X, POST_Y]].flatMap(([x, y]) => [cylZ(POST_D, x, y, PLATE_T - 0.1, POST_TOP), late(cylZ(1.8, x, y, POST_TOP - 6, POST_TOP + 1, 'hole'))]), // posts, M2 pilot holes
  ];
}

function deckShapes(): Shape[] {
  const [bw, bl] = BAT;
  return [
    box(38, 61, 0, 0, 1.5, 0, 3),
    box(bw + 2.4, bl + 2.4, 0, 0, BAT_Y, 2.9, 8), // battery cradle walls
    box(bw, bl, 0, 0, BAT_Y, 1.5, 9.5, 'hole'), // pocket, 1.5 mm floor
    ...[1, -1].map((s) => box(2.5, 8, 0, s * 15.5, 0, -1, 4, 'hole')), // zip-tie slots on both sides of the battery
    ...[[POST_X, -POST_Y], [-POST_X, POST_Y]].map(([x, y]) => cylZ(2.4, x, y, -1, 4, 'hole')), // M2 clearance over the posts
    ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => {
      const x = (sx * ESP_PATTERN[0]) / 2, y = ESP_Y + (sy * ESP_PATTERN[1]) / 2;
      return [late(cylZ(5, x, y, 2.9, 8.9)), late(cylZ(1.8, x, y, 4.9, 9.5, 'hole'))]; // ESP32 standoffs, pilot holes
    })),
  ];
}

function wheelShapes(): Shape[] {
  const zc = WHEEL_W / 2;
  return [
    S('sphere', [WHEEL_D, WHEEL_D, 7], [0, 0, zc]), // a lens: crowned, so the tyre rolls on a line on the curved shell
    box(40, 40, 0, 0, 0, -6, 0, 'hole'), box(40, 40, 0, 0, 0, WHEEL_W, WHEEL_W + 6, 'hole'), // flat faces: print flat, sit flat on the hub
    cylZ(AXLE_HOLE, 0, 0, -1, WHEEL_W + 1, 'hole'),
  ];
}

export const rawShapes = (id: PartId, cfg?: Cfg): Shape[] => {
  const { D, w, L } = cfgOf(cfg);
  switch (id) {
    case 'shell-front': return shellShapes(true, D, w);
    case 'shell-rear': return shellShapes(false, D, w);
    case 'chassis': return chassisShapes(L);
    case 'deck': return deckShapes();
    case 'wheel': return wheelShapes();
  }
};
/** expected through-holes (genus): window; 2 posts' screws and 2 zip slots; axle hole */
export const GENUS = (id: PartId): number => ({ 'shell-front': 1, 'shell-rear': 0, chassis: 0, deck: ZIP_SLOTS + SCREW_POSTS, wheel: 1 })[id];

const ORIENTATION: Record<PartId, string> = {
  'shell-front': 'Dome up, standing on its lip ring. The flat pad on top avoids an unsupported cap.',
  'shell-rear': 'Dome up, rim on the bed. The flat pad on top avoids an unsupported cap.',
  chassis: 'Flat, as shown. Motor channels open upward.',
  deck: 'Flat, as shown; battery walls and standoffs point up.',
  wheel: 'Flat on one face, with a brim. Print in TPU.',
};
const MAT: Record<PartId, MaterialKey> = { 'shell-front': 'PLA', 'shell-rear': 'PLA', chassis: 'PETG', deck: 'PETG', wheel: 'TPU' };

// ---------- building ----------
const q4 = (v: number) => Math.round(v * 1e4) / 1e4;
type Built = { raw: Float32Array; print: Float32Array; stats: MeshStats; centre: V3 }; // centre: bounding box centre in the design frame
const cache = new Map<string, Built>();

/** The CSG mesh of a part. `print` is xy-centred and rests on z = 0; `centre` is where the part's box centre was before that (design frame). */
export function buildPart(id: PartId, cfg?: Cfg): Built {
  const { D, w, motor } = cfgOf(cfg);
  const key = `${id}|${D}|${w}|${motor}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = buildMesh(rawShapes(id, cfg));
  if (!raw || !meshStats(raw)) throw new Error(`${id} could not be built`);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < raw.length; i += 3) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], raw[i + j]); hi[j] = Math.max(hi[j], raw[i + j]); }
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const print = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) { print[i] = q4(raw[i] - cx); print[i + 1] = q4(raw[i + 1] - cy); print[i + 2] = q4(raw[i + 2] - lo[2]); }
  const stats = meshStats(print);
  if (!stats) throw new Error(`${id} is not a closed mesh`);
  const out = { raw, print, stats, centre: [cx, cy, (lo[2] + hi[2]) / 2] as V3 };
  cache.set(key, out);
  return out;
}

const geometry = (id: PartId) => (cfg?: Cfg) => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(buildPart(id, cfg).print.slice(), 3));
  return g;
};

// ---------- assembly ----------
/** Where the wheels and chassis sit: each wheel's lowest point touches the inside of the shell at its own (x, y). Returns the wheel axis height
 * (negative: below the ball centre) and the underside of the chassis. */
export function placement(cfg?: Cfg) {
  const { D, w, L } = cfgOf(cfg), ri = D / 2 - w, xw = L / 2 + SHAFT_GAP + WHEEL_W / 2;
  const wc = -Math.sqrt(ri * ri - xw * xw - WY * WY) + WHEEL_D / 2;
  return { ri, xw, wc, pb: wc - MOTOR_AXIS, deckZ: wc - MOTOR_AXIS + POST_TOP };
}

function assembly(cfg?: Cfg): AssemblyPart[] {
  const { L } = cfgOf(cfg);
  const { xw, wc, pb, deckZ } = placement(cfg);
  const part = (id: string, label: string, p: PartId, position: V3, rotation: V3, explode: V3, extra: Partial<AssemblyPart> = {}): AssemblyPart =>
    ({ id, label, geometry: p, material: MAT[p], size: ((s) => [s.x, s.y, s.z] as V3)(buildPart(p, cfg).stats.sizeMm), position, rotation, explode, ...extra });
  const bought = (id: string, label: string, size: V3, position: V3, explode: V3, extra: Partial<AssemblyPart> = {}): AssemblyPart =>
    ({ id, label, material: 'bought', size, position, rotation: [0, 0, 0], explode, bought: true, ...extra });
  const [fc, rc, ch, dk] = (['shell-front', 'shell-rear', 'chassis', 'deck'] as PartId[]).map((p) => buildPart(p, cfg).centre);
  const dkSize = buildPart('deck', cfg).stats.sizeMm;
  return [
    part('shell-front', 'Front shell half', 'shell-front', [fc[2] - LIP, fc[1], -fc[0]], [0, 90, 0], [60, 0, 0]),
    part('shell-rear', 'Rear shell half', 'shell-rear', [-rc[2], rc[1], rc[0]], [0, -90, 0], [-60, 0, 0]),
    part('chassis', 'Chassis', 'chassis', [ch[0], ch[1], pb + ch[2]], [0, 0, 0], [0, 0, -40]),
    part('deck', 'Deck', 'deck', [dk[0], dk[1], deckZ + dkSize.z / 2], [0, 0, 0], [0, 0, 45]),
    part('wheel-a', 'Wheel', 'wheel', [xw, WY, wc], [0, 90, 0], [30, 0, -10], { spin: { axis: [0, 0, 1], rpm: 30 } }),
    part('wheel-b', 'Wheel', 'wheel', [-xw, -WY, wc], [0, 90, 0], [-30, 0, -10], { spin: { axis: [0, 0, 1], rpm: -30 } }),
    bought('motor-a', 'N20 gear motor', [L, MOTOR_W, MOTOR_H], [0, WY, wc], [0, 30, 10]),
    bought('motor-b', 'N20 gear motor', [L, MOTOR_W, MOTOR_H], [0, -WY, wc], [0, -30, 10]),
    bought('battery', '1S LiPo battery', [20, 30, 5], [0, BAT_Y, deckZ + 1.5 + 2.5], [0, 0, 80]),
    bought('esp32', 'ESP32 board', [18, 22.5, 3], [0, ESP_Y, deckZ + 8.9 + 1.5], [0, 0, 100]),
  ];
}

export const KIT_ROLLING_COMPANION_KIT = {
  id: 'rolling-companion-kit',
  title: 'Rolling companion robot kit',
  category: 'Robotics',
  blurb: `An original rolling ball robot, our own design (not a copy of any commercial robot). What prints: two hemispherical shell halves, 96 to 110 mm across (100 mm default, wall 2.4 to 4 mm), that press together on a ${LIP} mm lip; the front half has a flat face pad with a ${RECESS[0]} x ${RECESS[1]} mm recess and a ${WINDOW[0]} x ${WINDOW[1]} mm window for a ToF sensor or small camera, on the roll axis so a chassis-mounted sensor keeps looking out while the shell turns. Inside, a chassis disc with a cradle for 2 N20 gear motors lying side by side, 2 wheel slots, ${SCREW_POSTS} posts, and a separate deck with a 1S LiPo pocket, ${ZIP_SLOTS} zip-tie slots and ${STANDOFFS} standoffs for a small ESP32 board. 2 lens-shaped TPU wheels press onto the motor shafts and grip the shell from inside: both turn the same way and the ball rolls, one faster than the other and it steers. What you buy: the electronics listed below. Nothing is test printed yet: tune the lip fit and wheel grip on your printer.`,
  config: { fields: FIELDS, defaults, validate: (raw: unknown) => normalizeCfg(DEF, raw, true) },
  printedParts: ([
    ['shell-front', 'Front shell half (window)', 1], ['shell-rear', 'Rear shell half', 1], ['chassis', 'Chassis with motor cradle', 1], ['deck', 'Deck: battery and ESP32', 1], ['wheel', 'Wheel (TPU)', 2],
  ] as [PartId, string, number][]).map(([id, label, qty]) => ({ id, label, qty, material: MAT[id], orientation: ORIENTATION[id], build: geometry(id) })),
  assembly,
  boughtParts: [
    { name: 'N20 gear motor', spec: '3 to 6 V, 12 x 10 mm body, 24 mm long (33 mm with encoder), 3 mm D-shaft about 9 mm long', qty: 2, typical: true },
    { name: 'Small ESP32 board', spec: `about 22 x 18 mm super-mini or XIAO class; the standoffs are on a ${ESP_PATTERN[0]} x ${ESP_PATTERN[1]} mm pattern, check your board`, qty: 1, typical: true },
    { name: 'Dual DC motor driver module', spec: 'small DRV8833 class breakout, tied to the deck with a zip tie', qty: 1, typical: true },
    { name: '1S LiPo battery', spec: '3.7 V, about 20 x 30 x 5 mm (502030 class) with a protection circuit', qty: 1, typical: true },
    { name: 'ToF distance sensor or camera module', spec: `optional, sits in the ${RECESS[0]} x ${RECESS[1]} mm face recess`, qty: 1, typical: true },
    { name: 'M2 screws', spec: 'M2 x 8 self-tapping, for the deck posts and standoffs', qty: 6, typical: true },
  ],
};
