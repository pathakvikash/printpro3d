// Mesh builders for the parametric templates (templateDefs.ts holds the schema). Pure: shapes -> CSG mesh via playground.ts.
// Each builder returns the shapes plus the facts its description states, so the description cannot drift from the model:
// `holes` = openings cut right through the part (the mesh's genus), `parts` = separate pieces on the plate.
// Coordinates: mm, Z up, part lies on Z=0 and is centred on X/Y.
import { buildMesh, LATE, type Kind, type Shape } from './playground.ts';
import { meshStats, quote, fitsBed, type MeshStats } from './quote.ts';
import { frameMotorXY, templateById, type Cfg, type TemplateDef } from './templateDefs.ts';

export type Built = { shapes: Shape[]; holes: number; parts: number; description: string };

type V = [number, number, number];
let n = 0;
const S = (kind: Kind, size: V, pos: V, mode: Shape['mode'] = 'solid', rot: V = [0, 0, 0]): Shape => ({
  id: `t${n++}`, kind, mode,
  size: { x: size[0], y: size[1], z: size[2] },
  position: { x: pos[0], y: pos[1], z: pos[2] },
  rotation: { x: rot[0], y: rot[1], z: rot[2] },
});
const box = (size: V, pos: V, mode: Shape['mode'] = 'solid') => S('box', size, pos, mode);
// a vertical cylinder; z0..z1 is its height range
const cyl = (d: number, x: number, y: number, z0: number, z1: number, mode: Shape['mode'] = 'solid') => S('cylinder', [d, d, z1 - z0], [x, y, (z0 + z1) / 2], mode);
// applied after the cavity is cut, so it survives it
const late = (s: Shape): Shape => ({ ...s, id: LATE + s.id });
const shift = (shapes: Shape[], dx: number, dy: number) => shapes.map((s) => ({ ...s, position: { ...s.position, x: s.position.x + dx, y: s.position.y + dy } }));
const r1 = (v: number) => String(Math.round(v * 10) / 10);

// ---------- enclosure family ----------

type Standoff = { x: number; y: number };
type Encl = {
  L: number; W: number; H: number; wall: number; lid: 'none' | 'slip' | 'screw';
  sideVents: number; lidVents: number; slot: boolean; standoffs: Standoff[]; standoffH: number;
};

const SCREW_POST = 3; // post centre is this far in from the inner wall
function enclosure(o: Encl) {
  const { L, W, H, wall: w } = o;
  const OL = L + 2 * w, OW = W + 2 * w, OH = H + w;
  const off = o.lid === 'none' ? 0 : OL / 2 + 4;
  const bx = -off, lx = off;
  const sh: Shape[] = [
    box([OL, OW, OH], [bx, 0, OH / 2]),
    box([L, W, H + 1], [bx, 0, w + (H + 1) / 2], 'hole'), // open top
  ];
  let holes = 0;
  const px = L / 2 - SCREW_POST, py = W / 2 - SCREW_POST;
  const corners: [number, number][] = [[-px, -py], [px, -py], [-px, py], [px, py]];
  if (o.lid === 'screw') {
    const pilot = Math.min(10, H - 3);
    for (const [x, y] of corners) {
      sh.push(late(cyl(7, bx + x, y, w - 0.5, w + H)));
      sh.push(late(cyl(2.5, bx + x, y, w + H - pilot, w + H + 1, 'hole'))); // blind pilot hole for an M3 screw
    }
  }
  const standoffTop = w + o.standoffH;
  for (const s of o.standoffs) {
    sh.push(late(cyl(6, bx + s.x, s.y, w - 0.5, standoffTop)));
    sh.push(late(cyl(2.2, bx + s.x, s.y, standoffTop - 3, standoffTop + 1, 'hole'))); // blind pilot hole for an M2.5 screw
  }
  if (o.sideVents > 0) {
    const vh = Math.min(12, H - 6);
    for (let i = 0; i < o.sideVents; i++) {
      const x = (i - (o.sideVents - 1) / 2) * 8;
      sh.push(box([3, OW + 2, vh], [bx + x, 0, w + H / 2], 'hole')); // through both long walls
    }
    holes += 2 * o.sideVents;
  }
  if (o.slot) {
    sh.push(box([54, w + 2, 9], [bx, W / 2 + w / 2, w + o.standoffH + 1 + 4.5], 'hole'));
    holes += 1;
  }
  if (o.lid !== 'none') {
    sh.push(box([OL, OW, w], [lx, 0, w / 2]));
    sh.push(box([L - 0.6, W - 0.6, 3], [lx, 0, w + 1])); // solid lip that plugs into the opening (overlaps the plate, so no flush faces)
    if (o.lid === 'screw') {
      for (const [x, y] of corners) sh.push(cyl(3.4, lx + x, y, -1, w + 3, 'hole'));
      holes += 4;
    }
    for (let i = 0; i < o.lidVents; i++) {
      sh.push(box([2.5, W - 10, w + 5], [lx + (i - (o.lidVents - 1) / 2) * 6, 0, (w + 3) / 2], 'hole'));
    }
    holes += o.lidVents;
  }
  return { shapes: sh, holes, parts: o.lid === 'none' ? 1 : 2 };
}

const LID_TEXT = { none: 'no lid', slip: 'a slip-fit lid', screw: 'a screw lid with 4 M3 pilot holes and 4 clearance holes' };

