// Generic parametric 3D models for the parts in parts.ts: cylinders, boxes and discs, unioned and drilled with the playground CSG.
// Z is up, every model stands on z = 0, centred on x and y. Reference models only: simplified, typical dimensions.
import { LATE, buildMesh, type Kind, type Shape } from './playground.ts';
import { blueprint, bounds, type BlueprintReference } from './blueprint.ts';
import { REFERENCE_BADGE, type Part } from './parts.ts';

type N3 = [number, number, number];
let n = 0;
const sh = (kind: Kind, c: N3, size: N3, rot: N3 = [0, 0, 0], mode: 'solid' | 'hole' = 'solid'): Shape =>
  ({ id: `p${n++}`, kind, mode, position: { x: c[0], y: c[1], z: c[2] }, rotation: { x: rot[0], y: rot[1], z: rot[2] }, size: { x: size[0], y: size[1], z: size[2] } });
const box = (c: N3, size: N3) => sh('box', c, size);
const cyl = (c: N3, d: number, h: number, rot: N3 = [0, 0, 0]) => sh('cylinder', c, [d, d, h], rot);
const hole = (c: N3, d: number, h: number, rot: N3 = [0, 0, 0]) => sh('cylinder', c, [d, d, h], rot, 'hole');
const corners = (a: number, b = a): [number, number][] => [[a / 2, b / 2], [-a / 2, b / 2], [-a / 2, -b / 2], [a / 2, -b / 2]];

const BUILD: Record<Part['class'], (p: Record<string, number>) => Shape[]> = {
  // flat base disc with the bolt holes, the bell above it, the shaft on top
  'motor-bell': ({ d, h, pattern, bolt, shaft }) => {
    const baseH = 3, shaftH = 4, baseD = pattern ? Math.max(pattern * Math.SQRT2 + 3, d * 0.8) : d * 0.7;
    const out = [cyl([0, 0, baseH / 2], baseD, baseH), cyl([0, 0, baseH + (h - baseH - shaftH) / 2], d, h - baseH - shaftH), cyl([0, 0, h - shaftH / 2], shaft, shaftH)];
    if (pattern) for (const [x, y] of corners(pattern)) out.push(hole([x, y, baseH / 2], bolt, baseH + 2));
    return out;
  },
  // swept-disc ring (the tip circle) + hub + flat blades from hub to ring
  prop: ({ d, n: k, hub, hubH, w }) => {
    const r0 = hub / 2 - 0.5, r1 = Math.sqrt((d / 2 - 0.3) ** 2 - (w / 2) ** 2), len = r1 - r0, mid = (r0 + r1) / 2, t = 1.2;
    const out = [cyl([0, 0, hubH / 2], d, 0.6), hole([0, 0, hubH / 2], d - 4, 2), cyl([0, 0, hubH / 2], hub, hubH)]; // the ring is drilled first; hub and blades go in after (LATE)
    for (let i = 0; i < k; i++) {
      const a = (i * 2 * Math.PI) / k;
      out.push(sh('box', [mid * Math.cos(a), mid * Math.sin(a), hubH / 2], [len, w, t], [0, 0, (a * 180) / Math.PI]));
    }
    return out.map((s, i) => (i > 1 ? { ...s, id: LATE + s.id } : s));
  },
  stack: ({ side, pitch, hole: hd, t }) => [
    box([0, 0, t / 2], [side, side, t]), box([0, 2, t + 1.5], [side * 0.5, side * 0.5, 3]), box([0, -side / 2 + 3, t + 0.5], [side * 0.7, 4, 1]),
    ...corners(pitch).map(([x, y]) => hole([x, y, t / 2], hd, t + 2)),
  ],
  // body box, lens barrel pointing -y
  camera: ({ w, depth, lens, lensL }) => [box([0, depth / 2, w / 2], [w, depth, w]), sh('cylinder', [0, -lensL / 2, w / 2], [lens, lens, lensL], [90, 0, 0])],
  puck: ({ d, h, base, baseH }) => [cyl([0, 0, baseH / 2], base, baseH), cyl([0, 0, baseH + h / 2], d, h)],
  // pack block with a cable and connector out of the +x end
  battery: ({ l, w, h, lead }) => [box([0, 0, h / 2], [l, w, h]), cyl([l / 2 + (lead - 7) / 2, 0, h / 2], 4, lead - 7, [0, 90, 0]), box([l / 2 + lead - 3.5, 0, h / 2], [7, 8, 6])],
  // body, two mounting ears with a screw hole each, output boss and shaft
  servo: ({ l, w, h, ear, earZ, total }) => {
    const bx = -l / 2 + 5.5, hx = (ear / 2 + l / 2) / 2;
    return [box([0, 0, h / 2], [l, w, h]), box([0, 0, earZ + 1.25], [ear, w, 2.5]), cyl([bx, 0, h + 1.25], 11.5, 2.5), cyl([bx, 0, h + 2.5 + (total - h - 2.5) / 2], 4.8, total - h - 2.5),
      hole([hx, 0, earZ + 1.25], 2, 4), hole([-hx, 0, earZ + 1.25], 2, 4)];
  },
  // pcb, shielded module at one end, two header strips, USB connector at the other
  board: ({ l, w, t }) => [
    box([0, 0, t / 2], [l, w, t]), box([-l / 2 + 10, 0, t + 1.7], [18, 20, 3.4]),
    box([6, w / 2 - 2.5, t + 1.25], [38.1, 2.54, 2.5]), box([6, -w / 2 + 2.5, t + 1.25], [38.1, 2.54, 2.5]), box([l / 2 - 3, 0, t + 1.25], [6, 7.5, 2.5]),
  ],
  screw: ({ d, len, hd, hk }) => [cyl([0, 0, len / 2], d, len), cyl([0, 0, len + hk / 2], hd, hk), hole([0, 0, len + hk], hd * 0.5, hk)],
  // gearbox with an output-shaft hole across y, motor can, rear cap; lies along x
  gearmotor: ({ len, w, h }) => [
    box([-len / 2 + 18.5, 0, h / 2], [37, w, h]), cyl([-len / 2 + 37 + 11.5, 0, h / 2], 15.5, 23, [0, 90, 0]), cyl([len / 2 - 3, 0, h / 2], 12, 6, [0, 90, 0]),
    hole([-len / 2 + 9, 0, h / 2], 5.4, w + 2, [90, 0, 0]),
  ],
  // N20-style: square-ish body, D shaft out of the -x end
  microgear: ({ len, w, h, shaft, shaftL }) => [box([len / 2, 0, h / 2], [len, w, h]), cyl([-shaftL / 2, 0, h / 2], shaft, shaftL, [0, 90, 0])],
};

