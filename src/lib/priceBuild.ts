// The CSG rebuild behind a price (kit part, template), server only. A valid config can make the CSG kernel run for minutes or never return
// (seen: transformer-kit:arm, clearance 0.25, magnets off), and a sync build in the request cannot be interrupted, so the order would die at the
// function limit. runBuild() therefore runs builds in one worker thread, one at a time, and terminates it when the order's deadline passes.
// If workers cannot start (bundler, platform) it falls back to building in-process: still correct, but with no time limit.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { kitPartMesh } from './kits/adapt.ts';
import { meshStats, type MeshStats } from './quote.ts';
import { priceTemplate } from './templates.ts';
import type { Cfg } from './templateDefs.ts';

export type Job = { kit: string; cfg: Cfg } | { tpl: string; cfg: Cfg };
export class BuildTimeout extends Error {}

/** Builds in this thread. null = no closed mesh; throws when the builder or kernel throws (a template that does not fit the bed throws too). */
export async function buildStats(job: Job): Promise<MeshStats | null> {
  if ('tpl' in job) return priceTemplate(job.tpl, job.cfg, 1).stats;
  // the file name comes from the kit file, never from the request; resolve it under public/ anyway
  const read = async (file: string) => { const b = await readFile(path.join(process.cwd(), 'public', path.normalize(file).replace(/^(\.\.[\\/])+/, ''))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
  const mesh = await kitPartMesh(job.kit, job.cfg, read);
  return mesh ? meshStats(mesh) : null;
}

type Reply = { ready?: true; stats?: MeshStats | null; error?: string };
let worker: { w: Worker; ready: boolean } | null | undefined; // undefined: not started, null: unavailable here
let queue: Promise<unknown> = Promise.resolve();

function start() {
  if (worker !== undefined || process.env.PRICE_WORKER === '0') return;
  try {
    const w = new Worker(new URL('./priceWorker.ts', import.meta.url));
    w.unref();
    worker = { w, ready: false };
  } catch {
    worker = null;
  }
}

function once(job: Job, deadline?: number): Promise<MeshStats | null> {
  start();
  if (!worker) return buildStats(job);
  const cur = worker;
  return new Promise((resolve, reject) => {
    const kill = () => { cur.w.terminate().catch(() => {}); if (worker === cur) worker = undefined; };
    const timer = deadline === undefined ? null : setTimeout(() => { kill(); reject(new BuildTimeout()); }, Math.max(0, deadline - Date.now()));
    const end = () => { if (timer) clearTimeout(timer); cur.w.off('message', onMsg); cur.w.off('error', onErr); };
    const onMsg = (m: Reply) => {
      if (m.ready) { cur.ready = true; return; }
      end();
      if (m.error !== undefined) reject(new Error(m.error)); else resolve(m.stats ?? null);
    };
    const onErr = (e: Error) => {
      end(); kill();
      if (cur.ready) reject(e); // the worker died while building (out of memory...): a failed build
      else { worker = null; buildStats(job).then(resolve, reject); } // it never started: build here
    };
    cur.w.on('message', onMsg);
    cur.w.on('error', onErr);
    cur.w.postMessage(job);
  });
}

/** One build at a time (CSG peaks near 500 MB). Rejects with BuildTimeout when `deadline` (epoch ms) passes first. */
export function runBuild(job: Job, deadline?: number): Promise<MeshStats | null> {
  const p = queue.then(() => once(job, deadline));
  queue = p.catch(() => {});
  return p;
}
