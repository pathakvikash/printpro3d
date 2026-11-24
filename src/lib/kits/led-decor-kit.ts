// 'led-decor-kit': our own digital home-decor kit, three printed products in one file (nothing copied from any brand or character):
//   matrix  an LED frame for a WS2812 8x8 or 16x16 grid: front frame with a diffuser slot, light-grid baffles, back cover with an ESP32 cradle and USB-C cutout
//   clock   a desk-clock case for a 4-digit 7-segment module or a 0.96 in OLED, with a stand
//   lamp    a low-poly icosphere lamp shell (1.2 mm wall) on a base that holds the LED strip and an ESP32
// Pure and node-safe. Millimetres, Z up. Each printed part is built in its stated print orientation (xy-centred, resting on z = 0).
// No prices here: a part is priced from its mesh volume by quote.ts like any other. Module sizes are public-datasheet typical values; check yours.
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { AssemblyPart, PartMaterial, V3 } from '../assembly.ts';
import { cleanTriangles, unitGeometry, type Kind, type Shape } from '../playground.ts';
import { meshStats } from '../quote.ts';
import { defaultCfg, normalizeCfg, type Cfg, type Field, type TemplateDef } from '../templateDefs.ts';
import { templateMesh } from '../templates.ts';

// ---------- config ----------

const FIELDS: Field[] = [
  { key: 'product', label: 'Product', type: 'select', options: [{ value: 'matrix', label: 'LED matrix frame' }, { value: 'clock', label: 'Smart desk clock' }, { value: 'lamp', label: 'Low-poly moon lamp' }], default: 'matrix' },
  { key: 'grid', label: 'Matrix grid', type: 'select', options: [{ value: '16', label: '16 x 16 (256 LEDs)' }, { value: '8', label: '8 x 8 (64 LEDs)' }], default: '16' },
  { key: 'pitch', label: 'Pixel pitch (typical 10 mm for 16x16 panels)', type: 'range', min: 8, max: 12, step: 1, default: 10, unit: 'mm' },
  { key: 'display', label: 'Clock display', type: 'select', options: [{ value: 'seg7', label: '4-digit 7-segment module (0.56 in)' }, { value: 'oled', label: '0.96 in OLED (128 x 64)' }], default: 'seg7' },
  { key: 'lampD', label: 'Lamp diameter', type: 'range', min: 100, max: 180, step: 10, default: 120, unit: 'mm' },
  { key: 'facets', label: 'Lamp facets', type: 'select', options: [{ value: '1', label: 'Low-poly (80 triangles)' }, { value: '2', label: 'Finer (180 triangles)' }], default: '1' },
];
const SCHEMA = { fields: FIELDS } as TemplateDef; // only .fields is read by normalizeCfg/defaultCfg
/** Strict validator: throws on a bad, missing or unknown value; returns every field snapped to its step. */
export const validateLedDecorConfig = (raw: unknown): Cfg => normalizeCfg(SCHEMA, raw, true);
const norm = (c: Cfg) => normalizeCfg(SCHEMA, c);
export const ledDecorDefaults = (): Cfg => defaultCfg(SCHEMA);

// ---------- CSG helpers (same pattern as templates.ts) ----------

let sid = 0;
const S = (kind: Kind, size: V3, pos: V3, mode: Shape['mode'] = 'solid', rot: V3 = [0, 0, 0]): Shape => ({
  id: `k${sid++}`, kind, mode, size: { x: size[0], y: size[1], z: size[2] }, position: { x: pos[0], y: pos[1], z: pos[2] }, rotation: { x: rot[0], y: rot[1], z: rot[2] },
});
const box = (size: V3, pos: V3, mode: Shape['mode'] = 'solid') => S('box', size, pos, mode);
const boxZ = (sx: number, sy: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => box([sx, sy, z1 - z0], [x, y, (z0 + z1) / 2], mode);
const cyl = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode);
const late = (s: Shape): Shape => ({ ...s, id: 'late' + s.id }); // applied after every hole (posts and rails that stand inside a cavity)
/** A 45 degree corner cut ("fillet by chamfer") through the full height at the 4 corners of an a x b footprint. leg = how far it cuts along each edge. */
const chamfers = (a: number, b: number, leg: number, h: number) =>
  ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => S('box', [leg * Math.SQRT2, leg * Math.SQRT2, h + 2], [sx * a / 2, sy * b / 2, h / 2], 'hole', [0, 0, 45]));
const corners = (x: number, y: number): [number, number][] => [[-x, -y], [x, -y], [-x, y], [x, y]];

type Built = { geo: BufferGeometry; size: V3; center: V3 };
const memo = new Map<string, Built>();

