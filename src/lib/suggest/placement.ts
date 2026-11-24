// "Where does it go, and at what angle?" Rules + the real flight physics, no AI key needed.
// Motors snap to the frame's mount points with the quad-X spin pattern; the battery goes where the centre of mass lands under the thrust
// centre (flight/trim + mass); flight controller, ESC and payload sit at the centre; the camera sits at the front with a typical tilt.
import type { Shape } from '../playground.ts';
import { mountPoints, type Parts } from '../flight/layout.ts';
import { combine, pointBody, printedDensity, type Body, type Vec3 } from '../flight/mass.ts';
import { typicalMass, type MassComponent } from '../flight/components.ts';
import { trim } from '../flight/trim.ts';
import { checkPlacement, classifyAll, componentBox, overFrame, partBox, PART_SIZE, solidBoxes, turnedSize, union, type Box, type PartKind } from './validate.ts';

export type Placement = {
  posMm: Vec3; yawDeg: number; tiltDeg: number; spin?: 'cw' | 'ccw'; reason: string; basis: 'rule' | 'physics' | 'typical' | 'ai' | 'nudged';
};
export type PlacementResult = Placement | { posMm: null; reason: string };

export const CAMERA_TILT_DEG = 25, GRID_MM = 2, PAD_MIN_MM = 5;
export const VOLUME: Record<Shape['kind'], number> = { box: 1, cylinder: Math.PI / 4, sphere: Math.PI / 6, cone: Math.PI / 12, torus: (3 * Math.PI ** 2) / 64, wedge: 0.5 }; // torus: tube 0.125 around R 0.375, stretched to a 1x1x1 box
const round1 = (v: number) => Math.round(v * 10) / 10;
const none = (reason: string): PlacementResult => ({ posMm: null, reason });

/** Frame as one point mass at the volume-weighted shape centres. ESTIMATE: holes ignored, printed at the quote fill factor (PLA). */
function frameBody(shapes: Shape[]): Body | null {
  const solids = shapes.filter((s) => s.mode === 'solid');
  const w = solids.map((s) => s.size.x * s.size.y * s.size.z * VOLUME[s.kind]), tot = w.reduce((a, b) => a + b, 0);
  if (!(tot > 0)) return null;
  const c = (['x', 'y', 'z'] as const).map((k) => solids.reduce((a, s, i) => a + s.position[k] * w[i], 0) / tot) as Vec3;
  return pointBody(tot * 1e-9 * printedDensity('PLA') * 1000, c);
}

const xyOverlap = (a: Box, b: Box) => a.lo[0] < b.hi[0] && b.lo[0] < a.hi[0] && a.lo[1] < b.hi[1] && b.lo[1] < a.hi[1];

/** z of the part's centre when it rests on whatever is below its footprint (frame solids and already placed parts stack). */
export function restZ(kind: PartKind, xy: [number, number], shapes: Shape[], parts: Parts, size: Vec3 = PART_SIZE[kind]): number {
  const s = size, foot = partBox(kind, [xy[0], xy[1], 0], size);
  const below = [...solidBoxes(shapes), ...parts.components.map(componentBox).filter((b): b is Box => !!b)].filter((b) => xyOverlap(b, foot));
  return Math.max(0, ...below.map((b) => b.hi[2])) + s[2] / 2;
}

/** z to store for a part of `kind` whose footprint centre is xy: a motor rises from the surface (its pos is the mount point), everything else is centred. */
export const settleZ = (kind: PartKind, xy: [number, number], shapes: Shape[], parts: Parts, size?: Vec3): number =>
  restZ(kind, xy, shapes, parts, size) - (kind === 'motor' ? PART_SIZE.motor[2] / 2 : 0);

/** quadX() spin for a motor at pos about the frame centre: front-right and rear-left CCW, front-left and rear-right CW (props-in). */
export const quadSpin = (pos: Vec3, frame: Box): 'cw' | 'ccw' => ((pos[0] - (frame.lo[0] + frame.hi[0]) / 2) * (pos[1] - (frame.lo[1] + frame.hi[1]) / 2) > 0 ? 'ccw' : 'cw');