function enclosureBox(c: Cfg): Built {
  const L = c.l as number, W = c.w as number, H = c.h as number, wall = c.wall as number;
  const lid = c.lid as 'slip' | 'screw';
  const sideVents = c.vents ? Math.min(10, Math.max(1, Math.floor((L - 20) / 8))) : 0;
  const e = enclosure({ L, W, H, wall, lid, sideVents, lidVents: 0, slot: false, standoffs: [], standoffH: 0 });
  const vents = sideVents ? ` ${sideVents * 2} vent slots (${sideVents} in each long side).` : ' No vents.';
  return { ...e, description: `A box for ${r1(L)} × ${r1(W)} × ${r1(H)} mm of inside space with ${r1(wall)} mm walls and ${LID_TEXT[lid]}.${vents} Box and lid print side by side.` };
}

const BOARDS = {
  pi4: { name: 'Raspberry Pi 4 / 5', l: 85, w: 56, holes: [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], clear: 14 },
  zero: { name: 'Raspberry Pi Zero', l: 65, w: 30, holes: [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]], clear: 14 },
  uno: { name: 'Arduino Uno', l: 68.6, w: 53.3, holes: [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]], clear: 14 },
} as const;

function boardCase(c: Cfg): Built {
  const b = BOARDS[c.board as keyof typeof BOARDS];
  const wall = c.wall as number;
  const lid = !!c.lid;
  const slot = !!c.slot;
  const lidVents = lid && c.vents ? 5 : 0;
  const standoffH = 4;
  const e = enclosure({
    L: b.l + 1, W: b.w + 1, H: standoffH + b.clear, wall, lid: lid ? 'slip' : 'none', sideVents: 0, lidVents, slot,
    standoffs: b.holes.map(([x, y]) => ({ x: x - b.l / 2, y: y - b.w / 2 })), standoffH,
  });
  const bits = [`${b.name} board (${b.l} × ${b.w} mm) on 4 standoffs with pilot holes`, lid ? 'a slip-fit lid' : 'no lid'];
  if (slot) bits.push('a 54 mm slot in one long wall for header access');
  if (lidVents) bits.push('5 vent slots in the lid');
  return { ...e, description: `A case for the ${b.name}: ${bits.join(', ')}. Hole positions follow the published board drawing; check your board before ordering.${lid ? ' Case and lid print side by side.' : ''}` };
}

// ---------- phone stand ----------

function phoneStand(c: Cfg): Built {
  const t = c.t as number, ang = c.angle as number, W = c.width as number;
  const th = (ang * Math.PI) / 180, sn = Math.sin(th), cs = Math.cos(th);
  const Ls = 70, g = t / sn + 1;
  const dirY = -cs, dirZ = sn; // slab runs back and up
  const slabW = W - 4;
  const cy = -2.5 * sn + (Ls / 2) * dirY, cz = 5 - 2.5 * cs + (Ls / 2) * dirZ;
  const yB = -5 * sn - Ls * cs - 2, yF = g + 6;
  const sh: Shape[] = [
    box([W, yF - yB, 5], [0, (yB + yF) / 2, 2.5]),
    S('box', [slabW, 5, Ls], [0, cy, cz], 'solid', [90 - ang, 0, 0]),
    box([slabW, 5, 12], [0, g + 2.5, 8.5]),
  ];
  let holes = 0;
  const hd = Math.min(10, g - 2);
  if (c.cable) {
    sh.push(cyl(hd, 0, g / 2, -1, 6, 'hole'));
    holes = 1;
  }
  return {
    shapes: shift(sh, 0, -(yB + yF) / 2), holes, parts: 1,
    description: `A phone stand for a phone ${r1(t)} mm thick (with case) held at ${r1(ang)} degrees, on a base ${r1(W)} mm wide with a front lip.${c.cable ? ` A ${r1(hd)} mm hole in the base lets a charging cable through.` : ' No cable hole.'}`,
  };
}

// ---------- cable clip ----------

function cableClip(c: Cfg): Built {
  const d = c.d as number, k = c.slots as number, screw = c.mount === 'screw';
  const cav = d + 0.4, od = cav + 6, pitch = od + 2;
  const len = k * pitch + (screw ? 14 : 4);
  const sh: Shape[] = [box([len, od + 4, 3], [0, 0, 1.5])];
  for (let i = 0; i < k; i++) {
    const x = (i - (k - 1) / 2) * pitch;
    sh.push(cyl(od, x, 0, 1, 10)); // starts inside the pad, so no flush bottoms
  }
  for (let i = 0; i < k; i++) {
    const x = (i - (k - 1) / 2) * pitch;
    sh.push(cyl(cav, x, 0, -1, 11, 'hole'));
    sh.push(box([0.7 * d, od / 2 + 3, 14], [x, -(od / 2 + 3) / 2, 5.5], 'hole')); // opening towards -Y, runs out past the pad edge
  }
  let holes = 0;
  if (screw) {
    for (const s of [-1, 1]) sh.push(cyl(3.5, s * (len / 2 - 5), 0, -1, 4, 'hole'));
    holes = 2;
  }
  return {
    shapes: sh, holes, parts: 1,
    description: `${k} open clip${k > 1 ? 's' : ''} for a ${r1(d)} mm cable on one ${r1(len)} mm pad; the cable presses in through a ${r1(0.7 * d)} mm slot. ${screw ? 'Two 3.5 mm holes for screws (no countersink).' : 'Flat underside for an adhesive pad.'}`,
  };
}

// ---------- name plate ----------

function namePlate(c: Cfg): Built {
  const L = c.l as number, W = c.w as number, t = c.t as number, mode = c.holes as string;
  const sh: Shape[] = [box([L, W, t], [0, 0, t / 2])];
  let holes = 0;
  if (mode === 'ring') {
    sh.push(cyl(4.5, -L / 2 + 7, 0, -1, t + 1, 'hole'));
    holes = 1;
  } else if (mode === 'screw') {
    for (const s of [-1, 1]) sh.push(cyl(3.5, s * (L / 2 - 6), 0, -1, t + 1, 'hole'));
    holes = 2;
  }
  const what = mode === 'ring' ? 'one 4.5 mm key-ring hole' : mode === 'screw' ? 'two 3.5 mm screw holes' : 'no holes';
  return {
    shapes: sh, holes, parts: 1,
    description: `A plain ${r1(L)} × ${r1(W)} × ${r1(t)} mm plate with ${what}. Text is not part of this model: put the wording in your order notes and we will confirm how it is added.`,
  };
}

