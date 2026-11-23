// Mass properties from a closed triangle mesh (Eberly, "Polyhedral Mass Properties": signed tetrahedra against the origin)
// plus point masses and the parallel-axis theorem. Input mm, output SI (kg, kg m^2); centres of mass stay in mm.
import { MATERIALS, FILL_FACTOR, type MaterialKey } from '../quote.ts';

export type Vec3 = [number, number, number];
/** Inertia tensor entries (kg m^2), off-diagonals are the tensor entries (-integral of xy), not products of inertia. */
export type Tensor = { xx: number; yy: number; zz: number; xy: number; yz: number; xz: number };
export type Body = { massKg: number; cgMm: Vec3; I: Tensor };
export const ZERO: Tensor = { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 };

/**
 * Effective density of a printed part in kg/m3: material density x FILL_FACTOR (shared with the quote).
 * ESTIMATE: thin arms and walls are mostly perimeter, so a fixed 40% fill under-counts their mass; weigh the real part.
 */
export function printedDensity(material: MaterialKey): number {
  return MATERIALS[material].density * 1000 * FILL_FACTOR;
}

/** Mass, CG and inertia about the CG of a closed mesh (positions in mm, optional index). null if the volume is ~0 or non-finite. */
export function meshBody(positions: ArrayLike<number>, index: ArrayLike<number> | null | undefined, densityKgM3: number): Body | null {
  const n = index ? index.length : Math.floor(positions.length / 3);
  const v = (i: number) => { const k = (index ? index[i] : i) * 3; return [positions[k], positions[k + 1], positions[k + 2]]; };
  // integrals of 1, x, y, z, x2, y2, z2, xy, yz, xz over the solid, per unit density (mm units)
  const g = new Array(10).fill(0);
  for (let i = 0; i + 2 < n; i += 3) {
    const p = [v(i), v(i + 1), v(i + 2)];
    const det = p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
    const s = (d: number) => p[0][d] + p[1][d] + p[2][d];
    const sq = (d: number) => p[0][d] ** 2 + p[1][d] ** 2 + p[2][d] ** 2 + p[0][d] * p[1][d] + p[0][d] * p[2][d] + p[1][d] * p[2][d];
    const cross = (a: number, b: number) => p[0][a] * (2 * p[0][b] + p[1][b] + p[2][b]) + p[1][a] * (p[0][b] + 2 * p[1][b] + p[2][b]) + p[2][a] * (p[0][b] + p[1][b] + 2 * p[2][b]);
    g[0] += det / 6;
    for (let d = 0; d < 3; d++) { g[1 + d] += (det / 24) * s(d); g[4 + d] += (det / 60) * sq(d); }
    g[7] += (det / 120) * cross(0, 1); g[8] += (det / 120) * cross(1, 2); g[9] += (det / 120) * cross(0, 2);
  }
  const sign = g[0] < 0 ? -1 : 1; // inward-wound mesh: flip every integral
  for (let i = 0; i < 10; i++) g[i] *= sign;
  const volMm3 = g[0];
  if (!Number.isFinite(volMm3) || volMm3 <= 1e-9) return null;
  const cx = g[1] / volMm3, cy = g[2] / volMm3, cz = g[3] / volMm3;
  const k = densityKgM3 * 1e-15; // kg/m3 * mm5 -> kg m2
  return {
    massKg: densityKgM3 * volMm3 * 1e-9,
    cgMm: [cx, cy, cz],
    I: {
      xx: k * (g[5] + g[6] - volMm3 * (cy * cy + cz * cz)),
      yy: k * (g[4] + g[6] - volMm3 * (cx * cx + cz * cz)),
      zz: k * (g[4] + g[5] - volMm3 * (cx * cx + cy * cy)),
      xy: -k * (g[7] - volMm3 * cx * cy),
      yz: -k * (g[8] - volMm3 * cy * cz),
      xz: -k * (g[9] - volMm3 * cx * cz),
    },
  };
}

export const pointBody = (massG: number, posMm: Vec3): Body => ({ massKg: massG / 1000, cgMm: posMm, I: ZERO });

/** Parallel-axis term: inertia of mass m displaced by d (metres) from the reference point. */
export function parallelAxis(m: number, d: Vec3): Tensor {
  const [x, y, z] = d, r2 = x * x + y * y + z * z;
  return { xx: m * (r2 - x * x), yy: m * (r2 - y * y), zz: m * (r2 - z * z), xy: -m * x * y, yz: -m * y * z, xz: -m * x * z };
}

const add = (a: Tensor, b: Tensor): Tensor => ({ xx: a.xx + b.xx, yy: a.yy + b.yy, zz: a.zz + b.zz, xy: a.xy + b.xy, yz: a.yz + b.yz, xz: a.xz + b.xz });

/** Total mass, combined CG (mm) and inertia about that CG (kg m^2). */
export function combine(bodies: Body[]): Body {
  const m = bodies.reduce((s, b) => s + b.massKg, 0);
  const cg: Vec3 = m > 0 ? [0, 1, 2].map((d) => bodies.reduce((s, b) => s + b.massKg * b.cgMm[d], 0) / m) as Vec3 : [0, 0, 0];
  let I = ZERO;
  for (const b of bodies) {
    const d = [0, 1, 2].map((i) => (b.cgMm[i] - cg[i]) / 1000) as Vec3;
    I = add(I, add(b.I, parallelAxis(b.massKg, d)));
  }
  return { massKg: m, cgMm: cg, I };
}