function motorSpot(shapes: Shape[], parts: Parts, frame: Box): PlacementResult {
  const taken = parts.motors.map((m) => m.pos), cx = (frame.hi[0] + frame.lo[0]) / 2, cy = (frame.hi[1] + frame.lo[1]) / 2;
  let pads = mountPoints(shapes).filter((p) => Math.abs(p[0] - cx) > PAD_MIN_MM && Math.abs(p[1] - cy) > PAD_MIN_MM);
  let how = 'Snaps to a mount pad';
  if (!pads.length) { // no pads: the four frame corners, pulled in 20%
    const hx = (frame.hi[0] - frame.lo[0]) * 0.4, hy = (frame.hi[1] - frame.lo[1]) * 0.4;
    pads = ([[cx + hx, cy + hy], [cx - hx, cy + hy], [cx - hx, cy - hy], [cx + hx, cy - hy]] as [number, number][]).map((xy): Vec3 => [xy[0], xy[1], settleZ('motor', xy, shapes, parts)]);
    how = 'No mount pads found, so it goes near a frame corner';
  }
  // quad-X order about the frame centre: front-right, front-left, rear-left, rear-right
  const rank = (p: Vec3) => (p[1] > cy ? (p[0] > cx ? 0 : 1) : p[0] < cx ? 2 : 3);
  const free = pads.filter((p) => !taken.some((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) < 8)).sort((a, b) => rank(a) - rank(b));
  if (!free.length) return none('Every mount pad already has a motor.');
  const pad = free.find((p) => !checkPlacement('motor', p, shapes, undefined, parts)) ?? free[0]; // skip a pad another part is sitting on
  const spin = quadSpin(pad, frame);
  const pos: Vec3 = [pad[0], pad[1], pad[2]], why = checkPlacement('motor', pos, shapes, undefined, parts);
  if (why) return none(`The mount pad at (${round1(pad[0])}, ${round1(pad[1])}) is unusable: ${why}.`);
  const corner = `${pad[1] > cy ? 'front' : 'rear'}-${pad[0] > cx ? 'right' : 'left'}`;
  return { posMm: pos, yawDeg: 0, tiltDeg: 0, spin, basis: 'rule', reason: `${how} at (${round1(pad[0])}, ${round1(pad[1])}), the ${corner} corner. Spin ${spin.toUpperCase()} so opposite corners cancel torque (quad-X, props in).` };
}

function batterySpot(shapes: Shape[], parts: Parts, frame: Box): PlacementResult {
  const [w, d] = PART_SIZE.battery, mass = typicalMass('Battery')!.massG;
  const frameB = frameBody(shapes);
  const comps = parts.components.map((c) => ({ ...c, massG: c.massG ?? typicalMass(c.name)?.massG ?? 0 }));
  const centroid = parts.motors.length
    ? [0, 1].map((i) => parts.motors.reduce((a, m) => a + m.pos[i], 0) / parts.motors.length)
    : [(frame.lo[0] + frame.hi[0]) / 2, (frame.lo[1] + frame.hi[1]) / 2];
  const cgOf = (extra: Vec3 | null) => combine([...(frameB ? [frameB] : []), ...comps.map((c) => pointBody(c.massG, c.pos)), ...(extra ? [pointBody(mass, extra)] : [])]).cgMm;
  const off = (cg: Vec3) => Math.hypot(cg[0] - centroid[0], cg[1] - centroid[1]);

  let best: { pos: Vec3; yaw: number; score: number; dist: number } | null = null;
  for (const yaw of [0, 90]) {
    const [hw, hd] = yaw ? [d / 2, w / 2] : [w / 2, d / 2], size: Vec3 = [hw * 2, hd * 2, PART_SIZE.battery[2]];
    const from = (lo: number, c: number) => c + GRID_MM * Math.ceil((lo - c) / GRID_MM - 1e-9); // grid through the thrust centre, so the centre itself is a candidate
    for (let x = from(frame.lo[0] + hw, centroid[0]); x <= frame.hi[0] - hw + 1e-9; x += GRID_MM) for (let y = from(frame.lo[1] + hd, centroid[1]); y <= frame.hi[1] - hd + 1e-9; y += GRID_MM) {
      const pos: Vec3 = [x, y, restZ('battery', [x, y], shapes, parts, size)];
      if (checkPlacement('battery', pos, shapes, size, parts)) continue; // on real material, in the bed, clear of the frame and of parts already placed
      const score = off(cgOf(pos)), dist = Math.hypot(x - centroid[0], y - centroid[1]);
      if (!best || score < best.score - 1e-6 || (Math.abs(score - best.score) <= 1e-6 && dist < best.dist)) best = { pos, yaw, score, dist };
    }
  }
  if (!best) return none('No spot inside the frame is big enough for a typical 60x30x20 mm battery. Use a smaller battery or a bigger frame.');
  const pos: Vec3 = [round1(best.pos[0]), round1(best.pos[1]), round1(best.pos[2])];
  let before = off(cgOf(null)), after = best.score;
  if (parts.motors.length) { // the real hover-trim solver reports the CG it would see
    const f = frameB ?? undefined, tc = (extra: MassComponent[]) => trim({ motors: parts.motors, components: [...comps, ...extra], frame: f }).cgMm;
    before = off(tc([]));
    after = off(tc([{ id: 'suggest-battery', name: 'Battery', massG: mass, pos }]));
  }
  const gain = round1(before - after);
  return {
    posMm: pos, yawDeg: best.yaw, tiltDeg: 0, basis: 'physics',
    reason: `${gain >= 0.5 ? `Moves the centre of mass ${gain} mm toward the middle: ` : 'Keeps the centre of mass close to the middle: '}${round1(after)} mm from the thrust centre (${round1(before)} mm without the battery), using a typical ${mass} g battery (ESTIMATE: weigh yours). It sits on the frame, long side ${best.yaw ? 'along y' : 'along x'}.`,
  };
}