// ---------- spacer set ----------

const SCREW_HOLE: Record<string, number> = { M2: 2.4, 'M2.5': 2.9, M3: 3.4, M4: 4.5 };

function spacerSet(c: Cfg): Built {
  const screw = c.screw as string, len = c.len as number, count = c.count as number;
  const hd = SCREW_HOLE[screw];
  const od = Math.max(c.od as number, hd + 2); // never thinner than 1 mm wall
  const pitch = od + 3, cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
  const sh: Shape[] = [];
  for (let i = 0; i < count; i++) {
    const x = ((i % cols) - (cols - 1) / 2) * pitch, y = (Math.floor(i / cols) - (rows - 1) / 2) * pitch;
    sh.push(cyl(od, x, y, 0, len));
  }
  for (let i = 0; i < count; i++) {
    const x = ((i % cols) - (cols - 1) / 2) * pitch, y = (Math.floor(i / cols) - (rows - 1) / 2) * pitch;
    sh.push(cyl(hd, x, y, -1, len + 1, 'hole'));
  }
  return {
    shapes: sh, holes: count, parts: count,
    description: `${count} round spacer${count > 1 ? 's' : ''}, ${r1(od)} mm outside diameter and ${r1(len)} mm long, each with a ${r1(hd)} mm clearance hole for ${screw} screws.${od > (c.od as number) ? ` Outside diameter raised to ${r1(od)} mm so the wall is at least 1 mm.` : ''}`,
  };
}

// ---------- motor mount ----------

const CRADLES = { n20: { name: 'N20', bw: 12.4, bh: 10.4, len: 25 }, tt: { name: 'TT', bw: 22.8, bh: 19.2, len: 30 } } as const;

function motorMount(c: Cfg): Built {
  const m = c.motor as string, base = c.base as number;
  if (m === 'n20' || m === 'tt') {
    const k = CRADLES[m];
    const ow = k.bw + 6, fw = ow + 28, wallH = base + k.bh * 0.75;
    const sh: Shape[] = [
      box([fw, k.len + 4, base], [0, 0, base / 2]),
      box([ow, k.len, wallH], [0, 0, wallH / 2]),
      box([k.bw, k.len + 8, k.bh + 1], [0, 0, base + (k.bh + 1) / 2], 'hole'), // open-top channel
    ];
    for (const s of [-1, 1]) sh.push(cyl(3.4, s * (ow / 2 + 7), 0, -1, base + 1, 'hole'));
    return {
      shapes: sh, holes: 2, parts: 1,
      description: `An open-top cradle for a ${k.name} gear motor (channel ${k.bw} × ${k.bh} mm, ${k.len} mm long) on a base ${r1(base)} mm thick with two 3.4 mm screw holes. Channel size is for a typical ${k.name} motor body: measure yours first. Strap or glue the motor in; there is no clip.`,
    };
  }
  const py = m === '16x16' ? 16 : 19;
  const sh: Shape[] = [box([58, py + 10, base], [0, 0, base / 2])];
  const pat: [number, number][] = [[-8, -py / 2], [8, -py / 2], [-8, py / 2], [8, py / 2]];
  for (const [x, y] of pat) sh.push(cyl(3.4, x, y, -1, base + 1, 'hole'));
  sh.push(cyl(8, 0, 0, -1, base + 1, 'hole'));
  for (const s of [-1, 1]) sh.push(cyl(3.4, s * 22, 0, -1, base + 1, 'hole'));
  return {
    shapes: sh, holes: 7, parts: 1,
    description: `A flat plate ${r1(base)} mm thick with the 16 × ${py} mm four-hole M3 pattern (3.4 mm holes), an 8 mm centre opening and two 3.4 mm base screw holes. It is a plate only, not an arm or a frame.`,
  };
}

// ---------- wheel ----------

function wheel(c: Cfg): Built {
  const D = c.d as number, W = c.width as number, tt = c.shaft === 'tt';
  const bore = tt ? 5.5 : 3.1;
  const hubR = bore / 2 + 3, rimOuter = D / 2 - 2;
  const want = Number(c.light);
  const rc = (hubR + rimOuter) / 2;
  const ld = want > 0 ? Math.min(0.7 * (rimOuter - hubR), 0.8 * 2 * rc * Math.sin(Math.PI / want)) : 0; // fits between hub and rim, and between neighbours
  const nl = ld >= 3 ? want : 0;
  const sh: Shape[] = [cyl(D, 0, 0, 0, W), cyl(bore, 0, 0, -1, W + 1, 'hole')];
  for (let i = 0; i < nl; i++) {
    const a = ((i + 0.5) / nl) * 2 * Math.PI; // offset, so no hole sits exactly on an axis
    sh.push(cyl(ld, rc * Math.cos(a), rc * Math.sin(a), -1, W + 1, 'hole'));
  }
  return {
    shapes: sh, holes: 1 + nl, parts: 1,
    description: `A ${r1(D)} mm wheel, ${r1(W)} mm wide, with a plain round ${bore} mm bore for a ${tt ? 'TT (5.4 mm)' : 'N20 (3 mm)'} shaft. The bore has no D flat, so fix the wheel with a set screw or adhesive. ${nl ? `${nl} lightening holes of ${r1(ld)} mm.` : 'No lightening holes.'}`,
  };
}

// ---------- grid storage bin ----------

