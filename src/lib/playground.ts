// Pure model-builder logic: shapes -> CSG mesh -> binary STL. No React, no DOM, runs in node.
// Coordinates: 1 unit = 1 mm, Z is up (the plate is the XY plane, centred on the origin).
// The 3D view uses the same Z-up space (camera.up = +Z), so nothing is converted anywhere,
// and the STL a slicer reads has the same vertical axis as the height the user sees.
// ponytail: primitives + boolean only — sketch/extrude, fillets and measured snapping when users outgrow this
import { BufferAttribute, BufferGeometry, BoxGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { meshStats, type Size } from './quote.ts';

export const KINDS = ['box', 'cylinder', 'sphere', 'cone', 'torus', 'wedge'] as const;
export type Kind = (typeof KINDS)[number];
export type V3 = { x: number; y: number; z: number };
export type Shape = {
  id: string;
  kind: Kind;
  mode: 'solid' | 'hole';
  position: V3; // centre of the shape's box, mm
  rotation: V3; // degrees, applied X then Y then Z
  size: V3; // mm along the shape's own axes, before rotation
};

export const DEFAULT_SIZE: Record<Kind, V3> = {
  box: { x: 20, y: 20, z: 20 },
  cylinder: { x: 20, y: 20, z: 20 },
  sphere: { x: 20, y: 20, z: 20 },
  cone: { x: 20, y: 20, z: 20 },
  torus: { x: 30, y: 30, z: 10 },
  wedge: { x: 20, y: 20, z: 20 },
};
export const LABEL: Record<Kind, string> = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', cone: 'Cone', torus: 'Ring', wedge: 'Wedge' };
export const MIN_SIZE = 0.1;
export const MAX_SHAPES = 20;
export const MAX_COORD = 10000; // mm, applied to every position, rotation-free size and typed value

// ---------- unit geometry: each fits a 1x1x1 box centred on the origin, axis along Z ----------

function wedge(): BufferGeometry {
  // right-triangle profile in XZ, extruded along Y; 6 vertices, 8 outward-wound triangles
  const p = [-.5, -.5, -.5, .5, -.5, -.5, -.5, -.5, .5, -.5, .5, -.5, .5, .5, -.5, -.5, .5, .5];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.setIndex([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2]);
  return g;
}

function raw(kind: Kind): BufferGeometry {
  switch (kind) {
    case 'box': return new BoxGeometry(1, 1, 1);
    case 'cylinder': return new CylinderGeometry(0.5, 0.5, 1, 48).rotateX(Math.PI / 2);
    case 'sphere': return new SphereGeometry(0.5, 48, 32).rotateX(Math.PI / 2);
    case 'cone': return new ConeGeometry(0.5, 1, 48).rotateX(Math.PI / 2);
    case 'torus': return new TorusGeometry(0.375, 0.125, 24, 48);
    case 'wedge': return wedge();
  }
}

const cache = new Map<Kind, BufferGeometry>();
/** Shared, welded, position-only unit geometry (also what the editor draws). Do not mutate. */
export function unitGeometry(kind: Kind): BufferGeometry {
  let g = cache.get(kind);
  if (!g) {
    g = raw(kind);
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const c = b.getCenter(new Vector3());
    const s = b.getSize(new Vector3());
    g.translate(-c.x, -c.y, -c.z).scale(1 / s.x, 1 / s.y, 1 / s.z); // exactly 1 mm per axis, so size == bounding box
    g = mergeVertices(g, 1e-6); // three's primitives duplicate vertices along uv seams; CSG needs a closed indexed mesh
    cache.set(kind, g);
  }
  return g;
}

export function shapeMatrix(s: Shape): Matrix4 {
  const d = Math.PI / 180;
  return new Matrix4().compose(
    new Vector3(s.position.x, s.position.y, s.position.z),
    new Quaternion().setFromEuler(new Euler(s.rotation.x * d, s.rotation.y * d, s.rotation.z * d, 'XYZ')),
    new Vector3(s.size.x, s.size.y, s.size.z),
  );
}

function worldVertices(s: Shape): Vector3[] {
  const m = shapeMatrix(s);
  const pos = unitGeometry(s.kind).attributes.position;
  return Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
}

/** Lowest point of the shape (mm). */
export function minZ(s: Shape): number {
  return Math.min(...worldVertices(s).map((v) => v.z));
}

/** Overall size of all solids together, or null when there are none. This is what the UI shows. */
export function solidsSize(shapes: Shape[]): Size | null {
  const vs = shapes.filter((s) => s.mode === 'solid').flatMap(worldVertices);
  if (!vs.length) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of vs) for (const [i, k] of (['x', 'y', 'z'] as const).entries()) { lo[i] = Math.min(lo[i], v[k]); hi[i] = Math.max(hi[i], v[k]); }
  return { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] };
}

