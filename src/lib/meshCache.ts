// Build-time mesh cache (scripts/precompute-meshes.ts writes it, buildOffThread.ts reads it). Pure: no three, safe in any bundle.
// A mesh file is public/models/built/<key>.bin = the raw little-endian Float32 triangle positions the builders return (9 floats per triangle).
// The key hashes everything that decides the mesh (shapes or kit part + config, normalised), so a different config never hits a stale file.
import type { Shape } from './playground.ts';
import type { Cfg } from './templateDefs.ts';

export const BUILT_DIR = '/models/built';
export const MANIFEST_URL = `${BUILT_DIR}/manifest.json`;

/** 53-bit string hash (cyrb53) as 14 hex chars. */
export function hash(s: string): string {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(16).padStart(14, '0');
}

const r = (n: number) => Math.round(n * 1e4) / 1e4;
/** Key of a shape list. Ids are ignored (they come from counters) except the `late` prefix that orders the CSG. */
export const shapesKey = (shapes: Shape[], template: boolean) =>
  `s-${hash(JSON.stringify([template ? 1 : 0, shapes.map((s) => [s.id.startsWith('late') ? 1 : 0, s.kind, s.mode, [s.position.x, s.position.y, s.position.z].map(r), [s.rotation.x, s.rotation.y, s.rotation.z].map(r), [s.size.x, s.size.y, s.size.z].map(r)])]))}`;

/** Key of one printed kit part at a config (STL kits have the empty config). */
export const kitKey = (key: string, cfg: Cfg) =>
  `k-${hash(JSON.stringify([key, Object.fromEntries(Object.keys(cfg).sort().map((k) => [k, cfg[k]]))]))}`;

export const encodeMesh = (m: Float32Array): Uint8Array => new Uint8Array(m.buffer, m.byteOffset, m.byteLength);
export function decodeMesh(buf: ArrayBuffer): Float32Array | null {
  return buf.byteLength % 36 === 0 && buf.byteLength > 0 ? new Float32Array(buf.slice(0)) : null; // slice: the caller may transfer or reuse it
}

let manifest: Promise<Set<string>> | null = null;
/** The mesh from the build-time cache, or null when it is not there (not built, fetch failed, no browser): the caller builds it. */
export async function builtMesh(key: string): Promise<Float32Array | null> {
  try {
    // a failed manifest fetch is not cached: the next call retries
    manifest ??= fetch(MANIFEST_URL).then((x) => (x.ok ? x.json() : Promise.reject(new Error('no manifest')))).then((a: string[]) => new Set(a));
    const m = manifest;
    let set: Set<string>;
    try { set = await m; } catch { if (manifest === m) manifest = null; return null; }
    if (!set.has(key)) return null;
    const x = await fetch(`${BUILT_DIR}/${key}.bin`);
    return x.ok ? decodeMesh(await x.arrayBuffer()) : null;
  } catch { return null; }
}