const UNIT = 42, HU = 7, FOOT = 2.4, FLOOR = 1.2, DROP = 3; // dividers and tab stay DROP mm below the rim so a stacked foot clears them
const FOOTW = UNIT - 5.5; // 0.5 mm per side inside the opening of a bin with the thickest (2 mm) wall

function gridBin(c: Cfg): Built {
  const ux = c.ux as number, uy = c.uy as number, hu = c.hu as number, w = c.wall as number, nd = c.div as number, tab = !!c.label;
  const OX = ux * UNIT - 0.5, OY = uy * UNIT - 0.5, H = hu * HU, IX = OX - 2 * w, IY = OY - 2 * w, floorZ = FOOT + FLOOR;
  const sh: Shape[] = [box([OX, OY, H - FOOT], [0, 0, (FOOT + H) / 2])];
  for (let i = 0; i < ux; i++) for (let j = 0; j < uy; j++) {
    sh.push(box([FOOTW, FOOTW, FOOT + 0.5], [(i - (ux - 1) / 2) * UNIT, (j - (uy - 1) / 2) * UNIT, (FOOT + 0.5) / 2])); // stepped foot, overlaps the floor
  }
  sh.push(box([IX, IY, H + 1 - floorZ], [0, 0, (floorZ + H + 1) / 2], 'hole'));
  const top = H - DROP;
  for (let i = 1; i <= nd; i++) sh.push(late(box([w, IY + 1, top - floorZ + 0.5], [-IX / 2 + (IX * i) / (nd + 1), 0, (floorZ - 0.5 + top) / 2])));
  if (tab) sh.push(late(box([IX + 1, 8.5, 1.2], [0, -IY / 2 + 3.75, top - 0.6])));
  return {
    shapes: sh, holes: 0, parts: 1,
    description: `A storage bin ${ux} × ${uy} units (${r1(OX)} × ${r1(OY)} mm, 42 mm per unit), ${hu} units tall (${H} mm, 7 mm per unit) with ${r1(w)} mm walls and a ${FLOOR} mm floor. Each unit has a plain stepped foot (${r1(FOOTW)} mm square, ${FOOT} mm deep) that drops into the opening of the bin below. ${nd ? `${nd} divider${nd > 1 ? 's' : ''} across the X length, ${nd + 1} compartments. ` : 'No dividers. '}${tab ? 'An 8 mm deep label tab along the inside of the front wall. ' : 'No label tab. '}Dividers and tab sit ${DROP} mm below the rim so a stacked bin clears them. This is not the certified Gridfinity profile (no magnet pockets or interlock chamfers): check fit on your baseplate.`,
  };
}

// ---------- drone camera mount ----------

function droneMount(c: Cfg): Built {
  const cam = Number(c.cam), tilt = c.tilt as number, s = Number(c.pattern), sw = c.strap as number;
  const th = (tilt * Math.PI) / 180, sn = Math.sin(th), cs = Math.cos(th);
  const T = 3, G = 3, d = cam + 6, h = cam + 4; // plate and cheek thickness, strap slot depth, cheek length (Y) and height (Z)
  const hy = (h / 2) * sn + (d / 2) * cs;
  const cx = cam / 2 + 0.2 + T / 2, X = Math.max(s + 9, 2 * (cx + T / 2) + 8, sw + 10);
  const cy = s / 2 + 1.6 + 3 + hy, zc = (h / 2) * cs + (d / 2) * sn + 1;
  const yr = -(s / 2 + 1.6 + 3 + G / 2), yf = cy + hy + 3 + G / 2;
  const y0 = yr - G / 2 - 3, y1 = yf + G / 2 + 3;
  const sh: Shape[] = [box([X, y1 - y0, T], [0, (y0 + y1) / 2, T / 2])];
  for (const k of [-1, 1]) sh.push(S('box', [T, d, h], [k * cx, cy, zc], 'solid', [tilt, 0, 0]));
  // A tilted cheek touches the plate only at its lowest corner; fill the wedge under its bottom edge so it is bonded along its length.
  const ya = cy - (d / 2) * cs + (h / 2) * sn + 0.5, yb = cy + (d / 2) * cs + (h / 2) * sn - 0.5, zt = 1 + d * sn - 0.5;
  if (zt > T + 0.5) for (const k of [-1, 1]) sh.push(box([T - 0.4, yb - ya, zt - 1.5], [k * cx, (ya + yb) / 2, (1.5 + zt) / 2]));
  for (const x of [-s / 2, s / 2]) for (const y of [-s / 2, s / 2]) sh.push(cyl(3.2, x, y, -1, T + 1, 'hole'));
  for (const y of [yr, yf]) sh.push(box([sw, G, T + 2], [0, y, T / 2], 'hole'));
  for (const k of [-1, 1]) sh.push(S('cylinder', [2.2, 2.2, T + 1.4], [k * cx, cy, zc], 'hole', [0, 90, 0]));
  return {
    shapes: sh, holes: 8, parts: 1,
    description: `A camera mount for a ${cam} mm wide camera (typical size: check your camera) tilted ${r1(tilt)} degrees, on a ${r1(X)} mm wide base plate with 4 M3 holes (3.2 mm) on a ${s} × ${s} mm pattern, 2 strap slots ${sw} mm wide and ${G} mm deep, and a 2.2 mm cross hole through each of the 2 cheeks for a retaining screw. Suggested material: TPU.`,
  };
}

// ---------- drone / RC / robotics additions ----------
// Sizes marked "typical" are common published values for each class of part, not a spec for one product: the descriptions say so.

const hcylY = (d: number, x: number, y: number, z: number, len: number) => S('cylinder', [d, d, len], [x, y, z], 'hole', [90, 0, 0]); // hole along Y
const rotZ = (size: V, pos: V, deg: number, mode: Shape['mode'] = 'solid') => S('box', size, pos, mode, [0, 0, deg]);

