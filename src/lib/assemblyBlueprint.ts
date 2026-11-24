// Pure: a kit's assembly() parts + their triangle soups -> one assembly drawing (SVG string) with top/front/right views,
// numbered balloons and a bill of materials. No three.js, no DOM. Bought parts are dashed and drawn from `ref` (reference
// 3D models) or as a box/cylinder placeholder of their size.
// ponytail: no hidden-line removal (every part's edges are drawn); balloon leaders end at the part's front-view centre.
import { MATERIALS, meshStats, quote, type MaterialKey } from './quote.ts';
import { NAVY, PAPER, bounds, css, edges, esc, f1 } from './blueprint.ts';
import type { AssemblyPart, V3 } from './assembly.ts';

type Soup = ArrayLike<number>;
/** Triangle soups (mm, any origin) of the printed parts by their geometry key (the template id). */
export type MeshMap = Record<string, Soup | null | undefined>;
/** Reference model (triangle soup) of a bought part, or null for a plain placeholder. */
export type BoughtRef = (p: AssemblyPart) => Soup | null;
type Seg = [V3, V3];
type Placed = { part: AssemblyPart; key: string; sig: string; local: Float32Array; min: V3; max: V3; own: V3; cache: string };
export type BomRow = { no: number; key: string; name: string; qty: number; material: string; bought: boolean; size: V3; ids: string[] };

const RAD = Math.PI / 180;
/** Euler XYZ degrees (three.js order: Rx*Ry*Rz) applied to a vector. */
function rot(v: V3, [rx, ry, rz]: V3): V3 {
  let [x, y, z] = v;
  for (const [a, f] of [[rz, 0], [ry, 1], [rx, 2]] as const) {
    const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
    if (f === 0) [x, y] = [c * x - s * y, s * x + c * y];
    else if (f === 1) [x, z] = [c * x + s * z, -s * x + c * z];
    else [y, z] = [c * y - s * z, s * y + c * z];
  }
  return [x, y, z];
}

const BOX_TRIS = [[0, 2, 3], [0, 3, 1], [4, 5, 7], [4, 7, 6], [0, 1, 5], [0, 5, 4], [2, 6, 7], [2, 7, 3], [0, 4, 6], [0, 6, 2], [1, 3, 7], [1, 7, 5]];
function boxSoup([x, y, z]: V3): Float32Array {
  const v = (i: number) => [(i & 1 ? 1 : -1) * x / 2, (i & 2 ? 1 : -1) * y / 2, (i & 4 ? 1 : -1) * z / 2];
  return Float32Array.from(BOX_TRIS.flatMap((t) => t.flatMap(v)));
}
function cylSoup([d, , h]: V3, n = 24): Float32Array {
  const out: number[] = [], r = d / 2, hz = h / 2;
  const p = (j: number, z: number) => [r * Math.cos((j * 2 * Math.PI) / n), r * Math.sin((j * 2 * Math.PI) / n), z];
  for (let j = 0; j < n; j++) {
    const [b0, b1, t0, t1] = [p(j, -hz), p(j + 1, -hz), p(j, hz), p(j + 1, hz)];
    out.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0, 0, 0, hz, ...t0, ...t1, 0, 0, -hz, ...b1, ...b0);
  }
  return Float32Array.from(out);
}

/** The soup centred on its bounding box, rotated about that centre. */
function centred(m: Soup, r: V3): { local: Float32Array; own: V3 } {
  const b = bounds(m), c = b.min.map((v, i) => (v + b.max[i]) / 2) as V3, out = new Float32Array(m.length);
  for (let i = 0; i + 2 < m.length; i += 3) out.set(rot([m[i] - c[0], m[i + 1] - c[1], m[i + 2] - c[2]], r), i);
  return { local: out, own: [b.size.x, b.size.y, b.size.z] };
}

const keyOf = (p: AssemblyPart) => p.bought ? `b:${p.label}|${p.size.join('x')}|${p.shape ?? 'box'}` : `p:${typeof p.geometry === 'string' ? p.geometry : p.label}`;

