// Pure: triangle soup (xyz per vertex, mm, Z up) -> blueprint sheet SVG. No three.js, no DOM.
// ponytail: no hidden-line removal and no per-feature dimensions in v1; every feature edge and silhouette is drawn.
import { BED_MM, FILL_FACTOR, MATERIALS, fitsBed, meshStats, quote, type MaterialKey, type Size } from './quote.ts';
import { LAYER_MM } from './printSpec.ts';

export const CREASE_DEG = 30;
// Plain colours, no CSS variables, so the sheet renders the same in any SVG engine. Print swaps to the light set.
const NAVY = { paper: '#0b1f3a', ink: '#dbe8ff', soft: '#7f9cc9', grid: '#16315a' };
const PAPER = { paper: '#ffffff', ink: '#0b1f3a', soft: '#5b6f91', grid: '#dfe6f1' };
const css = (c: typeof NAVY) => `.bp .p{fill:${c.paper}}.bp .g{stroke:${c.grid}}.bp .m{fill:${c.ink}}.bp .v,.bp .d{stroke:${c.ink}}.bp .e{stroke:${c.soft}}.bp text{fill:${c.ink}}.bp .tk{fill:${c.soft}}`;
const NOTE = 'Not a tolerance guarantee.';

type V3 = [number, number, number];
type Seg = [V3, V3];

export function blueprintData(positions: ArrayLike<number>, material: string) {
  const stats = meshStats(positions);
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) for (let d = 0; d < 3; d++) {
    min[d] = Math.min(min[d], positions[i + d]);
    max[d] = Math.max(max[d], positions[i + d]);
  }
  const size: Size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  // the modelled pose (Z up) when it fits, else the lowest axis-aligned pose that fits. Laying a part down to save
  // layers is a print decision (supports, strength), not one to make for the customer: a pawn must not lie on its side.
  const [a, b, c] = [size.x, size.y, size.z];
  const poses = [[a, b, c], [b, a, c], [a, c, b], [c, a, b], [b, c, a], [c, b, a]].filter(([x, y, z]) => x <= BED_MM.x && y <= BED_MM.y && z <= BED_MM.z);
  const pose = poses[0]?.[2] === c ? poses[0] : poses.sort((p, q) => p[2] - q[2])[0] ?? null;
  const asModelled = !!pose && Math.abs(pose[2] - size.z) < 0.01;
  const mat = Object.hasOwn(MATERIALS, material) ? (material as MaterialKey) : null;
  return {
    min, max, size, stats, triangles: Math.floor(positions.length / 9), fits: fitsBed(size),
    grams: stats && mat ? quote(stats, mat, 1).grams : null,
    layers: pose ? Math.round(pose[2] / LAYER_MM) : null,
    orientation: !pose ? 'Does not fit the bed' : asModelled ? 'Flat base on the bed (Z up)' : `Re-orient to ${pose.map((v) => v.toFixed(1)).join(' × ')} mm`,
  };
}