// ---- GPS puck mount ----
function gpsMount(c: Cfg): Built {
  const s = Number(c.pattern), puck = c.puck as number, tube = Number(c.tube), tilt = !!c.tilt;
  const T = 3, MAST = 14, PZ = 24, PT = tilt ? 7 : 3, P = puck + 12; // base thickness, mast width, platform centre height, platform thickness (thick enough that the mast top stays inside it when tilted) and side
  const X = s + 8;
  const sh: Shape[] = [
    box([X, X, T], [0, 0, T / 2]),
    box([MAST, MAST, tilt ? PZ : PZ - 1], [0, 0, (tilt ? PZ : PZ - 1) / 2]),
    S('box', [P, P, PT], [0, 0, PZ], 'solid', [tilt ? 15 : 0, 0, 0]),
  ];
  let holes = 0;
  for (const x of [-s / 2, s / 2]) for (const y of [-s / 2, s / 2]) { sh.push(cyl(3.2, x, y, -1, T + 1, 'hole')); holes++; }
  for (const k of [-1, 1]) { sh.push(box([3, 10, 14], [k * (puck / 2 + 3.5), 0, PZ], 'hole')); holes++; }
  if (tube > 0) { sh.push(cyl(tube, 0, 0, -1, PZ + 12, 'hole')); holes++; }
  return {
    shapes: sh, holes, parts: 1,
    description: `A GPS puck mount: a ${r1(X)} mm square base with 4 M3 holes (3.2 mm) on a ${s} × ${s} mm stack pattern, a ${MAST} mm square mast and a ${r1(P)} mm square platform for a GPS puck about ${r1(puck)} mm across (typical size: measure yours)${tilt ? ', tilted 15 degrees' : ', level'}. Two 3 × 10 mm slots through the platform take a zip tie. ${tube > 0 ? `A ${tube} mm hole runs down the middle for an antenna tube or cable.` : 'No antenna tube hole.'} Smaller stacks often use M2: check your stack. Suggested material: PETG.`,
  };
}

// ---- landing gear ----
function landingGear(c: Cfg): Built {
  const H = c.height as number, foot = c.foot as number, pad = c.pad as number;
  const post = Math.min(pad, foot), pitch = Math.max(pad, foot) + 10;
  const sh: Shape[] = [];
  for (const k of [-1, 1]) {
    const y = k * pitch / 2;
    sh.push(box([60, foot, 4], [0, y, 2]), box([8, post, H], [0, y, H / 2]), box([30, pad, 4], [0, y, H - 2]));
  }
  for (const k of [-1, 1]) for (const x of [-10, 10]) sh.push(cyl(3.2, x, k * pitch / 2, H - 5, H + 1, 'hole'));
  return {
    shapes: sh, holes: 4, parts: 2,
    description: `A pair of skid legs, each ${r1(H)} mm tall with a 60 mm long, ${r1(foot)} mm wide foot skid and a 30 × ${r1(pad)} mm pad on top with 2 M3 bolt holes (3.2 mm, 20 mm apart) to bolt under an arm or plate. Pad and bolt spacing are typical: check your frame. Suggested material: TPU (PETG for a stiffer gear).`,
  };
}

// ---- prop guard ----
const PROP_CLEAR = 3; // mm of clearance between the prop tip and the ring wall
function propGuard(c: Cfg): Built {
  const inch = Number(c.prop), H = c.height as number, sp = Number(c.motor);
  const WALL = 2, HUB_T = 3;
  const ringIn = (inch * 25.4) / 2 + PROP_CLEAR, ringOut = ringIn + WALL;
  const hubR = (sp * Math.SQRT2) / 2 + 4.5;
  const sh: Shape[] = [cyl(2 * ringOut, 0, 0, 0, H), cyl(2 * ringIn, 0, 0, -1, H + 1, 'hole')];
  for (let i = 0; i < 4; i++) {
    const a = ((45 + 90 * i) * Math.PI) / 180, r = ringOut + 3;
    sh.push(rotZ([14, 12, 3], [r * Math.cos(a), r * Math.sin(a), 1.5], 45 + 90 * i));
    sh.push(cyl(3.2, (ringOut + 6.5) * Math.cos(a), (ringOut + 6.5) * Math.sin(a), -1, 4, 'hole'));
  }
  sh.push(late(cyl(2 * hubR, 0, 0, 0, HUB_T)));
  for (let i = 0; i < 4; i++) {
    const a = (90 * i * Math.PI) / 180, len = ringIn - hubR + 2, r = (hubR + ringIn) / 2;
    sh.push(late(rotZ([len, 4, HUB_T], [r * Math.cos(a), r * Math.sin(a), HUB_T / 2], 90 * i)));
  }
  const hd = sp === 12 ? 2.2 : 3.2;
  sh.push(late(cyl(6, 0, 0, -1, HUB_T + 1, 'hole')));
  for (const x of [-sp / 2, sp / 2]) for (const y of [-sp / 2, sp / 2]) sh.push(late(cyl(hd, x, y, -1, HUB_T + 1, 'hole')));
  return {
    shapes: sh, holes: 13, parts: 1,
    description: `A ring guard for one ${inch} inch propeller: ${r1(2 * ringIn)} mm inside diameter (${PROP_CLEAR} mm clearance at the blade tips for a nominal ${inch} inch prop), ${WALL} mm wall, ${r1(H)} mm tall. It is held by 4 spokes to a ${HUB_T} mm motor plate with a 6 mm centre hole and 4 holes (${hd} mm) on a ${sp} × ${sp} mm pattern (typical for ${sp === 12 ? 'M2' : 'M3'} motors: check your motor), and has 4 outer tabs with a 3.2 mm hole each for bolting to an arm. Print one per motor. Suggested material: TPU.`,
  };
}