// ---------- CSG ----------

/** Second attempt only, when the exact one is not closed: each side moves out this far (mm): solids 1 um, holes 3 um. Faces that merely touch or sit flush (a cone standing on a box,
 * a hole exactly as deep as its block) become real overlaps, because coplanar CSG leaves open edges. Far below printer resolution. */
export const GROW = { solid: 1e-3, hole: 3e-3 };

function brush(s: Shape, grow: boolean, i: number): Brush {
  const b = new Brush(unitGeometry(s.kind).clone()); // a brush owns its geometry
  const g = grow ? 2 * GROW[s.mode] * (1 + 0.7 * i) : 0; // a different amount per shape, so flush faces stop being coplanar
  shapeMatrix({ ...s, size: { x: s.size.x + g, y: s.size.y + g, z: s.size.z + g } }).decompose(b.position, b.quaternion, b.scale);
  b.updateMatrixWorld(true);
  return b;
}

/** Quantum for exported coordinates (mm). float32 holds values this coarse consistently, so shared edges stay bit-identical. */
export const QUANT = 1e-4;
/** Vertices closer than this are one vertex (CSG leaves float32 noise ~1e-5 and T-junction slivers). */
export const WELD = 1e-2;

/** Weld near-equal vertices (neighbour-cell search, so no hash-boundary misses), snap to QUANT, drop degenerate triangles. */
export function cleanTriangles(src: ArrayLike<number>, index: ArrayLike<number> | null, repair = true): Float32Array {
  const n = index ? index.length : Math.floor(src.length / 3);
  const at = (i: number) => (index ? index[i] : i) * 3;
  const cell = (v: number) => Math.floor(v / WELD);
  const grid = new Map<string, number[]>(); // cell -> cluster ids
  const reps: number[] = []; // cluster id*3 -> snapped coordinates
  const ids = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = at(i);
    const p = [src[k], src[k + 1], src[k + 2]];
    const [cx, cy, cz] = p.map(cell);
    let found = -1;
    search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const id of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        if (Math.hypot(reps[id * 3] - p[0], reps[id * 3 + 1] - p[1], reps[id * 3 + 2] - p[2]) < WELD) { found = id; break search; }
      }
    }
    if (found < 0) {
      found = reps.length / 3;
      reps.push(...p); // first member is the representative; snapped below
      const key = `${cx},${cy},${cz}`;
      grid.set(key, [...(grid.get(key) ?? []), found]);
    }
    ids[i] = found;
  }
  const snap = (v: number) => Math.fround(Math.round(v / QUANT) * QUANT); // the float32 the STL will hold
  const q = reps.map(snap);
  // Triangles over welded vertex ids. A collinear sliver is a T-junction CSG left behind: dropping it would open a hole,
  // so split the triangle on its long edge at the sliver's middle vertex first, then drop it.
  const T: (number[] | null)[] = [];
  const E = new Map<string, number[]>();
  const queue: number[] = [];
  const ek = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const P = (v: number) => [q[v * 3], q[v * 3 + 1], q[v * 3 + 2]];
  const sliver = (t: number[]) => {
    const [a, b, c] = t.map(P);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const area2 = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    return area2 / Math.max(Math.hypot(...u), Math.hypot(...w), Math.hypot(w[0] - u[0], w[1] - u[1], w[2] - u[2])) < 2 * QUANT;
  };
  const edges = (t: number[]) => [0, 1, 2].map((k) => ek(t[k], t[(k + 1) % 3]));
  const add = (t: number[]) => {
    const i = T.push(t) - 1;
    for (const e of edges(t)) E.set(e, [...(E.get(e) ?? []), i]);
    if (sliver(t)) queue.push(i);
  };
  const del = (i: number) => {
    for (const e of edges(T[i]!)) E.set(e, E.get(e)!.filter((j) => j !== i));
    T[i] = null;
  };
  for (let i = 0; i + 2 < n; i += 3) {
    const t = [ids[i], ids[i + 1], ids[i + 2]];
    if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) add(t);
  }
  for (let guard = 0; repair && queue.length && guard++ < 5000; ) {
    const i = queue.pop()!;
    const t = T[i];
    if (!t) continue;
    const len = (k: number) => Math.hypot(...[0, 1, 2].map((d) => q[t[k] * 3 + d] - q[t[(k + 1) % 3] * 3 + d]));
    const k = [0, 1, 2].sort((x, y) => len(y) - len(x))[0]; // longest edge k -> k+1, middle vertex k+2
    const [p, r, m] = [t[k], t[(k + 1) % 3], t[(k + 2) % 3]];
    del(i);
    for (const j of E.get(ek(p, r)) ?? []) {
      const u = T[j];
      if (!u) continue; // stale edge entry
      const s = [0, 1, 2].find((x) => ek(u[x], u[(x + 1) % 3]) === ek(p, r))!;
      const [v0, v1, w] = [u[s], u[(s + 1) % 3], u[(s + 2) % 3]];
      del(j);
      add([v0, m, w]);
      add([m, v1, w]);
    }
  }
  // CSG also leaves T-junctions where the sliver is simply missing: an edge p-r of one triangle faces two edges p-m, m-r.
  // Find boundary edges with another boundary vertex on them and split the triangle there.
  const onSegment = (m: number, p: number, r: number) => {
    const [a, b, c] = [P(p), P(r), P(m)];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const t = (d[0] * e[0] + d[1] * e[1] + d[2] * e[2]) / L2;
    return t > 0 && t < 1 && Math.hypot(e[0] - t * d[0], e[1] - t * d[1], e[2] - t * d[2]) < WELD;
  };
  for (let again = repair, guard = 0; again && guard++ < 500; ) {
    again = false;
    const open = [...E].filter(([, l]) => l.length === 1).map(([, l]) => l[0]);
    const verts = new Set(open.flatMap((i) => T[i]!));
    find: for (const i of open) {
      const t = T[i]!;
      for (let s = 0; s < 3; s++) {
        const [v0, v1, w] = [t[s], t[(s + 1) % 3], t[(s + 2) % 3]];
        if (E.get(ek(v0, v1))!.length !== 1) continue;
        for (const m of verts) {
          if (m !== v0 && m !== v1 && m !== w && onSegment(m, v0, v1)) {
            del(i);
            add([v0, m, w]);
            add([m, v1, w]);
            again = true;
            break find;
          }
        }
      }
    }
  }
  const out: number[] = [];
  for (const t of T) if (t) for (const v of t) out.push(...P(v));
  return Float32Array.from(out);
}

