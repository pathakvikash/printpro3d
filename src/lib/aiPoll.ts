// One poll of an AI generation job: asks Meshy, and when the model is ready downloads the STL into the store. Server only.
// Shared by GET /api/generate/[id] (the website) and the Orrery MCP job_status tool.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { MeshyError, downloadTo, getTask } from './meshy.ts';
import { markReady, readJob, recordDownloadFailure, updateJob, type Job } from './aiJobs.ts';
import { parseStl } from './stlScale.ts';
import { del, putBytes } from './store.ts';

export type Poll = { state: 'working'; progress?: number } | { state: 'ready'; file: string } | { state: 'failed'; message: string };

// ponytail: in-process guard so two polls cannot download the same job twice; a second server instance needs a DB lock
const downloading = new Map<string, Promise<string>>();

async function fetchStl(id: string, stlUrl: string): Promise<string> {
  const name = `${Date.now()}-${crypto.randomUUID()}.stl`; // same scheme as /api/upload
  const tmp = await mkdtemp(path.join(tmpdir(), 'ai-stl-')); // scratch space; the store gets the finished copy
  try {
    const dest = path.join(tmp, name);
    await downloadTo(stlUrl, dest); // capped at 100MB, streamed to disk
    const buffer = await readFile(dest);
    parseStl(buffer);
    await putBytes('uploads', name, buffer);
  } catch (e) {
    await del('uploads', name).catch(() => {});
    await recordDownloadFailure(id); // after MAX_DOWNLOADS the job is failed, so polls stop downloading
    throw e;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  const file = await markReady(id, name);
  if (file !== name) {
    await del('uploads', name).catch(() => {}); // another poll stored its copy first
    if (file) return file;
    throw new Error('Job not found');
  }
  return name;
}

export async function pollJob(job: Job): Promise<Poll> {
  const failed = (message: string): Poll => ({ state: 'failed', message });
  if (job.state === 'ready' && job.file) return { state: 'ready', file: job.file }; // finished jobs cost one store read
  if (job.state === 'failed') return failed(job.message ?? 'Generation failed');

  try {
    const t = await getTask(job.kind, job.meshyId);
    if (t.state === 'pending' || t.state === 'working') return { state: 'working', progress: t.progress };
    if (t.state === 'failed') {
      const message = t.error ?? 'Generation failed';
      await updateJob(job.id, (j) => { j.state = 'failed'; j.message = message; });
      return failed(message);
    }
    if (!t.stlUrl) throw new Error('No STL in result');
    let p = downloading.get(job.id);
    if (!p) {
      p = fetchStl(job.id, t.stlUrl).finally(() => downloading.delete(job.id));
      downloading.set(job.id, p);
    }
    return { state: 'ready', file: await p };
  } catch (e) {
    console.error('Generate poll failed:', e instanceof Error ? e.message : e);
    // a network blip or Meshy 5xx: keep the job working so the next poll retries
    if (e instanceof MeshyError && e.status >= 400 && e.status < 500 && e.status !== 429) {
      const message = 'We could not get your model. Please try again.';
      await updateJob(job.id, (j) => { j.state = 'failed'; j.message = message; });
      return failed(message);
    }
    // fetchStl may have just failed the job for good: say so now, rather than 'working' until the next poll
    const cur = await readJob(job.id);
    if (cur?.state === 'failed') return failed(cur.message ?? 'Generation failed');
    return { state: 'working', progress: 0 };
  }
}