/** CSG mesh (positions) to a geometry that is xy-centred and rests on z = 0; `center` is the bounding-box centre in the builder's own frame. */
function finish(m: Float32Array | null, what: string): Built {
  if (!m || !meshStats(m)) throw new Error(`${what}: could not build a closed mesh`);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.length; i++) { lo[i % 3] = Math.min(lo[i % 3], m[i]); hi[i % 3] = Math.max(hi[i % 3], m[i]); }
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const p = Float32Array.from(m, (v, i) => v - (i % 3 === 0 ? cx : i % 3 === 1 ? cy : lo[2]));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(p, 3));
  geo.computeVertexNormals();
  return { geo, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], center: [cx, cy, (lo[2] + hi[2]) / 2] };
}
const fromShapes = (shapes: Shape[], what: string) => finish(templateMesh(shapes), what);

// ---------- (a) LED matrix frame ----------
// Typical numbers: WS2812B 5050 LEDs on a 10 mm pitch (16x16 flexible panel, 160 x 160 mm); ESP32 DevKit-style board 52 x 28 mm; USB-C receptacle about 9 x 3.3 mm.

const PLATE = 2, FRAME_H = 15, WALL = 7, SLOT = 1.7, BAFFLE_H = 8, BAFFLE_T = 1, COVER_T = 2.4, SKIRT = 19, SKIRT_W = 2;
const RAIL = 9, RAIL_T = 3, RAIL_GAP = 12.8, ESP = { l: 52, w: 28, h: 13.3 }; // board, with 8.5 mm of header pins below the PCB
const mdims = (c: Cfg) => { const n = Number(c.grid), p = c.pitch as number, np = n * p, cav = np + 0.8; return { n, p, np, cav, O: cav + 2 * WALL }; };

function ledFrame(c: Cfg): Built {
  const { np, cav, O } = mdims(c), px = cav / 2 + 3.5;
  const sh: Shape[] = [
    boxZ(O, O, 0, 0, 0, FRAME_H),
    boxZ(cav, cav, 0, 0, PLATE, FRAME_H + 1, 'hole'), // pocket for diffuser, baffles and panel, open at the back
    boxZ(np - 2, np - 2, 0, 0, -1, PLATE + 1, 'hole'), // viewing window, 1 mm inside the LED area on every side
    boxZ(np, WALL + 2, 0, cav / 2 + 3.5, PLATE, PLATE + SLOT, 'hole'), // diffuser slot through the top wall
    ...corners(px, px).map(([x, y]) => cyl(2.5, x, y, FRAME_H - 10, FRAME_H + 1, 'hole')), // 4 blind M3 pilot holes
    ...chamfers(O, O, 2, FRAME_H),
  ];
  return fromShapes(sh, 'led-frame');
}

// Built directly (no CSG, 34 coplanar unions are slow): a (2n+1) x (2n+1) lattice of rectangles, alternating wall and cell strips.
// Wall rectangles get a top and a bottom quad, and a side quad wherever they meet a cell or the outside; every edge joins exactly two triangles.
function ledBaffle(c: Cfg): Built {
  const { n, p, np } = mdims(c), t = BAFFLE_T, h = BAFFLE_H;
  const walls: [number, number][] = [[-np / 2, -np / 2 + t], ...Array.from({ length: n - 1 }, (_, i): [number, number] => [-np / 2 + (i + 1) * p - t / 2, -np / 2 + (i + 1) * p + t / 2]), [np / 2 - t, np / 2]];
  const edges: number[] = [walls[0][0]];
  walls.forEach((w, i) => { if (i) edges.push(w[0]); edges.push(w[1]); });
  const out: number[] = [];
  const quad = (a: V3, b: V3, c2: V3, d: V3) => out.push(...a, ...b, ...c2, ...a, ...c2, ...d);
  const m = edges.length - 1, solid = (i: number, j: number) => i < 0 || j < 0 || i >= m || j >= m ? false : i % 2 === 0 || j % 2 === 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    if (!solid(i, j)) continue;
    const [x0, x1, y0, y1] = [edges[i], edges[i + 1], edges[j], edges[j + 1]];
    quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]);
    quad([x0, y1, 0], [x1, y1, 0], [x1, y0, 0], [x0, y0, 0]);
    if (!solid(i + 1, j)) quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]);
    if (!solid(i - 1, j)) quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]);
    if (!solid(i, j + 1)) quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]);
    if (!solid(i, j - 1)) quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]);
  }
  return finish(Float32Array.from(out), 'led-baffle');
}

const espX = (O: number) => O / 2 - SKIRT_W - 1 - ESP.l / 2; // the board's USB end sits 1 mm from the +x skirt
const USB_C = { w: 11, h: 5.5, z: COVER_T + RAIL + 1.6 + 1.6 }; // cutout, centred on the connector