/** A brush's triangles in world space as a fresh identity brush. CSG results sit in brush A's local space and use drawRange, so bake both. */
function bake(b: Brush): Brush {
  const g = b.geometry;
  const { start, count } = g.drawRange;
  const end = Number.isFinite(count) ? start + count : Infinity;
  const ng = new BufferGeometry();
  ng.setAttribute('position', new BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
  if (g.index) ng.setIndex(Array.from(g.index.array as ArrayLike<number>).slice(start, end));
  else if (start || end !== Infinity) ng.setAttribute('position', new BufferAttribute(Float32Array.from(g.attributes.position.array).slice(start * 3, end * 3), 3));
  const out = new Brush(ng.applyMatrix4(b.matrixWorld));
  out.updateMatrixWorld(true);
  return out;
}

function csg(shapes: Shape[], grow: boolean, repair: boolean): Float32Array | null {
  const solids = shapes.filter((s) => s.mode === 'solid');
  const ev = new Evaluator() as Evaluator & { useCDTClipping: boolean }; // in the package source and README, missing from its .d.ts
  ev.attributes = ['position'];
  ev.useGroups = false;
  ev.useCDTClipping = true; // constrained-Delaunay triangulation of clipped faces: the default splitter leaves overlapping triangles on cylinder holes
  let acc = bake(brush(solids[0], grow, 0));
  solids.slice(1).forEach((s, i) => { acc = bake(ev.evaluate(acc, brush(s, grow, i + 1), ADDITION)); });
  shapes.filter((s) => s.mode === 'hole').forEach((h, i) => { acc = bake(ev.evaluate(acc, brush(h, grow, i), SUBTRACTION)); });
  const tris = cleanTriangles(acc.geometry.attributes.position.array, acc.geometry.index?.array ?? null, repair);
  return tris.length ? tris : null;
}

/** Union of all solids minus all holes, as clean index-free triangles (xyz per vertex). Null if nothing is left.
 * Exact geometry first; only if that is not a closed manifold, retry with touching faces nudged into overlap (GROW). */
export function buildMesh(shapes: Shape[], opts: { repair?: boolean; grow?: boolean } = {}): Float32Array | null {
  const { repair = true, grow = true } = opts; // switches exist so tests can prove each stage earns its keep
  if (!shapes.some((s) => s.mode === 'solid')) return null;
  const exact = csg(shapes, false, repair);
  if (!exact || meshStats(exact)) return exact;
  if (!grow) return exact;
  try {
    const grown = csg(shapes, true, repair);
    return grown && meshStats(grown) ? grown : exact;
  } catch {
    return exact;
  }
}

/** Binary STL bytes from index-free triangles. */
export function toStl(tris: Float32Array): Uint8Array {
  const n = tris.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    const p = tris.subarray(t * 9, t * 9 + 9);
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]];
    const w = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
    const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    [nx / len, ny / len, nz / len, ...p].forEach((v, i) => dv.setFloat32(o + i * 4, v, true));
  }
  return new Uint8Array(buf);
}

