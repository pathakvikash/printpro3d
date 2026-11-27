// AI generation jobs as JSON in the store ('ai-jobs'). Server only.
// ponytail: JSON files + in-process lock, same ceiling as orders/ — move to the DB with orders
import type { Kind } from './meshy.ts';
import { getJson, list, putJson } from './store.ts';

export type Job = {
  id: string;
  meshyId: string;
  kind: Exclude<Kind, 'repair'>;
  name: string;
  email: string;
  phone: string;
  prompt: string; // '(customer photo)' for image jobs
  createdAt: string;
  state: 'working' | 'failed' | 'ready';
  message?: string;
  file?: string; // our STL copy in the 'uploads' namespace, at Meshy's scale
  files: string[]; // every upload name made from this job (base + sized copies), for the order email
  repairTried?: boolean;
  repairedFile?: string; // repaired STL, stored in the 'ai-jobs' namespace
  owner?: { sub?: string; email?: string; guest?: string }; // who may read this job's files (see fileAccess.ts)
  downloadAttempts?: number; // failed downloads or STL checks of the result; the job fails after two
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const JOBS = 'ai-jobs';

export async function readJob(id: string): Promise<Job | null> {
  if (!UUID.test(id)) return null;
  return getJson<Job>(JOBS, `${id.toLowerCase()}.json`);
}

export async function writeJob(job: Job): Promise<void> {
  await putJson(JOBS, `${job.id.toLowerCase()}.json`, job);
}

const locks = new Map<string, Promise<unknown>>();
/** Read-modify-write one job without losing concurrent updates (single server process only). */
export function updateJob(id: string, fn: (j: Job) => void): Promise<Job | null> {
  const run = async () => {
    const j = await readJob(id);
    if (!j) return null;
    fn(j);
    await writeJob(j);
    return j;
  };
  const next = (locks.get(id) ?? Promise.resolve()).then(run, run);
  locks.set(id, next.catch(() => {}));
  return next;
}

/**
 * Test-and-set inside the job lock: true for exactly one caller, the one that runs the Meshy repair.
 * (Reading repairTried from a snapshot taken before the call would let parallel sizes all start a paid repair.)
 * ponytail: repairs are not counted in the usage ledger; a repair costs Meshy credits, so review this if it gets expensive.
 */
export async function claimRepair(id: string): Promise<boolean> {
  let mine = false;
  await updateJob(id, (j) => {
    if (!j.repairTried) {
      j.repairTried = true;
      mine = true;
    }
  });
  return mine;
}

/**
 * Reserves one sized-copy name in the job's files inside the lock. False when the job already has more than `max`
 * files (the base plus sized copies), the same limit the route used before. Release it with releaseCopy if the copy fails.
 */
export async function reserveCopy(id: string, file: string, max: number): Promise<boolean> {
  let ok = false;
  await updateJob(id, (j) => {
    if (j.files.length <= max) {
      j.files.push(file);
      ok = true;
    }
  });
  return ok;
}

export const releaseCopy = (id: string, file: string) =>
  updateJob(id, (j) => {
    j.files = j.files.filter((f) => f !== file);
  });

export const MAX_DOWNLOADS = 2; // failed downloads or bad STL files before the job is failed, so polls stop re-downloading

/** Counts one failed download or bad STL against the job; after MAX_DOWNLOADS it is marked failed. */
export async function recordDownloadFailure(id: string): Promise<void> {
  await updateJob(id, (j) => {
    if (j.state === 'ready') return;
    j.downloadAttempts = (j.downloadAttempts ?? 0) + 1;
    if (j.downloadAttempts >= MAX_DOWNLOADS) {
      j.state = 'failed';
      j.message = 'We could not read your model file. Please try again.';
    }
  });
}

/**
 * Stores a downloaded STL on the job unless one is already stored (two polls can race).
 * Returns the job's file: `name` if this call stored it, the earlier file otherwise, null if the job is gone.
 */
export async function markReady(id: string, name: string): Promise<string | null> {
  const after = await updateJob(id, (j) => {
    if (j.state === 'ready') return;
    j.state = 'ready';
    j.file = name;
    j.files.push(name);
  });
  return after?.file ?? null;
}

const queues = new Map<string, Promise<unknown>>();
/** Runs fn once earlier calls for the same job have finished, so sizes on one job run one at a time. */
// ponytail: process-local queue like updateJob's lock; a second server instance needs a DB lock
export function serialJob<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(id) ?? Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  queues.set(id, tail);
  void tail.then(() => {
    if (queues.get(id) === tail) queues.delete(id);
  });
  return run;
}

/** The job that produced this upload, if any. Scans the job list: fine at this volume. */
export async function findJobByFile(file: string): Promise<Job | null> {
  try {
    for (const n of await list(JOBS)) {
      if (!n.endsWith('.json')) continue;
      const j = await readJob(n.slice(0, -5));
      if (j?.files?.includes(file)) return j;
    }
  } catch {}
  return null;
}