function ledBack(c: Cfg): Built {
  const { cav, O } = mdims(c), bp = cav / 2 + 3.5, bx = espX(O), I = O - 2 * SKIRT_W;
  const sh: Shape[] = [
    boxZ(O, O, 0, 0, 0, SKIRT),
    boxZ(I, I, 0, 0, COVER_T, SKIRT + 1, 'hole'),
    ...Array.from({ length: 6 }, (_, i) => boxZ(30, 2, bx - 5, (i - 2.5) * 4, -1, COVER_T + 1, 'hole')), // 6 vent slots under the board
    boxZ(SKIRT_W + 4, USB_C.w, O / 2 - SKIRT_W / 2, 0, USB_C.z - USB_C.h / 2, USB_C.z + USB_C.h / 2, 'hole'),
    ...chamfers(O, O, 2, SKIRT),
    ...corners(bp, bp).flatMap(([x, y]) => [late(cyl(6, x, y, COVER_T - 0.5, SKIRT - 0.5)), late(cyl(3.4, x, y, -1, SKIRT + 1, 'hole'))]), // screw bosses, M3 clearance
    // ESP32 cradle: two rails with a 12 mm gap each, which is also the cable channel to the panel
    ...[-1, 1].flatMap((s) => [-1, 1].map((g) => late(boxZ(22, RAIL_T, bx + g * 17, s * (RAIL_GAP + RAIL_T / 2), COVER_T - 0.5, COVER_T + RAIL)))),
  ];
  return fromShapes(sh, 'led-back');
}

// ---------- (b) smart desk clock ----------

const CK = { L: 56, W: 32, wall: 2.4, plate: 2.4, D: 32, ledge: 21 }; // inner size, wall, front plate, inner depth, ledge height above the plate
const CK_H = CK.plate + CK.D, CK_OL = CK.L + 2 * CK.wall, CK_OW = CK.W + 2 * CK.wall, LEDGE_TOP = CK.plate + CK.ledge, TILT = 15;
// typical module sizes: TM1637-style 0.56 in 4-digit board 42 x 24 (digits stand 7 mm proud); 0.96 in SSD1306 I2C OLED board 27.3 x 27.8
const DISPLAYS = {
  seg7: { name: '4-digit 7-segment module', win: [30, 13], holes: [38, 20], post: 7, pcb: [42, 24] },
  oled: { name: '0.96 in OLED module', win: [22.5, 11.5], holes: [23.5, 23.8], post: 2.5, pcb: [27.3, 27.8] },
} as const;
const disp = (c: Cfg) => DISPLAYS[c.display as keyof typeof DISPLAYS];
const CK_USB = { w: 11, h: 5.5, z: LEDGE_TOP + 1.6 + 1.6 };

function clockShell(c: Cfg): Built {
  const d = disp(c), { L, W, wall, plate } = CK;
  const hx = d.holes[0] / 2, hy = d.holes[1] / 2, pt = plate + d.post, cx = L / 2 - 2.5, cy = W / 2 - 2.5;
  const sh: Shape[] = [
    boxZ(CK_OL, CK_OW, 0, 0, 0, CK_H),
    boxZ(L, W, 0, 0, plate, CK_H + 1, 'hole'),
    boxZ(d.win[0], d.win[1], 0, 0, -1, plate + 1, 'hole'), // display window
    boxZ(wall + 2, CK_USB.w, L / 2 + wall / 2, 0, CK_USB.z - CK_USB.h / 2, CK_USB.z + CK_USB.h / 2, 'hole'), // USB-C opening in the +x end wall
    ...corners(hx, hy).flatMap(([x, y]) => [late(cyl(5, x, y, plate - 0.5, pt)), late(cyl(1.7, x, y, pt - 3, pt + 1, 'hole'))]), // 4 display posts, M2 pilots
    ...corners(cx, cy).flatMap(([x, y]) => [late(cyl(6, x, y, plate - 0.5, CK_H - 0.4)), late(cyl(2.5, x, y, CK_H - 10, CK_H + 1, 'hole'))]), // 4 cover screw columns, M3 pilots
    ...[-1, 1].map((s) => late(boxZ(40, 3.5, 0, s * (W / 2 - 1.25), LEDGE_TOP - 2, LEDGE_TOP))), // ledges the ESP32 board rests on
  ];
  return fromShapes(sh, 'clock-shell');
}

function clockCover(): Built {
  const cx = CK.L / 2 - 2.5, cy = CK.W / 2 - 2.5;
  const sh: Shape[] = [
    boxZ(CK_OL, CK_OW, 0, 0, 0, COVER_T),
    ...Array.from({ length: 5 }, (_, i) => boxZ(2, 20, (i - 2) * 6, 0, -1, COVER_T + 1, 'hole')), // 5 vent slots (before the round holes: CSG order matters here)
    ...corners(cx, cy).map(([x, y]) => cyl(3.4, x, y, -1, COVER_T + 1, 'hole')),
  ];
  return fromShapes(sh, 'clock-cover');
}