// ---------- saved designs (localStorage is a trust boundary) ----------

export const clampCoord = (v: number) => Math.max(-MAX_COORD, Math.min(MAX_COORD, v));
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clampCoord(v) : d);
const vec = (v: unknown, d: V3): V3 => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { x: num(o.x, d.x), y: num(o.y, d.y), z: num(o.z, d.z) };
};

/** Parse a saved design; anything malformed is dropped rather than trusted. */
export function parseDesign(json: string | null): Shape[] {
  try {
    const arr = JSON.parse(json ?? '[]');
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    return arr.slice(0, MAX_SHAPES).flatMap((o): Shape[] => {
      if (!o || typeof o !== 'object' || !KINDS.includes(o.kind) || typeof o.id !== 'string' || seen.has(o.id)) return [];
      seen.add(o.id);
      const size = vec(o.size, DEFAULT_SIZE[o.kind as Kind]);
      return [{
        id: o.id, kind: o.kind, mode: o.mode === 'hole' ? 'hole' : 'solid',
        position: vec(o.position, { x: 0, y: 0, z: 0 }),
        rotation: vec(o.rotation, { x: 0, y: 0, z: 0 }),
        size: { x: Math.max(MIN_SIZE, size.x), y: Math.max(MIN_SIZE, size.y), z: Math.max(MIN_SIZE, size.z) },
      }];
    });
  } catch {
    return [];
  }
}
