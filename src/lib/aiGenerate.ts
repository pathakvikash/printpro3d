// Starts one Meshy generation for one email: process guards, per-email daily quota, Meshy call, saved job. Server only.
// Shared by POST /api/generate (website) and the Orrery MCP generate_model tool (email = verified token sub).
import crypto from 'node:crypto';
import { takeUsage } from './aiGuard.ts';
import { MeshyError, createImageTask, createTextTask } from './meshy.ts';
import { writeJob, type Job } from './aiJobs.ts';

export type Start = { ok: true; id: string } | { ok: false; status: number; error: string };
export type StartArgs = { email: string; name: string; phone: string; mode: 'text' | 'image'; prompt?: string; dataUri?: string; owner?: Job['owner'] };
export type StartDeps = { take: typeof takeUsage; text: typeof createTextTask; image: typeof createImageTask; write: typeof writeJob };
const real: StartDeps = { take: takeUsage, text: createTextTask, image: createImageTask, write: writeJob };

const MAX_IN_FLIGHT = 4;
const inFlight = new Set<string>();
let active = 0;
const fail = (status: number, error: string): Start => ({ ok: false, status, error });

export async function startJob(a: StartArgs, d: StartDeps = real): Promise<Start> {
  // ponytail: process-local guard, one request per email and 4 at once per process (same as /api/design); move to a shared store if the app runs on several instances
  const who = a.email.trim().toLowerCase();
  if (inFlight.has(who)) return fail(429, 'Please wait for your current model to finish.');
  if (active >= MAX_IN_FLIGHT) return fail(503, 'AI generation is busy right now. Please try again in a minute.');

  // claimed before any await, so a second request for the same email cannot slip past the checks above
  inFlight.add(who);
  active++;

  let meshyId: string;
  try {
    // checks the limits and counts one use in one step; the use is NOT refunded if Meshy then fails (a failed call cannot be retried for free)
    const limit = await d.take(a.email);
    if (!limit.ok) {
      return fail(
        429,
        limit.scope === 'email'
          ? `You have reached the daily limit of ${limit.limit} AI models. Try again tomorrow, or use "I have an idea" and we will review it and send you a quote.`
          : 'We have reached our daily limit of AI models. Try again tomorrow, or use "I have an idea" and we will review it and send you a quote.'
      );
    }
    meshyId = a.mode === 'text' ? await d.text(a.prompt ?? '') : await d.image(a.dataUri ?? '');
  } catch (e) {
    const status = e instanceof MeshyError ? e.status : 0;
    console.error('Generate: Meshy create failed:', e instanceof Error ? e.message : e);
    if (status === 400 || status === 403) return fail(422, "We couldn't generate that. Try a different description or photo, or use \"I have an idea\".");
    if (status === 429) return fail(503, 'The generator is busy. Please try again in a few minutes.');
    return fail(503, 'AI generation is not available right now. Please use "I have an idea" and we will review it and send you a quote.');
  } finally {
    inFlight.delete(who);
    active--;
  }

  const job: Job = {
    id: crypto.randomUUID(), meshyId, kind: a.mode, name: a.name, email: a.email, phone: a.phone,
    prompt: a.mode === 'text' ? (a.prompt ?? '') : '(customer photo)', createdAt: new Date().toISOString(), state: 'working', files: [],
    ...(a.owner ? { owner: a.owner } : {}),
  };
  try {
    await d.write(job);
  } catch (e) {
    console.error('Generate: could not save job', e);
    return fail(500, 'Something went wrong. Please try again.');
  }
  return { ok: true, id: job.id };
}