// geometry of the stand, in its own frame (slab top at z = 4); the case leans back TILT degrees on its back-bottom edge Q
const RAD = Math.PI / 180;
const clockPose = () => {
  const cs = Math.cos(TILT * RAD), sn = Math.sin(TILT * RAD), hz = CK_H / 2 + COVER_T, hy = CK_OW / 2;
  // back direction nb = (0, cs, -sn); print +y points down the slope: -u, u = (0, sn, cs); Q = (0, 0, 4) is the cover's lowest back corner
  const centre: V3 = [0, -hz * cs + hy * sn + COVER_T * cs, 4 + hz * sn + hy * cs - COVER_T * sn]; // of the shell (the cover is COVER_T further back)
  return { cs, sn, centre, nb: [0, cs, -sn] as V3 };
};

function clockStand(): Built {
  const { cs, sn } = clockPose(), Ws = CK_OL + 12, Hb = CK_OW + 2;
  const y0 = -(CK_H + COVER_T) * cs - 1, y1 = CK_OW * sn + 4 * cs + 1;
  const bc: V3 = [0, (CK_OW / 2 - 1) * sn + 2 * cs, 4 + (CK_OW / 2 - 1) * cs - 2 * sn];
  const sh: Shape[] = [
    boxZ(Ws, y1 - y0, 0, (y0 + y1) / 2, 0, 4),
    S('box', [Ws - 8, 4, Hb], bc, 'solid', [-TILT, 0, 0]), // backrest, parallel to the case's back
    cyl(9, Ws / 2 - 10, -5, -1, 5, 'hole'), // cable hole beside the case's USB-C end
  ];
  return fromShapes(sh, 'clock-stand');
}

// ---------- (c) low-poly moon lamp ----------

const LAMP_WALL = 1.2, CUT = -0.2, PLINTH_H = 20, POCKET = { l: 54, w: 30, h: 14 }, LAMP_LEDGE = 2;
const ico = (r: number, detail: number) => {
  const g = new IcosahedronGeometry(r, detail);
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  return mergeVertices(g, 1e-4);
};
const bake = (b: Brush) => {
  const g = b.geometry, { start, count } = g.drawRange, end = Number.isFinite(count) ? start + count : Infinity;
  const idx = g.index ? Array.from(g.index.array as ArrayLike<number>).slice(start, end) : null;
  return cleanTriangles(g.attributes.position.array, idx);
};

type Lamp = Built & { outMax: number; inIn: number };
const lampMemo = new Map<string, Lamp>();
/** The shell: an icosphere minus a smaller similar icosphere (wall = 1.2 mm on the thinnest facet), cut flat below CUT * radius, then flipped onto the cut face. */
function lampShell(c: Cfg): Lamp {
  const key = `${c.lampD}|${c.facets}`;
  const hit = lampMemo.get(key);
  if (hit) return hit;
  const R = (c.lampD as number) / 2, detail = Number(c.facets);
  const outer = ico(R, detail), pos = outer.attributes.position, idx = outer.index!;
  let dmin = Infinity; // distance from the centre to the nearest facet plane
  const a = new Vector3(), b = new Vector3(), d = new Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i)); b.fromBufferAttribute(pos, idx.getX(i + 1)); d.fromBufferAttribute(pos, idx.getX(i + 2));
    const nrm = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
    dmin = Math.min(dmin, Math.abs(nrm.dot(a)));
  }
  const s = 1 - LAMP_WALL / dmin;
  const ev = new Evaluator() as Evaluator & { useCDTClipping: boolean };
  ev.attributes = ['position']; ev.useGroups = false; ev.useCDTClipping = true;
  const hollow = ev.evaluate(new Brush(outer), new Brush(ico(R * s, detail)), SUBTRACTION);
  const hb = new Brush(new BufferGeometry().setAttribute('position', new BufferAttribute(bake(hollow), 3)));
  hb.updateMatrixWorld(true);
  const cutter = new Brush(unitGeometry('box').clone());
  cutter.scale.set(4 * R, 4 * R, 2 * R); cutter.position.set(0, 0, CUT * R - R); cutter.updateMatrixWorld(true);
  const m = bake(ev.evaluate(hb, cutter, SUBTRACTION));
  const zc = CUT * R;
  const shifted = Float32Array.from(m, (v, i) => (i % 3 === 2 ? v - zc : v));
  // the cut ring: smaller radii are the inner polygon; its inradius is where the base's spigot must fit
  const uniq = new Map<string, [number, number]>(); // each triangle repeats its vertices
  for (let i = 0; i < shifted.length; i += 3) if (Math.abs(shifted[i + 2]) < 1e-3) uniq.set(`${Math.round(shifted[i] * 100)},${Math.round(shifted[i + 1] * 100)}`, [shifted[i], shifted[i + 1]]);
  const ring = [...uniq.values()];
  const rad = ring.map(([x, y]) => Math.hypot(x, y)).sort((p, q) => p - q);
  const inner = ring.filter(([x, y]) => Math.hypot(x, y) <= rad[Math.floor(rad.length / 2) - 1] + 1e-6).sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  let inIn = Infinity;
  inner.forEach(([x1, y1], i) => { const [x2, y2] = inner[(i + 1) % inner.length]; inIn = Math.min(inIn, Math.abs(x1 * y2 - x2 * y1) / Math.hypot(x2 - x1, y2 - y1)); });
  const built = { ...finish(shifted, 'lamp-shell'), outMax: rad[rad.length - 1], inIn };
  lampMemo.set(key, built);
  return built;
}

