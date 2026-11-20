// Pure STL helpers: read binary or ASCII STL, scale uniformly, write binary STL. No three.js.

export type Tri = number[]; // 9 numbers: three vertices

function parseBinary(b: Buffer): Tri[] | null {
  if (b.length < 84) return null;
  const n = b.readUInt32LE(80);
  if (b.length !== 84 + n * 50) return null;
  const tris: Tri[] = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12; // skip the 12-byte normal
    const t: Tri = [];
    for (let k = 0; k < 9; k++) t.push(b.readFloatLE(o + k * 4));
    tris.push(t);
  }
  return tris;
}

function parseAscii(b: Buffer): Tri[] | null {
  const s = b.toString('latin1');
  if (!/^\s*solid\b/i.test(s)) return null;
  const nums: number[] = [];
  for (const m of s.matchAll(/^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)/gim)) nums.push(Number(m[1]), Number(m[2]), Number(m[3]));
  if (nums.length === 0 || nums.length % 9 !== 0) return null;
  const tris: Tri[] = [];
  for (let i = 0; i < nums.length; i += 9) tris.push(nums.slice(i, i + 9));
  return tris;
}

/** Triangles of a binary or ASCII STL. Throws on anything else. */
export function parseStl(b: Buffer): Tri[] {
  // a binary file can start with "solid", so the exact binary length check goes first
  const tris = parseBinary(b) ?? parseAscii(b);
  if (!tris || tris.length === 0) throw new Error('Not a valid STL file');
  if (tris.some((t) => t.some((v) => !Number.isFinite(v)))) throw new Error('STL has invalid coordinates');
  return tris;
}

export function longestSide(tris: Tri[]): number {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) {
    for (let k = 0; k < 9; k++) {
      const d = k % 3;
      if (t[k] < min[d]) min[d] = t[k];
      if (t[k] > max[d]) max[d] = t[k];
    }
  }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

/** Scale uniformly so the longest bounding-box side equals longestMm; returns a binary STL. */
export function scaleStl(b: Buffer, longestMm: number): Buffer {
  if (!Number.isFinite(longestMm) || longestMm <= 0) throw new Error('Invalid size');
  const tris = parseStl(b);
  const cur = longestSide(tris);
  if (!(cur > 0)) throw new Error('Model has no size');
  const k = longestMm / cur;
  const out = Buffer.alloc(84 + tris.length * 50);
  out.write('printpro3d scaled STL', 0, 'latin1');
  out.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => {
    const o = 84 + i * 50;
    const v = t.map((x) => Math.fround(x * k));
    // normal from the (scaled) winding; zero for degenerate triangles
    const u = [v[3] - v[0], v[4] - v[1], v[5] - v[2]];
    const w = [v[6] - v[0], v[7] - v[1], v[8] - v[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n.forEach((c, j) => out.writeFloatLE(c / len, o + j * 4));
    v.forEach((c, j) => out.writeFloatLE(c, o + 12 + j * 4));
  });
  return out;
}