/** Feature edges (crease over CREASE_DEG, open edges) plus silhouettes for each of the three view directions. */
function edges(p: ArrayLike<number>) {
  const q = (v: number) => Math.round(v * 1000);
  const verts = new Map<string, V3>();
  const id = (k: number) => { const r: V3 = [p[k], p[k + 1], p[k + 2]]; const key = r.map(q).join(','); if (!verts.has(key)) verts.set(key, r); return key; };
  const map = new Map<string, { s: Seg; n: V3[] }>();
  for (let i = 0; i + 8 < p.length; i += 9) {
    const k = [id(i), id(i + 3), id(i + 6)];
    const [a, b, c] = k.map((x) => verts.get(x)!);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n);
    if (!l) continue;
    const nn: V3 = [n[0] / l, n[1] / l, n[2] / l];
    for (const [e, f] of [[0, 1], [1, 2], [2, 0]]) {
      const [ka, kb] = k[e] < k[f] ? [k[e], k[f]] : [k[f], k[e]];
      const key = `${ka}|${kb}`, r = map.get(key);
      if (r) r.n.push(nn); else map.set(key, { s: [verts.get(ka)!, verts.get(kb)!], n: [nn] });
    }
  }
  const cos = Math.cos((CREASE_DEG * Math.PI) / 180);
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const dirs: V3[] = [[0, 0, 1], [0, 1, 0], [1, 0, 0]]; // top, front (looking +Y), right (looking -X)
  const out: Seg[][] = [[], [], []];
  for (const { s, n } of map.values()) {
    const crease = n.length !== 2 || dot(n[0], n[1]) < cos;
    dirs.forEach((d, v) => {
      if (crease || (n.length === 2 && dot(n[0], d) * dot(n[1], d) < 0)) out[v].push(s);
    });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (n: number) => n.toFixed(1);

export function blueprint(positions: ArrayLike<number>, o: { name: string; id?: string; material: string }): string {
  const D = blueprintData(positions, o.material);
  const { size: s, min } = D;
  const k = Math.min(440 / (s.x + s.y), 320 / (s.y + s.z)); // px per mm
  const w = s.x * k, d = s.y * k, h = s.z * k;
  const tx = 74, ty = 84, fy = ty + d + 78, sx = tx + w + 76, base = fy + h;
  const L = (x1: number, y1: number, x2: number, y2: number, c: string) => `<line class="${c}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  const T = (x: number, y: number, t: string, c = 't', a = 'middle', extra = '') => `<text class="${c}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${a}" ${extra}>${esc(t)}</text>`;
  const arr = (x1: number, y1: number, x2: number, y2: number) => `<line class="d" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" marker-start="url(#bp-ar)" marker-end="url(#bp-ar)"/>`;
  const dimH = (x1: number, x2: number, y: number, from: number, t: string) => L(x1, from, x1, y + (y < from ? -4 : 4), 'e') + L(x2, from, x2, y + (y < from ? -4 : 4), 'e') + arr(x1, y, x2, y) + T((x1 + x2) / 2, y - 4, t);
  const dimV = (y1: number, y2: number, x: number, from: number, t: string) => L(from, y1, x + (x < from ? -4 : 4), y1, 'e') + L(from, y2, x + (x < from ? -4 : 4), y2, 'e') + arr(x, y1, x, y2) + T(x - 4, (y1 + y2) / 2, t, 't', 'middle', `transform="rotate(-90 ${(x - 4).toFixed(2)} ${((y1 + y2) / 2).toFixed(2)})"`);

  // projections: [horizontal, vertical-up, origin x, baseline y]
  const proj = [
    { a: 0, b: 1, ox: tx, oy: ty + d, name: 'TOP' },
    { a: 0, b: 2, ox: tx, oy: base, name: 'FRONT' },
    { a: 1, b: 2, ox: sx, oy: base, name: 'RIGHT' },
  ];
  let g = '';
  const E = edges(positions);
  proj.forEach((v, i) => {
    const seen = new Set<string>();
    let body = '';
    for (const [p0, p1] of E[i]) {
      const x1 = v.ox + (p0[v.a] - min[v.a]) * k, y1 = v.oy - (p0[v.b] - min[v.b]) * k;
      const x2 = v.ox + (p1[v.a] - min[v.a]) * k, y2 = v.oy - (p1[v.b] - min[v.b]) * k;
      if (Math.hypot(x2 - x1, y2 - y1) < 0.05) continue; // edge points along the view direction
      const key = [x1, y1, x2, y2].map((n) => n.toFixed(1)).join(',');
      const rev = [x2, y2, x1, y1].map((n) => n.toFixed(1)).join(',');
      if (seen.has(key) || seen.has(rev)) continue;
      seen.add(key);
      body += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    g += `<path class="v" d="${body}"/>` + T(v.ox, v.oy - (v.b === 1 ? d : h) - (i ? 12 : 46), v.name, 'tt', 'start');
  });
  g += dimH(tx, tx + w, ty - 22, ty, f1(s.x)) + dimV(ty, ty + d, tx - 24, tx, f1(s.y));
  g += dimV(fy, base, tx - 24, tx, f1(s.z)) + dimH(sx, sx + d, base + 26, base, f1(s.y));
  g += arr(sx + d / 2, base + 62, sx + d / 2, base + 40).replace(' marker-start="url(#bp-ar)"', '') + T(sx + d / 2 + 8, base + 58, 'build direction, base on bed', 't', 'start');

  const mat = D.grams == null ? o.material : `${o.material}, fill factor ${FILL_FACTOR}`;
  const rows: [string, string][] = [
    ['PART', o.name], ['ITEM', o.id ?? 'custom'], ['MATERIAL', mat],
    ['BOUNDS', `${f1(s.x)} × ${f1(s.y)} × ${f1(s.z)} mm`],
    ['VOLUME', D.stats ? `${D.stats.volumeCm3.toFixed(2)} cm³` : 'n/a (open mesh)'],
    ['WEIGHT', D.grams == null ? 'n/a' : `${f1(D.grams)} g est.`],
    ['LAYERS', D.layers == null ? 'n/a' : `${D.layers} at ${LAYER_MM} mm (assumed)`],
    ['MESH', `${D.triangles.toLocaleString('en-US')} triangles${D.stats ? ', closed' : ', open'}`],
    ['ORIENTATION', D.orientation],
    ['FITS BED', `${D.fits ? 'Yes' : 'No'}, bed ${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`],
  ];
  const bx = sx + d + 40, by = 34, bw = 330;
  g += `<rect class="v" x="${bx}" y="${by}" width="${bw}" height="${rows.length * 22 + 8}"/>`;
  rows.forEach(([a, b], i) => { const y = by + 20 + i * 22; g += T(bx + 10, y, a, 'tk', 'start') + T(bx + 104, y, b, 't', 'start') + (i ? L(bx, y - 15, bx + bw, y - 15, 'e') : ''); });
  ['All dimensions in mm. Third-angle projection.', 'Drawn from the mesh used for pricing.', NOTE].forEach((t, i) => { g += T(bx, by + rows.length * 22 + 26 + i * 15, t, 'tk', 'start'); });
  const VW = bx + bw + 16, VH = Math.max(base + 80, by + rows.length * 22 + 80);
  return `<svg class="bp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(VW)} ${Math.round(VH)}" role="img" aria-label="${esc(`Engineering drawing of ${o.name}: top, front and right views with dimensions in millimetres`)}">
<defs><pattern id="bp-gr" width="15" height="15" patternUnits="userSpaceOnUse"><path class="g" d="M15 0H0V15" fill="none" stroke-width="1"/></pattern>
<marker id="bp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m" d="M0 1.5L9 5L0 8.5z"/></marker>
<style>${css(NAVY)}@media print{${css(PAPER)}}
.bp .v{fill:none;stroke-width:1.2;stroke-linecap:round}.bp .d{stroke-width:.8}.bp .e{stroke-width:.6}
.bp text{font-family:ui-monospace,Menlo,Consolas,monospace}.bp .t{font-size:11px}.bp .tt{font-size:11px;letter-spacing:.14em;font-weight:500}.bp .tk{font-size:9.5px;letter-spacing:.06em}</style></defs>
<rect class="p" width="100%" height="100%"/><rect width="100%" height="100%" fill="url(#bp-gr)"/><rect class="v" x="8" y="8" width="${Math.round(VW) - 16}" height="${Math.round(VH) - 16}"/>${g}</svg>`;
}