// ---- 3 inch FPV frame ----
export const FRAME_PLATE = { x: 52, y: 38 }; // centre plate, mm: 20 x 20 stack holes inside, strap slots at x +-21
const FRAME_GAP = 3; // mm of air kept between neighbouring prop tips when we state the largest prop
function fpvFrame(c: Cfg): Built {
  const diag = c.diag as number, T = c.t as number, sp = Number(c.motor);
  const m = frameMotorXY(diag), R = diag / 2, PAD = 24, ARM = 10, SHAFT = 6, BOLT = 2.2;
  const sh: Shape[] = [box([FRAME_PLATE.x, FRAME_PLATE.y, T], [0, 0, T / 2])];
  const quad: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [sx, sy] of quad) {
    // each arm starts inside the plate (not at the middle: four arms crossing there leave the CSG kernel an open edge)
    const a0 = 12, mid = (a0 + R) / 2 / Math.SQRT2;
    sh.push(rotZ([R - a0, ARM, T], [sx * mid, sy * mid, T / 2], sx * sy > 0 ? 45 : -45), cyl(PAD, sx * m, sy * m, 0, T));
  }
  let holes = 0;
  for (const [sx, sy] of quad) {
    sh.push(cyl(SHAFT, sx * m, sy * m, -1, T + 1, 'hole')); holes++;
    for (const dx of [-sp / 2, sp / 2]) for (const dy of [-sp / 2, sp / 2]) { sh.push(cyl(BOLT, sx * m + dx, sy * m + dy, -1, T + 1, 'hole')); holes++; }
  }
  for (const x of [-10, 10]) for (const y of [-10, 10]) { sh.push(cyl(BOLT, x, y, -1, T + 1, 'hole')); holes++; } // 20 x 20 stack, M2
  for (const x of [-21, 21]) { sh.push(box([3, 16, T + 2], [x, 0, T / 2], 'hole')); holes++; } // strap slots
  const gap = diag / Math.SQRT2, maxProp = gap - FRAME_GAP;
  return {
    shapes: sh, holes, parts: 1,
    description: `A one-piece true-X 3 inch quad frame, ${r1(diag)} mm motor to motor on the diagonal, ${r1(T)} mm thick. Four ${ARM} mm wide arms meet in a ${FRAME_PLATE.x} × ${FRAME_PLATE.y} mm centre plate with 4 M2 holes (${BOLT} mm) on a 20 × 20 mm stack pattern and 2 strap slots (3 × 16 mm, 42 mm apart). Each arm ends in a ${PAD} mm motor pad with a ${SHAFT} mm shaft hole and 4 M2 holes (${BOLT} mm) on a ${sp} × ${sp} mm pattern (typical: check your motors). Adjacent motors are ${r1(gap)} mm apart, so props up to ${r1(maxProp)} mm across (${r1(maxProp / 25.4)} inch) keep ${FRAME_GAP} mm between tips; a 3 inch prop is 76.2 mm. Suggested material: PETG.`,
  };
}

// ---- RC bumper ----
function rcBumper(c: Cfg): Built {
  const W = c.width as number, sp = c.spacing as number, t = c.t as number;
  const D = 44, CW = 10, CH = 18, PITCH = 16;
  const n = Math.floor((W - 2 * 12 - CW) / PITCH) + 1; // windows stay 12 mm clear of each end
  const sh: Shape[] = [box([W, D, t], [0, 0, t / 2])];
  // cutouts first, mounting holes last: the CSG kernel left an open edge when small round holes came first
  for (let i = 0; i < n; i++) sh.push(box([CW, CH, t + 2], [(i - (n - 1) / 2) * PITCH, 4, t / 2], 'hole'));
  for (const x of [-sp / 2, sp / 2]) sh.push(cyl(3.2, x, -16, -1, t + 1, 'hole'));
  return {
    shapes: sh, holes: 2 + n, parts: 1,
    description: `A flat front bumper plate ${r1(W)} × ${D} × ${r1(t)} mm with 2 M3 mounting holes (3.2 mm) ${r1(sp)} mm apart and a row of ${n} rectangular ${CW} × ${CH} mm cutouts for less weight and some give. Hole spacing is yours to match: measure your chassis. Suggested material: TPU.`,
  };
}

// ---- battery tray ----
function batteryTray(c: Cfg): Built {
  const L = c.l as number, W = c.w as number, H = c.h as number, sw = c.strap as number;
  const w = 2, F = 12, T = 3;
  const two = L >= 2 * (sw + 5);
  const OL = L + 2 * w, OW = W + 2 * w;
  const sh: Shape[] = [
    box([OL, OW, H + T], [0, 0, (H + T) / 2]),
    box([OL, OW + 2 * F, T], [0, 0, T / 2]),
    box([L, W, H + 1], [0, 0, T + (H + 1) / 2], 'hole'),
    box([14, w + 2, H * 0.6 + 1], [0, W / 2 + w / 2, H + T - (H * 0.6) / 2 + 0.5], 'hole'), // lead notch open at the top: not a through hole
  ];
  const xs = two ? [-L / 4, L / 4] : [0];
  let holes = 0;
  for (const x of xs) for (const k of [-1, 1]) { sh.push(box([sw + 1, 3, T + 2], [x, k * (OW / 2 + F / 2), T / 2], 'hole')); holes++; }
  return {
    shapes: sh, holes, parts: 1,
    description: `A tray for a battery up to ${r1(L)} × ${r1(W)} × ${r1(H)} mm (inside size) with 2 mm walls, a 3 mm floor and a 14 mm lead notch in one long wall. ${xs.length} strap${xs.length > 1 ? 's' : ''} ${r1(sw)} mm wide: each goes down one ${r1(sw + 1)} × 3 mm slot in the side flange, under the tray and up the other (${holes} slots). Suggested material: PETG.`,
  };
}