/**
 * Where to put the next `kind` and at what angle. posMm is what the Playground stores: the mount point for a motor (the motor rises from it),
 * the centre for every other part. null posMm with a reason when nothing sensible fits. Every result is inside the bed and clear of the frame solids.
 */
export function suggestPlacement(kind: PartKind, shapes: Shape[], parts: Parts): PlacementResult {
  const frame = union(solidBoxes(shapes));
  if (!frame) return none('Add a frame first: there is no solid shape to mount on.');
  if (kind !== 'motor' && parts.components.some((c) => classifyAll(c.name).includes(kind))) return none(`There is already a ${kind} in the design.`);
  let r: PlacementResult;
  if (kind === 'motor') r = motorSpot(shapes, parts, frame);
  else if (kind === 'battery') r = batterySpot(shapes, parts, frame);
  else {
    const cx = parts.motors.length ? parts.motors.reduce((a, m) => a + m.pos[0], 0) / parts.motors.length : (frame.lo[0] + frame.hi[0]) / 2;
    const cy = parts.motors.length ? parts.motors.reduce((a, m) => a + m.pos[1], 0) / parts.motors.length : (frame.lo[1] + frame.hi[1]) / 2;
    if (kind === 'camera') {
      let y = frame.hi[1] - PART_SIZE.camera[1] / 2;
      while (y > cy && !overFrame(shapes, cx, y)) y -= GRID_MM; // X frames have no material at the front centre: back off onto the plate
      const z = restZ('camera', [cx, y], shapes, parts);
      r = { posMm: [round1(cx), round1(y), round1(z)], yawDeg: 0, tiltDeg: CAMERA_TILT_DEG, basis: 'typical', reason: `Front centre of the frame, tilted up ${CAMERA_TILT_DEG} deg: typical (FPV 15-35 deg), adjust to taste.` };
    } else {
      const z = restZ(kind, [cx, cy], shapes, parts), what = { fc: 'The flight controller goes at the centre, where the drone turns around', esc: 'The ESC goes at the centre, short wires to every motor', payload: 'The payload goes under the thrust centre so it does not tip the drone' }[kind];
      r = { posMm: [round1(cx), round1(cy), round1(z)], yawDeg: 0, tiltDeg: 0, basis: 'typical', reason: `${what} (typical layout).` };
    }
  }
  if (r.posMm) { const why = checkPlacement(kind, r.posMm, shapes, turnedSize(kind, 'yawDeg' in r ? r.yawDeg : 0), parts); if (why) return none(`The ${kind} spot found does not work: ${why}.`); }
  return r;
}
