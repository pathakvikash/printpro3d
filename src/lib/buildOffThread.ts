// buildMesh in a Web Worker so a big design cannot freeze the tab; falls back to the main thread if workers are unavailable. Browser only.
import { buildMesh, type Shape } from './playground.ts';

export function buildOffThread(shapes: Shape[]): Promise<Float32Array | null> {
  return new Promise((resolve, reject) => {
    const direct = () => { try { resolve(buildMesh(shapes)); } catch (e) { reject(e); } };
    let w: Worker;
    try { w = new Worker(new URL('./playground.worker.ts', import.meta.url)); } catch { direct(); return; }
    w.onmessage = (e: MessageEvent<{ tris?: Float32Array | null; error?: string }>) => {
      w.terminate();
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.tris ?? null);
    };
    w.onerror = () => { w.terminate(); direct(); };
    w.postMessage(shapes);
  });
}
