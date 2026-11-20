import { STLLoader, OBJLoader } from 'three-stdlib';
import type { Mesh, Object3D } from 'three';
import { meshStats, type MeshStats } from './quote.ts';

/** Server only. Returns null for unsupported formats or parse failures (manual quote). */
export function analyzeModel(buffer: Buffer, ext: string): MeshStats | null {
  try {
    if (ext === '.stl') {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      const g = new STLLoader().parse(ab);
      return meshStats(g.attributes.position.array, g.index?.array);
    }
    if (ext === '.obj') {
      // OBJLoader output is non-indexed, so concatenating positions gives summed volume and union bbox
      const parts: ArrayLike<number>[] = [];
      new OBJLoader().parse(buffer.toString('utf8')).traverse((o: Object3D) => {
        if ((o as Mesh).isMesh) parts.push((o as Mesh).geometry.attributes.position.array);
      });
      const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
      let off = 0;
      for (const p of parts) { all.set(p, off); off += p.length; }
      return meshStats(all);
    }
  } catch {}
  return null;
}