// ---- servo bracket ----
const SERVOS = {
  sg90: { name: 'SG90 / MG90 class', bl: 23, bw: 12.5, span: 28, hd: 2.2 },
  mg995: { name: 'MG995 / MG996 class', bl: 40.5, bw: 20, span: 49.5, hd: 4.2 },
} as const;
function servoBracket(c: Cfg): Built {
  const k = SERVOS[c.servo as keyof typeof SERVOS], t = c.t as number;
  const Lp = k.span + 16, D = 26, winX = k.bl + 0.6, winZ = k.bw + 0.6, zc = t + 6 + winZ / 2, Hw = t + 12 + winZ, wy = -D / 2 + t / 2;
  const sh: Shape[] = [box([Lp, D, t], [0, 0, t / 2]), box([Lp, t, Hw], [0, wy, Hw / 2])];
  sh.push(box([winX, t + 2, winZ], [0, wy, zc], 'hole'));
  for (const x of [-k.span / 2, k.span / 2]) sh.push(hcylY(k.hd, x, wy, zc, t + 2));
  for (const x of [-(Lp / 2 - 5), Lp / 2 - 5]) for (const y of [-1, 8]) sh.push(cyl(3.2, x, y, -1, t + 1, 'hole'));
  return {
    shapes: sh, holes: 7, parts: 1,
    description: `An L bracket for a ${k.name} servo (typical body ${k.bl} × ${k.bw} mm, ears ${k.span} mm between hole centres, ${k.hd} mm ear holes: measure your servo). The servo drops through a ${r1(winX)} × ${r1(winZ)} mm window in a ${r1(t)} mm upright wall and bolts through 2 ear holes; the base has 4 M3 holes (3.2 mm). Suggested material: PETG.`,
  };
}

// ---- robot chassis ----
function robotChassis(c: Cfg): Built {
  const four = c.drive === '4wd', L = c.l as number, W = c.w as number, T = 3;
  const sh: Shape[] = [box([L, W, T], [0, 0, T / 2])];
  const mx = four ? [-(L / 2 - 25), L / 2 - 25] : [-(L / 2 - 25)];
  // ponytail: a plate with more than ~10 round holes often leaves an open edge in the CSG kernel, so the motor positions are slots
  // (boxes cut reliably, and first) and the board grid is two rows, not a full grid
  let holes = 0;
  for (const x of mx) for (const k of [-1, 1]) { sh.push(box([23.2, 3.2, T + 2], [x, k * (W / 2 - 8), T / 2], 'hole')); holes++; }
  const nx = Math.min(4, Math.floor((L - 90) / 30) + 1);
  for (let i = 0; i < nx; i++) for (const k of [-1, 1]) { sh.push(cyl(3.2, (i - (nx - 1) / 2) * 30, k * 15, -1, T + 1, 'hole')); holes++; }
  if (!four) { sh.push(cyl(4.2, L / 2 - 15, 0, -1, T + 1, 'hole')); holes++; }
  return {
    shapes: sh, holes, parts: 1,
    description: `A ${r1(L)} × ${r1(W)} × ${T} mm ${four ? '4WD' : '2WD'} chassis plate. ${mx.length * 2} TT motor positions, each a 3.2 × 23.2 mm slot (it covers a typical 2-hole bracket pattern about 20 mm apart: check your motor bracket), ${four ? 'at the front and rear on both sides' : 'on both sides at the rear'}. ${four ? 'No caster hole.' : 'One 4.2 mm caster hole at the front.'} Two rows of ${nx} M3 holes (3.2 mm) at 30 mm pitch in the middle take boards and standoffs. Suggested material: PETG.`,
  };
}

// ---- gripper ----
function gripper(c: Cfg): Built {
  const open = c.open as number, len = c.len as number;
  const Bw = open + 26, Bd = 40, T = 5, JT = 4;
  const sh: Shape[] = [box([Bw, Bd, T], [0, 0, T / 2])];
  sh.push(box([23.6, 13.1, T + 2], [0, 6, T / 2], 'hole'));
  for (const x of [-14, 14]) sh.push(cyl(2.2, x, 6, -1, T + 1, 'hole'));
  for (const x of [-open / 2, open / 2]) sh.push(cyl(3.2, x, -12, -1, T + 1, 'hole'));
  for (const x of [-(Bw / 2 - 5), Bw / 2 - 5]) sh.push(cyl(3.2, x, 13, -1, T + 1, 'hole'));
  const jy = Bd / 2 + 6 + len / 2, pv = jy - len / 2 + 6;
  for (const k of [-1, 1]) {
    const x = k * 14;
    sh.push(box([10, len, JT], [x, jy, JT / 2]), box([5, len / 2, 14], [x - k * 5.5, jy + len / 4, 7]));
    sh.push(cyl(3.2, x, pv, -1, JT + 1, 'hole'), cyl(2.2, x, pv + 12, -1, JT + 1, 'hole'));
  }
  return {
    shapes: sh, holes: 11, parts: 3,
    description: `A gripper in 3 flat pieces: a ${r1(Bw)} × ${Bd} × ${T} mm base and 2 jaws, each ${r1(len)} mm long. The base has a 23.6 × 13.1 mm servo window with 2 ear holes (2.2 mm, 28 mm apart: sized for a typical SG90-class servo, measure yours), 2 M3 pivot holes (3.2 mm) ${r1(open)} mm apart and 2 M3 mounting holes. Each jaw has an M3 pivot hole, a 2.2 mm linkage hole and a 14 mm tall finger. The servo horn and linkage are not printed. Prints without supports.`,
  };
}

