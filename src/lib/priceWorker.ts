// Worker thread of priceBuild.ts: builds one job at a time and replies with its MeshStats.
import { parentPort } from 'node:worker_threads';
import { buildStats, type Job } from './priceBuild.ts';

parentPort!.on('message', async (job: Job) => {
  try { parentPort!.postMessage({ stats: await buildStats(job) }); }
  catch (e) { parentPort!.postMessage({ error: e instanceof Error ? e.message : String(e) }); }
});
parentPort!.postMessage({ ready: true });