/** Everything the drawing needs, without the SVG: placed parts, overall bounds (union of the parts'), the BOM, printed totals. */
export function assemblyData(parts: AssemblyPart[], meshes: MeshMap, ref?: BoughtRef) {
  const placed: Placed[] = parts.map((part) => {
    const key = keyOf(part), g = typeof part.geometry === 'string' ? meshes[part.geometry] : null;
    let m: Soup | null | undefined = part.bought ? ref?.(part) : g;
    let pre: V3 = [0, 0, 0];
    if (part.bought && m) { // a reference model may lie along the other horizontal axis: pick the turn that matches the placeholder's footprint
      const b = bounds(m), [sx, sy] = part.size;
      if (Math.abs(b.size.x - sx) + Math.abs(b.size.y - sy) > Math.abs(b.size.y - sx) + Math.abs(b.size.x - sy)) pre = [0, 0, 90];
    }
    if (!m) m = part.bought && part.shape === 'cylinder' ? cylSoup(part.size) : boxSoup(part.size);
    const { local, own } = centred(m, pre);
    const turned = centred(local, part.rotation).local; // part rotation about its centre
    const b = bounds(turned), pos = part.position;
    return { part, key, sig: `${key}|${part.rotation.join(',')}`, local: turned, own, cache: `${part.bought ? 'b' : 'p'}|${key}|${part.rotation.join(',')}|${pre[2]}`,
      min: [b.min[0] + pos[0], b.min[1] + pos[1], b.min[2] + pos[2]], max: [b.max[0] + pos[0], b.max[1] + pos[1], b.max[2] + pos[2]] };
  });
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of placed) for (let d = 0; d < 3; d++) { min[d] = Math.min(min[d], p.min[d]); max[d] = Math.max(max[d], p.max[d]); }
  const rows = new Map<string, BomRow>();
  for (const p of placed) {
    const r = rows.get(p.key);
    if (r) { r.qty++; r.ids.push(p.part.id); } else rows.set(p.key, { no: 0, key: p.key, name: p.part.label, qty: 1, material: p.part.bought ? 'Bought' : p.part.material, bought: !!p.part.bought, size: p.own, ids: [p.part.id] });
  }
  const bom = [...rows.values()].sort((a, b) => Number(a.bought) - Number(b.bought)).map((r, i) => ({ ...r, no: i + 1 }));
  let cm3 = 0, grams = 0, pieces = 0, open = 0;
  for (const p of placed) {
    if (p.part.bought) continue;
    pieces++;
    const st = meshStats(p.local);
    if (!st) { open++; continue; }
    cm3 += st.volumeCm3;
    if (Object.hasOwn(MATERIALS, p.part.material)) grams += quote(st, p.part.material as MaterialKey, 1).grams;
  }
  return { placed, bom, bounds: { min, max, size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] } }, printed: { pieces, cm3, grams, open }, bought: placed.length - pieces };
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function assemblyBlueprint(parts: AssemblyPart[], meshes: MeshMap, o: { name: string; ref?: BoughtRef; plates?: boolean }): string {
  const D = assemblyData(parts, meshes, o.ref);
  const { min, size: s } = D.bounds;
  const k = Math.min(520 / (s.x + s.y), 360 / (s.y + s.z)); // px per mm
  const w = s.x * k, d = s.y * k, h = s.z * k;
  const n = D.bom.length, rowW = Math.max(w, n * 30);
  const tx = 74, ty = 84, fy = ty + d + 140, sx = tx + Math.max(w, rowW) + 76, base = fy + h, cy = fy - 76;
  const L = (x1: number, y1: number, x2: number, y2: number, c: string) => `<line class="${c}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  const T = (x: number, y: number, t: string, c = 't', a = 'middle', extra = '') => `<text class="${c}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${a}" ${extra}>${esc(t)}</text>`;
  const arr = (x1: number, y1: number, x2: number, y2: number) => `<line class="d" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" marker-start="url(#bp-ar)" marker-end="url(#bp-ar)"/>`;
  const dimH = (x1: number, x2: number, y: number, from: number, t: string) => L(x1, from, x1, y + (y < from ? -4 : 4), 'e') + L(x2, from, x2, y + (y < from ? -4 : 4), 'e') + arr(x1, y, x2, y) + T((x1 + x2) / 2, y - 4, t);
  const dimV = (y1: number, y2: number, x: number, from: number, t: string) => L(from, y1, x + (x < from ? -4 : 4), y1, 'e') + L(from, y2, x + (x < from ? -4 : 4), y2, 'e') + arr(x, y1, x, y2) + T(x - 4, (y1 + y2) / 2, t, 't', 'middle', `transform="rotate(-90 ${(x - 4).toFixed(2)} ${((y1 + y2) / 2).toFixed(2)})"`);

  const proj = [{ a: 0, b: 1, ox: tx, oy: ty + d, name: 'TOP' }, { a: 0, b: 2, ox: tx, oy: base, name: 'FRONT' }, { a: 1, b: 2, ox: sx, oy: base, name: 'RIGHT' }];
  const cache = new Map<string, Seg[][]>(); // edges of a part at the origin; moving a part does not change them
  let g = '';
  proj.forEach((v, i) => {
    const seen = new Set<string>(), body = { p: '', b: '' };
    for (const pl of D.placed) {
      if (!cache.has(pl.cache)) cache.set(pl.cache, edges(pl.local));
      const pos = pl.part.position, bought = !!pl.part.bought;
      for (const [p0, p1] of cache.get(pl.cache)![i]) {
        const x1 = v.ox + (p0[v.a] + pos[v.a] - min[v.a]) * k, y1 = v.oy - (p0[v.b] + pos[v.b] - min[v.b]) * k;
        const x2 = v.ox + (p1[v.a] + pos[v.a] - min[v.a]) * k, y2 = v.oy - (p1[v.b] + pos[v.b] - min[v.b]) * k;
        if (Math.hypot(x2 - x1, y2 - y1) < 0.4) continue; // too short to see, or along the view direction
        const key = (bought ? 'b' : 'p') + [x1, y1, x2, y2].map((q) => q.toFixed(1)).join(','), rev = (bought ? 'b' : 'p') + [x2, y2, x1, y1].map((q) => q.toFixed(1)).join(',');
        if (seen.has(key) || seen.has(rev)) continue;
        seen.add(key);
        body[bought ? 'b' : 'p'] += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
    }
    g += (body.b ? `<path class="b" d="${body.b}"/>` : '') + (body.p ? `<path class="v" d="${body.p}"/>` : '') + T(v.ox, v.oy - (v.b === 1 ? d : h) - (i ? 12 : 46), v.name, 'tt', 'start');
  });
  g += dimH(tx, tx + w, ty - 22, ty, f1(s.x)) + dimV(ty, ty + d, tx - 24, tx, f1(s.y));
  g += dimV(fy, base, tx - 24, tx, f1(s.z)) + dimH(sx, sx + d, base + 26, base, f1(s.y));

  // balloons: one per distinct part, in a row above the front view, ordered by where the leader lands so leaders cross less
  const anchors = D.bom.map((r) => {
    const p = D.placed.find((q) => q.key === r.key)!, c = p.part.position;
    return { r, x: tx + (c[0] - min[0]) * k, y: base - (c[2] - min[2]) * k };
  }).sort((a, b) => a.x - b.x);
  anchors.forEach((a, i) => {
    const bx = tx + ((i + 0.5) * rowW) / n;
    g += L(bx, cy + 11, a.x, a.y, 'e') + `<circle class="m" cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="2"/><circle class="${a.r.bought ? 'b' : 'v'} bl" cx="${bx.toFixed(2)}" cy="${cy}" r="11"/>` + T(bx, cy + 3.5, String(a.r.no), 'tt', 'middle', 'style="letter-spacing:0"');
  });

  const mm3 = (z: V3) => `${f1(z[0])} × ${f1(z[1])} × ${f1(z[2])}`;
  const info: [string, string][] = [
    ['KIT', trunc(o.name, 34)], ['ENVELOPE', `${f1(s.x)} × ${f1(s.y)} × ${f1(s.z)} mm`],
    ['PRINTED', `${D.printed.pieces} pieces, ${D.printed.cm3.toFixed(1)} cm³${D.printed.open ? '+' : ''}, ${f1(D.printed.grams)} g est.`],
    ...(o.plates ? [] : [['BOUGHT', `${D.bought} pieces in ${D.bom.filter((r) => r.bought).length} kinds`] as [string, string]]),
  ];
  const bx = sx + d + 40, by = 34, bw = 440, rh = 20;
  let y = by;
  g += `<rect class="v" x="${bx}" y="${by}" width="${bw}" height="${info.length * 22 + 8}"/>`;
  info.forEach(([a, b], i) => { const yy = by + 20 + i * 22; g += T(bx + 10, yy, a, 'tk', 'start') + T(bx + 104, yy, b, 't', 'start') + (i ? L(bx, yy - 15, bx + bw, yy - 15, 'e') : ''); });
  y = by + info.length * 22 + 28;
  g += `<rect class="v" x="${bx}" y="${y}" width="${bw}" height="${(n + 1) * rh + 4}"/>`;
  [['No.', 10], ['Part', 40], ['Qty', 190], ['Material', 226], ['Size mm', 300]].forEach(([t, x]) => { g += T(bx + (x as number), y + 15, t as string, 'tk', 'start'); });
  D.bom.forEach((r, i) => {
    const yy = y + (i + 1) * rh + 15;
    g += L(bx, yy - 15, bx + bw, yy - 15, 'e') + T(bx + 10, yy, String(r.no), 't', 'start') + T(bx + 40, yy, trunc(r.name, 21), 't', 'start') + T(bx + 190, yy, String(r.qty), 't', 'start') + T(bx + 226, yy, r.material, 't', 'start') + T(bx + 300, yy, mm3(r.size), 't', 'start');
  });
  const ny = y + (n + 1) * rh + 24;
  (o.plates ? ['All dimensions in mm. Third-angle projection.', 'Print plate drawing: parts as printed, not assembled.'] : ['All dimensions in mm. Third-angle projection.', 'Assembly drawing — reference, not to scale for bought parts.', 'Dashed lines: bought parts, drawn at typical reference sizes.']).forEach((t, i) => { g += T(bx, ny + i * 15, t, 'tk', 'start'); });
  const VW = bx + bw + 16, VH = Math.max(base + 80, ny + 60);
  const bc = (c: typeof NAVY) => `.bp .b{stroke:${c.soft}}`;
  return `<svg class="bp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(VW)} ${Math.round(VH)}" role="img" aria-label="${esc(`${o.plates ? 'Print plate drawing' : 'Assembly drawing'} of ${o.name}: top, front and right views of every part with numbered balloons and a bill of materials`)}">
<defs><pattern id="bp-gr" width="15" height="15" patternUnits="userSpaceOnUse"><path class="g" d="M15 0H0V15" fill="none" stroke-width="1"/></pattern>
<marker id="bp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m" d="M0 1.5L9 5L0 8.5z"/></marker>
<style>${css(NAVY)}${bc(NAVY)}@media print{${css(PAPER)}${bc(PAPER)}}
.bp .v,.bp .b{fill:none;stroke-width:1.2;stroke-linecap:round}.bp .b{stroke-width:1;stroke-dasharray:4 3}.bp .bl{fill:none}.bp .d{stroke-width:.8}.bp .e{stroke-width:.6}
.bp text{font-family:ui-monospace,Menlo,Consolas,monospace}.bp .t{font-size:11px}.bp .tt{font-size:11px;letter-spacing:.14em;font-weight:500}.bp .tk{font-size:9.5px;letter-spacing:.06em}</style></defs>
<rect class="p" width="100%" height="100%"/><rect width="100%" height="100%" fill="url(#bp-gr)"/><rect class="v" x="8" y="8" width="${Math.round(VW) - 16}" height="${Math.round(VH) - 16}"/>${g}</svg>`;
}