// ---- wheel hub ----
function wheelHub(c: Cfg): Built {
  const drive = c.drive as string, od = c.od as number, n = c.spokes as number, bore = c.bore as number;
  const W = 10, RIM = 4;
  const hex = drive === 'hex12' ? 12 : drive === 'hex17' ? 17 : 0;
  const F = hex + 0.3, s = F / Math.sqrt(3);
  const boss = hex ? (hex === 12 ? 24 : 30) : Math.max(bore + 10, 16);
  const rimIn = od / 2 - RIM;
  const sh: Shape[] = [cyl(od, 0, 0, 0, W), cyl(2 * rimIn, 0, 0, -1, W + 1, 'hole'), late(cyl(boss, 0, 0, 0, W))];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * 2 * Math.PI, r = (boss / 2 + rimIn) / 2, len = rimIn - boss / 2 + 2;
    sh.push(late(rotZ([len, 5, W - 2], [r * Math.cos(a), r * Math.sin(a), W / 2], ((i + 0.5) / n) * 360)));
  }
  if (hex) for (const a of [0, 60, 120]) sh.push(late(S('box', [s, F, W + 2], [0, 0, W / 2], 'hole', [0, 0, a])));
  else sh.push(late(cyl(bore, 0, 0, -1, W + 1, 'hole')));
  return {
    shapes: sh, holes: n + 1, parts: 1,
    description: `A wheel hub ${r1(od)} mm across and ${W} mm wide: a ${RIM} mm rim ring joined by ${n} spokes to a ${boss} mm centre boss. ${hex ? `The centre has a ${r1(F)} mm across-flats hex hole for a ${hex} mm hex drive (typical RC size; 0.3 mm clearance: check yours).` : `The centre has a plain round ${r1(bore)} mm bore.`} No tyre or set screw is modelled. Suggested material: PETG.`,
  };
}

const BUILDERS: Record<string, (c: Cfg) => Built> = {
  'enclosure-box': enclosureBox,
  'board-case': boardCase,
  'phone-stand-pro': phoneStand,
  'cable-clip-pro': cableClip,
  'name-plate': namePlate,
  'spacer-set': spacerSet,
  'motor-mount': motorMount,
  'motor-wheel': wheel,
  'grid-bin': gridBin,
  'drone-camera-mount': droneMount,
  'gps-antenna-mount': gpsMount,
  'landing-gear': landingGear,
  'prop-guard': propGuard,
  'fpv-frame-3in': fpvFrame,
  'rc-bumper': rcBumper,
  'battery-tray': batteryTray,
  'servo-bracket': servoBracket,
  'robot-chassis': robotChassis,
  'robot-gripper': gripper,
  'wheel-hub': wheelHub,
};

/** The shapes and the facts for one config. cfg must already be normalised (normalizeCfg). */
export function buildTemplate(t: TemplateDef, cfg: Cfg): Built {
  const b = BUILDERS[t.id];
  if (!b) throw new Error('no builder');
  const r = b(cfg);
  const tail = [r.holes ? `Openings through the part: ${r.holes}.` : '', r.parts > 1 ? `Prints as ${r.parts} separate pieces.` : ''].filter(Boolean).join(' ');
  return { ...r, description: `${r.description} ${tail}`.trim() };
}

/** The print mesh for built shapes. The CSG kernel very occasionally leaves an open edge for an unlucky combination of
 * sizes; if so, retry with every hole nudged by up to a few tenths of a mm (below what the printer holds). Deterministic, so
 * the browser preview and the server's price always use the same mesh. Null when no attempt is closed. */
export function templateMesh(shapes: Shape[]): Float32Array | null {
  for (let k = 0; k <= 9; k++) {
    const e = 0.03 * Math.min(k, 6);
    const sh = k === 0 ? shapes : shapes.map((s, i) => s.mode === 'solid' ? (k < 3 ? s : { ...s, size: { x: s.size.x + 0.01 * k * (1 + (i % 3)), y: s.size.y + 0.012 * k * (1 + (i % 2)), z: s.size.z }, position: { ...s.position, y: s.position.y + 0.007 * k * (i % 3) } }) : {
      ...s,
      size: { x: s.size.x + e * (1 + (i % 5) * 0.3), y: s.size.y + e * (1 + (i % 3) * 0.4), z: s.size.z + e },
      position: { x: s.position.x + e * (((i * 7) % 5) - 2) / 2, y: s.position.y + e * (((i * 3) % 5) - 2) / 2, z: s.position.z },
    });
    try {
      const m = buildMesh(sh);
      if (m && meshStats(m)) return m;
    } catch {}
  }
  return null;
}

/** Print mesh, stats and the price for a config. Throws when it cannot be printed or does not fit the bed. */
export function priceTemplate(id: string, cfg: Cfg, qty: number) {
  const t = templateById(id);
  if (!t) throw new Error('unknown template');
  const built = buildTemplate(t, cfg);
  const mesh = templateMesh(built.shapes);
  const stats: MeshStats | null = mesh ? meshStats(mesh) : null;
  if (!mesh || !stats) throw new Error('this configuration could not be built');
  if (!fitsBed(stats.sizeMm)) throw new Error('this configuration does not fit the print bed');
  return { built, mesh, stats, quote: quote(stats, t.material, qty) };
}

/** The order line for a template, priced only from the validated config (what /api/orders saves). */
export function templateOrderLine(t: TemplateDef, cfg: Cfg, qty: number) {
  const { stats, quote: q } = priceTemplate(t.id, cfg, qty);
  const config = t.fields.map((f) => `${f.label}: ${f.type === 'select' ? f.options.find((o) => o.value === cfg[f.key])?.label : cfg[f.key]}`).join(', ');
  return { kind: 'tpl' as const, id: t.id, itemName: t.name, config, cfg, qty, material: t.material, stats, quote: q, total: q.total };
}
