// buildMesh in a Web Worker so a big design cannot freeze the tab; falls back to the main thread if workers are unavailable. Browser only.
// template: run templateMesh (buildMesh with its retry nudges) instead, for shop templates.
import { buildMesh, type Shape } from './playground.ts';
import type { Cfg } from './templateDefs.ts';

export function buildOffThread(shapes: Shape[], template = false): Promise<Float32Array | null> {
  return new Promise((resolve, reject) => {
    const direct = () => (template ? import('./templates.ts').then((m) => m.templateMesh(shapes)) : Promise.resolve().then(() => buildMesh(shapes))).then(resolve, reject);
    let w: Worker;
    try { w = new Worker(new URL('./playground.worker.ts', import.meta.url)); } catch { void direct(); return; }
    w.onmessage = (e: MessageEvent<{ tris?: Float32Array | null; error?: string }>) => {
      w.terminate();
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.tris ?? null);
    };
    w.onerror = () => { w.terminate(); void direct(); };
    w.postMessage({ shapes, template });
  });
}

/** The print mesh of one printed part of a kit (src/lib/kits/adapt.ts), built or loaded in the worker; main thread if workers are unavailable. */
export function kitMeshOffThread(key: string, cfg: Cfg): Promise<Float32Array | null> {
  return new Promise((resolve, reject) => {
    const direct = () => import('./kits/adapt.ts').then((m) => m.kitPartMesh(key, cfg)).then(resolve, reject);
    let w: Worker;
    try { w = new Worker(new URL('./playground.worker.ts', import.meta.url)); } catch { void direct(); return; }
    w.onmessage = (e: MessageEvent<{ tris?: Float32Array | null; error?: string }>) => {
      w.terminate();
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.tris ?? null);
    };
    w.onerror = () => { w.terminate(); void direct(); };
    w.postMessage({ kit: { key, cfg } });
  });
}
