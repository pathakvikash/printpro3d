// Pure: triangle soup (xyz per vertex, mm) -> honest facts about an uploaded or AI mesh. No three.js, no DOM.
import { meshStats, type Size } from './quote.ts';
import { blueprintData } from './blueprint.ts';

export const LIMITS = [
  'We cannot detect hole sizes or positions, only how many openings pass through.',
  'We cannot detect fillets, chamfers or wall thickness.',
  'We cannot tell design intent, such as which faces must mate with another part.',
];
const WELD_MM = 1e-3;

/** Vertices welded to 0.001 mm, then pieces and through-holes by Euler characteristic: holes = pieces - (V - E + F) / 2. Valid for closed meshes. */
function topology(p: ArrayLike<number>) {
  const id = new Map<string, number>();
  const parent: number[] = [];
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const vid = (k: number) => {
    const key = [0, 1, 2].map((d) => Math.round(p[k + d] / WELD_MM)).join(',');
    if (!id.has(key)) { id.set(key, id.size); parent.push(id.size - 1); }
    return id.get(key)!;
  };
  const edges = new Map<string, number>();
  let F = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    const v = [vid(i), vid(i + 3), vid(i + 6)];
    F++;
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const key = v[a] < v[b] ? `${v[a]}|${v[b]}` : `${v[b]}|${v[a]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
      parent[find(v[a])] = find(v[b]);
    }
  }
  const pieces = new Set(parent.map((_, i) => find(i))).size;
  const closed = F > 0 && [...edges.values()].every((c) => c === 2);
  return { pieces, closed, holes: pieces - (id.size - edges.size + F) / 2 };
}

export type MeshAnalysis = {
  triangles: number;
  sizeMm: Size;
  volumeCm3: number | null; // null when the mesh is open: a volume would be a guess
  isClosed: boolean;
  pieces: number;
  throughHoles: number | null; // null unless closed
  orientation: string;
  fitsBed: boolean;
  limits: string[];
};

export function analyzeMesh(positions: ArrayLike<number>): MeshAnalysis | null {
  if (positions.length < 9) return null;
  const bp = blueprintData(positions, 'PLA');
  const top = topology(positions);
  // weld before the volume check so a mesh with duplicated seam vertices still counts as closed
  const welded = Array.from(positions, (v) => Math.round(v / WELD_MM) * WELD_MM);
  const stats = top.closed ? meshStats(welded) : null;
  return {
    triangles: bp.triangles,
    sizeMm: bp.size,
    volumeCm3: stats?.volumeCm3 ?? null,
    isClosed: top.closed,
    pieces: top.pieces,
    throughHoles: top.closed ? top.holes : null,
    orientation: bp.orientation,
    fitsBed: bp.fits,
    limits: LIMITS,
  };
}