const towerH = (c: Cfg) => Math.round((c.lampD as number) / 4);
function lampBaseTry(c: Cfg, k: number): Built {
  const { outMax, inIn } = lampShell(c); const TH = towerH(c), PL = PLINTH_H, plugD = 2 * (inIn - 0.4) - 0.11 * k, ex = POCKET.l / 2;
  const sh: Shape[] = [
    cyl(2 * outMax, 0, 0, 0, PL), // plinth, as wide as the shell's open ring
    S('cylinder', [plugD, plugD, 6.5], [0, 0, PL + 2.75], 'solid', [0, 0, 3.75]), // spigot the shell's opening slips over
    boxZ(POCKET.l, POCKET.w, 0, 0, -1, POCKET.h, 'hole'), // ESP32 pocket, open at the bottom
    boxZ(outMax - ex + 2, USB_C.w, (ex - 1 + outMax + 1) / 2, 0, LAMP_LEDGE + 1.6 + 1.6 - USB_C.h / 2, LAMP_LEDGE + 3.2 + USB_C.h / 2, 'hole'), // USB-C channel from the pocket out through the side
    S('cylinder', [plugD - 3, plugD - 3, 7.3], [0, 0, PL + 3.35], 'hole', [0, 0, 1.875]), // hollow spigot: room for the strip
    late(cyl(16 + 0.05 * k, 0, 0, PL - 0.5, PL + TH)), // LED tower
    ...[-1, 1].map((s) => late(boxZ(44, 3.5, 0, s * (POCKET.w / 2 - 1.25), 0.4, LAMP_LEDGE))), // ledges the ESP32 rests on, pins up
    late(cyl(6, 0, 0, 10, PL + TH - 8, 'hole')), // wire channel from the pocket up into the tower
    ...([[8, 0], [-8, 0], [0, 8], [0, -8]] as const).map(([x, y]) => late(cyl(3, x, y, PL + 4, PL + TH - 4, 'hole'))), // 4 strip channels, 1.5 mm deep
  ];
  return fromShapes(sh, 'lamp-base');
}
// CSG on this part is sensitive to the exact diameters at some sizes, so a failed build is retried with the spigot and tower nudged by a fraction of a millimetre
function lampBase(c: Cfg): Built {
  let err: unknown;
  for (let k = 0; k < 4; k++) { try { const r = lampBaseTry(c, k); return r; } catch (e) { err = e; } }
  throw err;
}

// ---------- printed parts ----------

type PrintedPart = {
  id: string; product: Product; label: string; material: PartMaterial; qty: number;
  /** How to put it on the bed. */
  orientation: string;
  build: (config: Cfg) => BufferGeometry;
  /** Openings cut right through the part (mesh genus) at this config: what describe() states. */
  holes: (config: Cfg) => number;
  describe: (config: Cfg) => string;
};
type Product = 'matrix' | 'clock' | 'lamp';

