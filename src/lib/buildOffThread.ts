// Meshes for the browser: first the build-time cache (public/models/built, scripts/precompute-meshes.ts: a fetch, no CSG), else a small
// long-lived pool of Web Workers running buildMesh / templateMesh / kitPartMesh so a big design cannot freeze the tab. Browser only.
// The cache (src/lib/meshCache.ts) and this file stay free of three: the heavy modules load only in the workers or the main-thread fallback.
import type { Shape } from './playground.ts'; // type only: playground.ts pulls three and the CSG, so the main-thread fallback imports it on demand
import type { Cfg } from './templateDefs.ts';
import { builtMesh, kitKey, shapesKey } from './meshCache.ts';

type Job = { msg: { shapes?: Shape[]; template?: boolean; kit?: { key: string; cfg: Cfg } }; direct: () => Promise<Float32Array | null>; resolve: (m: Float32Array | null) => void; reject: (e: Error) => void };
type Slot = { w: Worker; job: Job | null };

const MAX = () => Math.max(1, Math.min((typeof navigator === 'undefined' ? 2 : navigator.hardwareConcurrency || 2) - 1, 4));
const slots: Slot[] = [];
const queue: Job[] = [];
let noWorkers = false;

function pump() {
  while (queue.length) {
    if (noWorkers) { const j = queue.shift()!; j.direct().then(j.resolve, j.reject); continue; }
    let s = slots.find((x) => !x.job);
    if (!s && slots.length < MAX()) {
      try {
        const w = new Worker(new URL('./playground.worker.ts', import.meta.url));
        s = { w, job: null };
        const slot = s;
        w.onmessage = (e: MessageEvent<{ tris?: Float32Array | null; error?: string }>) => {
          const j = slot.job; slot.job = null;
          if (j) { if (e.data.error) j.reject(new Error(e.data.error)); else j.resolve(e.data.tris ?? null); }
          pump();
        };
        w.onerror = () => { // the worker is gone: its job runs on the main thread, the slot is dropped
          const j = slot.job; slot.job = null;
          w.terminate(); slots.splice(slots.indexOf(slot), 1);
          if (j) j.direct().then(j.resolve, j.reject);
          pump();
        };
        slots.push(s);
      } catch { noWorkers = true; continue; }
    }
    if (!s) return; // all busy: the next reply pumps again
    s.job = queue.shift()!;
    s.w.postMessage(s.job.msg);
  }
}

const run = (key: string, msg: Job['msg'], direct: Job['direct']): Promise<Float32Array | null> =>
  builtMesh(key).then((hit) => hit ?? new Promise<Float32Array | null>((resolve, reject) => { queue.push({ msg, direct, resolve, reject }); pump(); }));

export function buildOffThread(shapes: Shape[], template = false): Promise<Float32Array | null> {
  // template: run templateMesh (buildMesh with its retry nudges) instead, for shop templates
  return run(shapesKey(shapes, template), { shapes, template }, () => (template ? import('./templates.ts').then((m) => m.templateMesh(shapes)) : import('./playground.ts').then((m) => m.buildMesh(shapes))));
}

/** The print mesh of one printed part of a kit (src/lib/kits/adapt.ts), built or loaded in the worker; main thread if workers are unavailable. */
export async function kitMeshOffThread(key: string, cfg: Cfg): Promise<Float32Array | null> {
  return run(kitKey(key, cfg), { kit: { key, cfg } }, () => import('./kits/adapt.ts').then((m) => m.kitPartMesh(key, cfg)));
}