export const partShapes = (part: Part): Shape[] => BUILD[part.class](part.p);

const cache = new Map<string, Float32Array | null>();
/** The closed triangle mesh (mm) of a part, or null if CSG could not close it. Cached per part. */
export function partMesh(part: Part): Float32Array | null {
  if (!cache.has(part.id)) {
    let m: Float32Array | null = null;
    try { m = buildMesh(partShapes(part)); } catch { m = null; }
    cache.set(part.id, m);
  }
  return cache.get(part.id)!;
}

// the title block is about 34 characters wide: drop the parenthetical and the 'plus ...' tail, then cut at the first comma if still long
const fit = (v: string) => { const s = v.replace(/ \(.*\)$/, '').replace(/,? plus .*$/, ''); return s.length > 34 ? s.split(', ')[0] : s; };

/** Title-block rows for a part's blueprint: standard dimensions only (no weight, layers or bed). */
export const partReference = (part: Part): BlueprintReference => ({
  rows: [['TYPE', 'Reference model'], ['ACCURACY', part.accuracy === 'sourced' ? 'Standard / sourced' : 'Typical, not a product'], ...part.specs.filter((x) => x.dim).map((x): [string, string] => [x.label.toUpperCase(), fit(x.value)])],
  notes: REFERENCE_BADGE.split(' — ').map((l) => `${l}.`.replace('..', '.')),
});

export function partBlueprint(part: Part): string | null {
  const m = partMesh(part);
  return m && blueprint(m, { name: part.title, id: part.id, material: 'n/a', reference: partReference(part) });
}

/** A small 2D silhouette of the model (oblique view) as an SVG path in a 0..100 box, for thumbnails. No WebGL. */
export const partThumb = (part: Part) => meshThumb(partMesh(part));

/** The same silhouette for any triangle mesh (cart thumbnails of templates, shop items and kit parts). */
export function meshThumb(m: Float32Array | null): { d: string; vb: string } | null {
  if (!m) return null;
  const c = Math.cos(Math.PI / 6), pts: [number, number][] = [];
  for (let i = 0; i + 2 < m.length; i += 3) pts.push([(m[i] - m[i + 1]) * c, -(m[i + 2] + (m[i] + m[i + 1]) * 0.5 * 0.58)]);
  const b = bounds(pts.flat()), k = 90 / Math.max(b.size.x, b.size.y, 1e-6);
  const ox = 50 - ((b.min[0] + b.max[0]) / 2) * k, oy = 50 - ((b.min[1] + b.max[1]) / 2) * k;
  let d = '';
  for (let i = 0; i + 2 < pts.length; i += 3) d += `M${pts.slice(i, i + 3).map(([x, y]) => `${(x * k + ox).toFixed(1)} ${(y * k + oy).toFixed(1)}`).join('L')}Z`;
  return { d, vb: '0 0 100 100' };
}
