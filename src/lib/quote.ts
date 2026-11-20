// Pure pricing helpers shared by server and client. No three.js import.

// ---- Owner's knobs ----
export const CURRENCY = 'INR';
export const BED_MM = { x: 220, y: 220, z: 250 }; // max print volume
export const SETUP_FEE = 50; // flat fee per order
export const MIN_ORDER = 99; // order total never goes below this
export const FILL_FACTOR = 0.4; // effective solid fraction (~20% infill plus walls)
export const MAX_QTY = 100;
// density in g/cm3, rate per gram
export const MATERIALS = {
  PLA: { density: 1.24, rate: 6 },
  PETG: { density: 1.27, rate: 7 },
  ABS: { density: 1.04, rate: 7 },
  TPU: { density: 1.21, rate: 10 },
} as const;
// ---- end knobs ----

export type MaterialKey = keyof typeof MATERIALS;
export type Size = { x: number; y: number; z: number };
export type MeshStats = { volumeCm3: number; sizeMm: Size };

/** Model units are assumed to be millimetres. Returns null for open/degenerate meshes (manual quote). */
export function meshStats(positions: ArrayLike<number>, index?: ArrayLike<number> | null): MeshStats | null {
  const n = index ? index.length : Math.floor(positions.length / 3);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  const cs = [0, 0, 0]; // vector sum of (b-a)x(c-a): zero for a closed mesh
  let area2 = 0; // sum of |(b-a)x(c-a)|
  // ponytail: string-keyed edge map, ~3 entries per triangle — fine to a few million triangles; switch to welded integer vertex ids if uploads get bigger
  const edges = new Map<string, number>();
  const v = (i: number) => {
    const k = (index ? index[i] : i) * 3;
    return [positions[k], positions[k + 1], positions[k + 2]];
  };
  for (let i = 0; i + 2 < n; i += 3) {
    const [a, b, c] = [v(i), v(i + 1), v(i + 2)];
    for (const p of [a, b, c]) {
      for (let d = 0; d < 3; d++) {
        if (p[d] < min[d]) min[d] = p[d];
        if (p[d] > max[d]) max[d] = p[d];
      }
    }
    const ks = [a, b, c].map((p) => p.join(','));
    for (const [e, f] of [[0, 1], [1, 2], [2, 0]]) {
      const key = ks[e] < ks[f] ? `${ks[e]}|${ks[f]}` : `${ks[f]}|${ks[e]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const x = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    cs[0] += x[0]; cs[1] += x[1]; cs[2] += x[2];
    area2 += Math.hypot(x[0], x[1], x[2]);
    // signed tetrahedron volume against the origin
    vol +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  for (const c of edges.values()) if (c !== 2) return null; // every edge must join exactly two triangles
  const volumeCm3 = Math.abs(vol) / 1000; // mm3 -> cm3
  if (!(area2 > 0) || Math.hypot(cs[0], cs[1], cs[2]) > 1e-6 * area2 || !Number.isFinite(volumeCm3) || volumeCm3 <= 0) return null;
  return { volumeCm3, sizeMm: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] } };
}

/** True if the part fits the bed in some axis-aligned rotation. */
export function fitsBed(s: Size): boolean {
  const a = [s.x, s.y, s.z].sort((p, q) => p - q);
  const b = [BED_MM.x, BED_MM.y, BED_MM.z].sort((p, q) => p - q);
  return a.every((d, i) => d <= b[i]);
}

export function quote(stats: MeshStats, materialKey: string, qty: number) {
  if (typeof materialKey !== 'string' || !Object.hasOwn(MATERIALS, materialKey)) throw new Error('Unknown material');
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error(`Quantity must be 1-${MAX_QTY}`);
  const m = MATERIALS[materialKey as MaterialKey];
  const grams = stats.volumeCm3 * m.density * FILL_FACTOR;
  const unitPrice = grams * m.rate;
  const total = Math.round(Math.max(MIN_ORDER, SETUP_FEE + unitPrice * qty));
  return { grams, unitPrice, total };
}
