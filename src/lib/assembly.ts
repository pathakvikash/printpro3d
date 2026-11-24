// The shared contract for multi-part kits shown as an assembly (explode, spin, fold, unboxing flat-lay).
// Pure maths, millimetres, Z up, no three: a kit's definition and these helpers run in node tests and on the server.
import type { BufferGeometry } from 'three';

export type V3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w
export type PartMaterial = 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'bought';

export type AssemblyPart = {
  id: string;
  label: string;
  /** A ready geometry, or a builder key the viewer resolves from its `geometries` map. Omit for a bought part. A geometry
   * should be xy-centred and rest on z = 0 (PrintMaterial.prepGeometry does that). */
  geometry?: BufferGeometry | string;
  material: PartMaterial;
  /** Bounding box of the part before rotation, mm. Needed by every part: the flat-lay packs it, a bought part is drawn at it. */
  size: V3;
  /** Centre of the part's bounding box in the assembled model, mm. */
  position: V3;
  /** Euler XYZ, degrees. */
  rotation: V3;
  /** How far the part moves when fully exploded, mm. */
  explode: V3;
  joint?: { axis: V3; pivot: V3; min: number; max: number }; // pivot in assembled space, mm; limits in degrees
  spin?: { axis: V3; rpm: number }; // axis in the part's own frame
  /** Not printed by us: drawn as a labelled neutral placeholder (box or cylinder of `size`), never as a printed part. */
  bought?: boolean;
  shape?: 'box' | 'cylinder'; // placeholder shape for a bought part, default box; a cylinder stands along z with diameter size[0]
};

export type Pose = { position: V3; quaternion: Quat };

const RAD = Math.PI / 180;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function mulQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function axisAngleQuat(axis: V3, deg: number): Quat {
  const n = Math.hypot(...axis) || 1, s = Math.sin(deg * RAD / 2) / n;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(deg * RAD / 2)];
}

/** Euler XYZ degrees to a quaternion, the same order three.js uses. */
export function eulerQuat([x, y, z]: V3): Quat {
  const qx = axisAngleQuat([1, 0, 0], x), qy = axisAngleQuat([0, 1, 0], y), qz = axisAngleQuat([0, 0, 1], z);
  return mulQuat(mulQuat(qx, qy), qz);
}

function rotate(q: Quat, v: V3): V3 {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
  return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx];
}

export const basePose = (p: AssemblyPart): Pose => ({ position: [...p.position], quaternion: eulerQuat(p.rotation) });

/** The part pushed out along its explode vector; t 0 = assembled, 1 = fully exploded (clamped). */
export function explodedTransform(p: AssemblyPart, t: number): Pose {
  const k = clamp(t, 0, 1);
  return { position: [p.position[0] + p.explode[0] * k, p.position[1] + p.explode[1] * k, p.position[2] + p.explode[2] * k], quaternion: eulerQuat(p.rotation) };
}

/** The pose after turning the part `value` degrees (clamped to its limits) about its joint. `from` is the pose to turn,
 * e.g. an exploded one; the pivot travels with the part. Without a joint the pose comes back unchanged. */
export function jointTransform(p: AssemblyPart, value: number, from: Pose = basePose(p)): Pose {
  const j = p.joint;
  if (!j) return from;
  const q = axisAngleQuat(j.axis, clamp(value, Math.min(j.min, j.max), Math.max(j.min, j.max)));
  const pivot: V3 = [j.pivot[0] + from.position[0] - p.position[0], j.pivot[1] + from.position[1] - p.position[1], j.pivot[2] + from.position[2] - p.position[2]];
  const r = rotate(q, [from.position[0] - pivot[0], from.position[1] - pivot[1], from.position[2] - pivot[2]]);
  return { position: [pivot[0] + r[0], pivot[1] + r[1], pivot[2] + r[2]], quaternion: mulQuat(q, from.quaternion) };
}

/** Degrees turned after `seconds` at the part's rpm. */
export const spinDeg = (s: { rpm: number }, seconds: number) => ((s.rpm * 360) / 60) * seconds;

export type FlatLay = { positions: Record<string, V3>; fits: boolean; extent: { x: number; y: number } };

/** Unboxing view: every part flat on the table, unrotated (as printed), packed in rows (shelves), the block centred on the
 * origin. Tallest-footprint first; a row that does not fit starts the next one. If the rows overrun the bed, `fits` is
 * false and they continue past its edge, still without overlap. ponytail: no part rotation, no best-fit; use a real
 * bin packer if kits grow past a dozen parts. */
export function flatLayLayout(parts: AssemblyPart[], bed = { x: 220, y: 220 }, gap = 6): FlatLay {
  const sorted = [...parts].sort((a, b) => b.size[1] - a.size[1] || a.id.localeCompare(b.id));
  const positions: Record<string, V3> = {};
  let x = 0, y = 0, rowH = 0, maxX = 0;
  for (const p of sorted) {
    const [w, d, h] = p.size;
    if (x > 0 && x + w > bed.x) { y += rowH + gap; x = 0; rowH = 0; }
    positions[p.id] = [x + w / 2, y + d / 2, h / 2];
    x += w + gap;
    maxX = Math.max(maxX, x - gap);
    rowH = Math.max(rowH, d);
  }
  const extent = { x: maxX, y: y + rowH };
  for (const v of Object.values(positions)) { v[0] -= extent.x / 2; v[1] -= extent.y / 2; } // the block sits centred on the origin
  return { positions, fits: extent.x <= bed.x && extent.y <= bed.y, extent };
}