const part = (id: string, product: Product, label: string, material: PartMaterial, orientation: string, make: (c: Cfg) => Built, holes: (c: Cfg) => number, text: (c: Cfg, h: number) => string, key: (c: Cfg) => string): PrintedPart => {
  const get = (cfg: Cfg) => {
    const c = norm(cfg), k = `${id}|${key(c)}`;
    let b = memo.get(k);
    if (!b) { if (memo.size > 48) memo.clear(); b = make(c); memo.set(k, b); }
    return b;
  };
  built[id] = get;
  return { id, product, label, material, qty: 1, orientation, build: (cfg) => get(cfg).geo.clone(), holes: (cfg) => holes(norm(cfg)), describe: (cfg) => text(norm(cfg), holes(norm(cfg))) };
};
const built: Record<string, (cfg: Cfg) => Built> = {};
const mk = (c: Cfg) => `${c.grid}|${c.pitch}`, ck = (c: Cfg) => `${c.display}`, lk = (c: Cfg) => `${c.lampD}|${c.facets}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

const PRINTED: PrintedPart[] = [
  part('led-frame', 'matrix', 'LED matrix frame', 'PETG', 'front face down on the bed; no supports (the diffuser slot is a short bridge)', ledFrame, () => 2,
    (c, h) => `Front frame for a ${c.grid} x ${c.grid} panel at ${c.pitch} mm pitch: ${plural(h, 'opening')} (the viewing window and the diffuser slot in the top wall), 4 corner pilot holes for M3 screws, chamfered corners.`, mk),
  part('led-baffle', 'matrix', 'Light-grid baffles', 'PLA', 'flat on the bed, walls up; print in white', ledBaffle, (c) => Number(c.grid) ** 2,
    (c, h) => `Light grid with ${plural(h, 'opening')}, one cell per LED (${c.grid} x ${c.grid} at ${c.pitch} mm pitch), 1 mm walls, 8 mm tall.`, mk),
  part('led-back', 'matrix', 'Back cover with ESP32 cradle', 'PETG', 'plate down, skirt up; no supports', ledBack, () => 11,
    (c, h) => `Back cover with ${plural(h, 'opening')}: 4 M3 screw holes through screw bosses, 6 vent slots and a USB-C cutout. Two rails hold a 52 x 28 mm ESP32 board, with a gap in each rail for the cable to the panel.`, mk),
  part('clock-shell', 'clock', 'Clock case', 'PLA', 'front face down on the bed; no supports (the ESP32 ledges are 3.5 mm)', clockShell, () => 2,
    (c, h) => `Clock case for the ${disp(c).name}: ${plural(h, 'opening')} (the display window and the USB-C opening in one end wall), 4 display posts with M2 pilot holes, 4 cover screw columns with M3 pilot holes, 2 ledges for an ESP32 board.`, ck),
  part('clock-cover', 'clock', 'Clock back cover', 'PLA', 'flat on the bed', clockCover, () => 9,
    (_c, h) => `Back cover with ${plural(h, 'opening')}: 4 M3 clearance holes and 5 vent slots.`, ck),
  part('clock-stand', 'clock', 'Clock stand', 'PLA', 'slab down on the bed; the backrest leans 15 degrees, no supports', clockStand, () => 1,
    (_c, h) => `Stand that holds the case ${TILT} degrees back from upright, with ${plural(h, 'opening')} (a 9 mm cable hole).`, ck),
  part('lamp-shell', 'lamp', 'Moon lamp shell', 'PLA', 'open side down; the upper dome is steeper than 45 degrees, so use tree supports or print it in natural PLA', lampShell, () => 0,
    (c, h) => `Low-poly icosphere shell, ${Number(c.lampD)} mm across, ${LAMP_WALL} mm minimum wall, ${20 * (Number(c.facets) + 1) ** 2} triangular facets before the flat cut, ${plural(h, 'opening')} through the wall.`, lk),
  part('lamp-base', 'lamp', 'Lamp base with LED holder', 'PLA', 'plinth bottom down; the 30 mm ESP32 pocket roof is a bridge', lampBase, () => 1,
    (c, h) => `Base with a ${towerH(c)} mm LED tower above the plinth with 4 strip channels, a spigot the shell slips over, and an ESP32 pocket with ${plural(h, 'opening')} (a USB-C channel out of the pocket through the side).`, lk),
];

// ---------- bought parts ----------

type Bought = { name: string; spec: string; qty: number; typical: true };
const ESP_B: Bought = { name: 'ESP32 dev board', spec: 'ESP32 DevKit-style board with USB-C, about 52 x 28 mm with header pins (typical; sizes vary by maker)', qty: 1, typical: true };
const PSU_B: Bought = { name: '5 V 2 A USB-C power supply', spec: '5 V, 2 A or more, USB-C cable (a 16x16 panel can draw several amps at full white, so keep brightness limited in software)', qty: 1, typical: true };
const BOUGHT: Record<Product, Bought[]> = {
  matrix: [
    { name: 'WS2812 LED panel', spec: '16 x 16 flexible or rigid panel on a 10 mm pitch (160 x 160 mm, typical), or an 8 x 8 panel (typical 8 to 10 mm pitch)', qty: 1, typical: true },
    { name: 'Diffuser sheet', spec: 'frosted acrylic or polycarbonate, 1.5 mm thick, cut to the LED area', qty: 1, typical: true },
    ESP_B, PSU_B,
    { name: 'M3 screws', spec: 'M3 x 12 mm self-tapping or machine screws for the 4 cover screws', qty: 4, typical: true },
  ],
  clock: [
    { name: 'Display module', spec: '4-digit 7-segment 0.56 in module, about 42 x 24 mm, or a 0.96 in 128 x 64 I2C OLED module, about 27 x 28 mm (typical)', qty: 1, typical: true },
    ESP_B, PSU_B,
    { name: 'M3 screws', spec: 'M3 x 10 mm for the back cover', qty: 4, typical: true },
    { name: 'M2 screws', spec: 'M2 x 6 mm for the display posts', qty: 4, typical: true },
  ],
  lamp: [
    { name: 'WS2812 LED strip', spec: '60 LEDs per metre strip, about 0.3 m wound round the tower (typical)', qty: 1, typical: true },
    ESP_B, PSU_B,
  ],
};
const BOUGHT_ALL: Bought[] = [...new Map(Object.values(BOUGHT).flat().map((b) => [b.name, b])).values()];

// ---------- assembly ----------

const printed = (id: string, cfg: Cfg) => built[id](cfg);
const bought = (id: string, label: string, size: V3, position: V3, explode: V3, rotation: V3 = [0, 0, 0], shape: 'box' | 'cylinder' = 'box'): AssemblyPart =>
  ({ id, label, material: 'bought', size, position, rotation, explode, bought: true, shape });
const printedPart = (id: string, label: string, material: PartMaterial, cfg: Cfg, position: V3, rotation: V3, explode: V3): AssemblyPart => {
  const b = printed(id, cfg);
  return { id, label, geometry: id, material, size: b.size, position, rotation, explode };
};
const rx = (deg: number, p: V3): V3 => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const mat = (id: string) => PRINTED.find((p) => p.id === id)!.material;
const lab = (id: string) => PRINTED.find((p) => p.id === id)!.label;

function matrixAssembly(c: Cfg): AssemblyPart[] {
  const { np, O } = mdims(c), zc = O / 2, yBack = FRAME_H + SKIRT;
  const front: V3 = [-90, 0, 180], back: V3 = [90, 0, 0]; // front parts: print z -> world +y; back cover is turned round, plate at the back
  const baffleY = PLATE + SLOT, panelY = baffleY + BAFFLE_H;
  const esp = printed('led-back', c), bx = espX(O);
  return [
    printedPart('led-frame', lab('led-frame'), mat('led-frame'), c, [0, FRAME_H / 2, zc], front, [0, 0, 0]),
    bought('bought-diffuser', 'Diffuser sheet', [np, 1.5, np], [0, PLATE + SLOT / 2, zc], [0, 14, 0]),
    printedPart('led-baffle', lab('led-baffle'), mat('led-baffle'), c, [0, baffleY + BAFFLE_H / 2, zc], front, [0, 28, 0]),
    bought('bought-led-panel', `WS2812 ${c.grid} x ${c.grid} LED panel`, [np, 3, np], [0, panelY + 1.5, zc], [0, 42, 0]),
    printedPart('led-back', lab('led-back'), mat('led-back'), c, [0, yBack - esp.center[2], zc], back, [0, 70, 0]),
    bought('bought-esp32', 'ESP32 dev board', [ESP.l, ESP.w, ESP.h], [bx, yBack - (COVER_T + RAIL - 8.5 + ESP.h / 2), zc], [0, 86, 0], back),
    bought('bought-psu', '5 V 2 A USB-C supply', [50, 28, 28], [O / 2 + 45, 25, 14], [60, 70, 0]),
  ];
}

function clockAssembly(c: Cfg): AssemblyPart[] {
  const { centre, nb } = clockPose(), d = disp(c), rot: V3 = [-(90 + TILT), 0, 0], Ws = CK_OL + 12;
  const stand = printed('clock-stand', c);
  // a point in the shell's print frame (origin at its bbox centre, z up from the front face) to world
  const at = (p: V3): V3 => { const r = rx(-(90 + TILT), [p[0], p[1], p[2] - CK_H / 2]); return [centre[0] + r[0], centre[1] + r[1], centre[2] + r[2]]; };
  const away = (k: number): V3 => [0, nb[1] * k, nb[2] * k];
  const t = d.post + 1.6 + 3; // module thickness: digits or glass, PCB, parts behind it
  const espBottom = LEDGE_TOP - 8.5;
  return [
    printedPart('clock-stand', lab('clock-stand'), mat('clock-stand'), c, stand.center, [0, 0, 0], [0, 0, 0]),
    printedPart('clock-shell', lab('clock-shell'), mat('clock-shell'), c, centre, rot, [0, 0, 0]),
    bought('bought-display', d.name, [d.pcb[0], d.pcb[1], t], at([0, 0, CK.plate + t / 2]), away(22), rot),
    bought('bought-esp32', 'ESP32 dev board', [ESP.l, ESP.w, ESP.h], at([CK.L / 2 - 0.5 - ESP.l / 2, 0, espBottom + ESP.h / 2]), away(45), rot),
    printedPart('clock-cover', lab('clock-cover'), mat('clock-cover'), c, at([0, 0, CK_H + COVER_T / 2]), rot, away(70)),
    bought('bought-psu', '5 V 2 A USB-C supply', [45, 28, 30], [Ws / 2 + 40, -10, 15], [50, 0, 0]),
  ];
}

function lampAssembly(c: Cfg): AssemblyPart[] {
  const shell = lampShell(c), base = printed('lamp-base', c), TH = towerH(c), PL = PLINTH_H;
  return [
    printedPart('lamp-base', lab('lamp-base'), mat('lamp-base'), c, [0, 0, base.size[2] / 2], [0, 0, 0], [0, 0, 0]),
    bought('bought-esp32', 'ESP32 dev board', [ESP.l, ESP.w, 10.1], [0, 0, LAMP_LEDGE + 10.1 / 2], [0, 0, -40]),
    bought('bought-led-strip', 'WS2812 LED strip (wound)', [22, 22, TH - 8], [0, 0, PL + TH / 2], [0, 0, 45], [0, 0, 0], 'cylinder'),
    printedPart('lamp-shell', lab('lamp-shell'), mat('lamp-shell'), c, [0, 0, PL + shell.size[2] / 2], [0, 0, 0], [0, 0, 90]),
    bought('bought-psu', '5 V 2 A USB-C supply', [45, 28, 30], [shell.outMax + 40, 0, 15], [50, 0, 0]),
  ];
}

const ASSEMBLY: Record<Product, (c: Cfg) => AssemblyPart[]> = { matrix: matrixAssembly, clock: clockAssembly, lamp: lampAssembly };
const product = (c: Cfg) => c.product as Product;

export const KIT_LED_DECOR_KIT = {
  id: 'led-decor-kit',
  title: 'LED decor kit: matrix frame, desk clock and moon lamp',
  category: 'Smart Home & Decor',
  blurb: 'Three printable digital decor products from one kit. An LED matrix frame for a WS2812 8x8 or 16x16 grid (typical 10 mm pixel pitch on 16x16 panels) with light-grid baffles, a diffuser slot and a back cover with an ESP32 cradle and USB-C cutout. A smart desk clock case for a 4-digit 7-segment module or a 0.96 in OLED, with a stand. A low-poly moon lamp shell with a 1.2 mm wall on a base that holds the LED strip and an ESP32. Module and board sizes are typical values; check yours before printing.',
  config: { fields: FIELDS, defaults: ledDecorDefaults(), validate: validateLedDecorConfig },
  printedParts: PRINTED,
  /** The assembled model of the product the config selects: printed parts plus labelled placeholders for bought parts. */
  assembly: (config: Cfg): AssemblyPart[] => { const c = norm(config); return ASSEMBLY[product(c)](c); },
  /** The builder-key map the assembly viewer resolves `geometry` ids from. */
  geometries: (config: Cfg): Record<string, BufferGeometry> => {
    const c = norm(config);
    return Object.fromEntries(PRINTED.filter((p) => p.product === product(c)).map((p) => [p.id, p.build(c)]));
  },
  boughtParts: BOUGHT_ALL,
  products: Object.fromEntries((['matrix', 'clock', 'lamp'] as const).map((p) => [p, {
    printedParts: PRINTED.filter((x) => x.product === p), boughtParts: BOUGHT[p], assembly: (config: Cfg) => ASSEMBLY[p]({ ...norm(config), product: p }),
  }])) as Record<Product, { printedParts: PrintedPart[]; boughtParts: Bought[]; assembly: (config: Cfg) => AssemblyPart[] }>,
};

// ---------- live-clock demo ----------

const FONT = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
/** HH:MM in a 3x5 font on a w x h grid, row-major, true = lit; centred. The colon blinks (lit on even seconds).
 * ponytail: a 4-digit clock needs 15 columns, so a narrower grid (the 8x8) shows HH on even seconds and MM on odd ones, centred. */
export function ledClockPixels(date: Date, w: number, h: number): boolean[] {
  const out = new Array<boolean>(Math.max(0, w) * Math.max(0, h)).fill(false);
  const put = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) out[y * w + x] = true; };
  const digit = (d: number, x0: number, y0: number) => { for (let i = 0; i < 15; i++) if (FONT[d][i] === '1') put(x0 + (i % 3), y0 + Math.floor(i / 3)); };
  const hh = date.getHours(), mm = date.getMinutes(), y0 = Math.floor((h - 5) / 2);
  if (w >= 15) {
    const x0 = Math.floor((w - 15) / 2);
    digit(Math.floor(hh / 10), x0, y0); digit(hh % 10, x0 + 4, y0);
    if (date.getSeconds() % 2 === 0) { put(x0 + 7, y0 + 1); put(x0 + 7, y0 + 3); }
    digit(Math.floor(mm / 10), x0 + 8, y0); digit(mm % 10, x0 + 12, y0);
  } else {
    const v = date.getSeconds() % 2 === 0 ? hh : mm, x0 = Math.floor((w - 7) / 2);
    digit(Math.floor(v / 10), x0, y0); digit(v % 10, x0 + 4, y0);
  }
  return out;
}
