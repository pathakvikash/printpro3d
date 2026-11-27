// Orrery glue to the real generator, store and quota. Server only; the logic worth testing lives in orrery.ts.
import { checkPrompt } from './aiGuard.ts';
import { startJob } from './aiGenerate.ts';
import { readJob } from './aiJobs.ts';
import { pollJob } from './aiPoll.ts';
import { meshyEnabled } from './meshy.ts';
import type { Deps } from './orrery.ts';
import { jobMatches, ownedBy, type AccessDeps } from './fileAccess.ts';

/** Log one JSON line per MCP call: who, which tool, how long. */
export const logCall = (sub: string, tool: string, started: number) =>
  console.log(JSON.stringify({ orrery: 'call', sub, tool, ms: Date.now() - started }));

const lastProgress = new Map<string, number>(); // ponytail: per instance, cleared when a job finishes; add a store field if it matters

export const realDeps: Deps = {
  async generate({ sub, prompt }) {
    if (!meshyEnabled()) return { ok: false, error: 'AI generation is not available right now.' };
    const c = checkPrompt(prompt); // same length limit and weapon/brand screen as the website
    if (!c.ok) return { ok: false, error: c.reason };
    // identity is the verified token sub, so the per-email daily quota (AI_DAILY_PER_EMAIL) is that user's own
    const r = await startJob({ email: sub, name: sub.split('@')[0] || 'Orrery user', phone: '', mode: 'text', prompt: c.prompt, owner: { email: sub } });
    return r.ok ? { ok: true, jobId: r.id } : { ok: false, error: r.error };
  },
  async status({ sub, jobId }) {
    const job = await readJob(jobId);
    if (!job || !jobMatches(job, { email: sub })) return null; // someone else's job looks like a missing one
    let p;
    try {
      p = await pollJob(job);
    } catch (e) { // transient (store or network hiccup): keep the card polling with the last progress we saw
      console.error('Orrery job_status poll failed:', e instanceof Error ? e.message : e);
      return { state: 'running', progress: lastProgress.get(jobId) ?? 0 };
    }
    if (p.state === 'failed') return { state: 'failed', error: p.message };
    if (p.state === 'working') {
      // pollJob reports 0 when Meshy blips; keep the best progress seen (in-process, resets on cold start)
      const progress = Math.max(p.progress ?? 0, lastProgress.get(jobId) ?? 0);
      lastProgress.set(jobId, progress);
      return { state: progress ? 'running' : 'queued', progress };
    }
    lastProgress.delete(jobId);
    return { state: 'done', progress: 100, result: { orrery: 1, type: 'model3d', format: 'stl', file: p.file, title: job.prompt.slice(0, 60) } };
  },
};

/**
 * The generated file /quote?file= or ?job= may preselect: only when the viewer is signed in and a generation job of that
 * same verified owner made it (never the typed contact email). Anything else returns null and the quote page opens as usual.
 */
export async function preselectFile(q: { file?: string; job?: string }, email: string | null): Promise<string | null> {
  if (!email) return null;
  const who = email.trim().toLowerCase();
  if (q.job) {
    const j = await readJob(q.job);
    return j && j.state === 'ready' && j.file && jobMatches(j, { email: who }) ? j.file : null;
  }
  const f = q.file ?? '';
  return /^[A-Za-z0-9._-]{1,128}$/.test(f) && (await ownsFile(who, f)) ? f : null;
}

/** True when the verified identity `sub` owns `file` (owner record or the AI job's verified owner), same rule as /api/upload/[name]. */
export const ownsFile = (sub: string, file: string, deps?: Pick<AccessDeps, 'owner' | 'jobOf'>): Promise<boolean> => ownedBy({ email: sub }, file, deps);
