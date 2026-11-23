// Blueprint-first design projects: one JSON per project in the store ('designs'). Server only.
// Lifecycle: draft (edit, AI revise, undo) -> approved (frozen) -> finalized (STL built here, read-only) -> ordered.
// The customer approves, the owner still reviews the order at pending_review. The AI call is injected (`Ai`) so tests use a stub.
// ponytail: per-project lock is process-local (serialJob); two server instances need a DB lock.
import crypto from 'node:crypto';
import { analyzeModel } from './analyzeModel.ts';
import { takeUsage } from './aiGuard.ts';
import { PLAN_NO_QUESTIONS, PLAN_REPLY_SCHEMA, PLAN_SYSTEM, REVISE_SYSTEM, compactBlueprint, parseBlueprintReply, parsePlanReply, planUser, reviseUser, REVISE_REQUEST_MAX } from './aiBlueprint.ts';
import { UUID, findJobByFile, serialJob } from './aiJobs.ts';
import { BLUEPRINT_SCHEMA, blueprintToShapes, diffBlueprints, shapesToBlueprint, validateBlueprint, type Blueprint, type BlueprintDiff } from './designBlueprint.ts';
import { buildMesh, toStl, type Shape } from './playground.ts';
import { BED_MM, fitsBed, meshStats, type MeshStats } from './quote.ts';
import { del, getBytes, getJson, list, putBytes, putJson } from './store.ts';
import { scaleStl } from './stlScale.ts';
import { buildTemplate, templateMesh } from './templates.ts';
import { defaultCfg, normalizeCfg, templateById, type Cfg } from './templateDefs.ts';

export const DESIGNS = 'designs';
export const CACHE = 'design-cache';
export const MAX_REVISIONS = 30;
export const PRUNE_DAYS = 30;
export const aiRevisionCap = (env: Record<string, string | undefined> = process.env) => {
  const n = Number.parseInt(env.AI_REVISIONS_PER_PROJECT ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
};

export type Source = 'prompt' | 'mesh' | 'template';
export type By = 'ai' | 'manual' | 'template' | 'mesh';
export type Status = 'draft' | 'approved' | 'finalized' | 'ordered';
export type Revision = {
  n: number; parent: number | null; by: By; request?: string; blueprint: Blueprint;
  longestMm?: number; // mesh projects: the scale, as the longest side in mm (the blueprint is a bounding-box stand-in)
  createdAt: string;
};
export type Project = {
  id: string; createdAt: string; email?: string; source: Source;
  origin?: 'upload' | 'meshy'; meshFile?: string; // mesh projects: the stored upload
  status: Status; current: number; approvedRev?: number; finalRev?: number; finalFile?: string;
  aiRevisions: number; revisions: Revision[];
  components?: string[]; // user-supplied parts that are not printed (filled by a later work package)
};

export class DesignError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const fail = (status: number, msg: string): never => { throw new DesignError(status, msg); };

/** The AI call: system prompt, user text and reply schema in, raw reply text out. Throws when AI is not configured or the call fails. */
export type Ai = (system: string, user: string, schema: object) => Promise<string>;

const now = () => new Date().toISOString();
const keyOf = (id: string) => `${id.toLowerCase()}.json`;

export const getProject = async (id: string): Promise<Project | null> => (UUID.test(id) ? getJson<Project>(DESIGNS, keyOf(id)) : null);

/** Read-modify-write under the project's lock. A throw from fn writes nothing. */
function update<T>(id: string, fn: (p: Project) => Promise<T> | T): Promise<T> {
  return serialJob(`design:${id.toLowerCase()}`, async () => {
    const p = await getProject(id);
    if (!p) return fail(404, 'Design not found');
    const r = await fn(p);
    await putJson(DESIGNS, keyOf(p.id), p);
    return r;
  });
}

const rev = (p: Project, n = p.current): Revision => p.revisions.find((r) => r.n === n) ?? fail(500, 'Design is corrupt');
export const currentBlueprint = (p: Project): Blueprint => rev(p).blueprint;
const editable = (p: Project) => { if (p.status !== 'draft') fail(409, `This design is ${p.status} and can no longer be edited.`); };

function push(p: Project, r: Omit<Revision, 'n' | 'parent' | 'createdAt'>): Revision {
  if (p.revisions.length >= MAX_REVISIONS) fail(409, `A design has at most ${MAX_REVISIONS} revisions.`);
  const next: Revision = { n: Math.max(...p.revisions.map((x) => x.n), 0) + 1, parent: p.revisions.length ? p.current : null, createdAt: now(), ...r };
  p.revisions.push(next);
  p.current = next.n;
  return next;
}

async function save(p: Project): Promise<Project> {
  await putJson(DESIGNS, keyOf(p.id), p);
  return p;
}

const base = (source: Source, email?: string): Project => ({ id: crypto.randomUUID(), createdAt: now(), ...(email ? { email } : {}), source, status: 'draft', current: 0, aiRevisions: 0, revisions: [] });

// ---------- AI plumbing ----------

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hash = (...parts: string[]) => crypto.createHash('sha256').update(parts.map(norm).join('|')).digest('hex');
// Duplicate requests are served from here and are not counted. ponytail: entries are never expired; designs:prune does not touch them (tiny files)
const cached = async <T>(key: string): Promise<T | null> => getJson<T>(CACHE, `${key}.json`);

/** Takes one use from the daily ledger (429 when over), then runs the call. A failed call still counts: it cannot be retried for free. */
async function counted(ai: Ai, email: string, system: string, user: string, schema: object): Promise<string> {
  const lim = await takeUsage(email, undefined, 'project');
  if (!lim.ok) {
    fail(429, lim.scope === 'email' ? `You have reached the daily limit of ${lim.limit} AI requests. Try again tomorrow, or edit by hand.` : 'We have reached our daily limit of AI requests. Try again tomorrow, or edit by hand.');
  }
  try {
    return await ai(system, user, schema);
  } catch (e) {
    console.error('Design AI call failed:', e instanceof Error ? e.message : 'unknown');
    return fail(502, 'The AI service did not answer. Try again.');
  }
}

// ---------- create ----------

export type PlanOutcome = { kind: 'questions'; questions: string[]; canSkip: true } | { kind: 'plan'; project: Project };

/**
 * First plan from a prompt. The AI may answer with ONE round of up to 3 questions (kind 'questions'); the client then sends
 * the same prompt again with `answers` (text) or `skip: true`, and the AI must plan, listing its assumptions in the blueprint notes.
 */
export async function createFromPrompt(ai: Ai, i: { email: string; prompt: string; answers?: string; skip?: boolean }): Promise<PlanOutcome> {
  const second = !!(i.answers || i.skip);
  const key = hash('plan', i.prompt, i.answers ?? '', second ? '2' : '1');
  type Stored = { kind: 'questions'; questions: string[] } | { kind: 'plan'; blueprint: Blueprint };
  let out = await cached<Stored>(key);
  if (!out) {
    const system = second ? `${PLAN_SYSTEM}\n\n${PLAN_NO_QUESTIONS}` : PLAN_SYSTEM;
    let reply;
    try {
      reply = parsePlanReply(await counted(ai, i.email, system, planUser(i.prompt, i.answers), PLAN_REPLY_SCHEMA));
    } catch (e) {
      if (e instanceof DesignError) throw e;
      return fail(502, 'The AI service did not answer. Try again.');
    }
    if (reply.kind === 'questions') {
      if (second) fail(422, 'The AI still needs more detail. Add more to your description.');
      out = reply;
    } else {
      if (!reply.result.ok) return fail(422, reply.result.reason);
      out = { kind: 'plan', blueprint: reply.result.blueprint };
    }
    await putJson(CACHE, `${key}.json`, out).catch(() => {});
  }
  if (out.kind === 'questions') return { kind: 'questions', questions: out.questions, canSkip: true };
  const p = base('prompt', i.email);
  push(p, { by: 'ai', request: [i.prompt, i.answers].filter(Boolean).join(' / '), blueprint: out.blueprint });
  return { kind: 'plan', project: await save(p) };
}

export async function createFromTemplate(i: { email?: string; template: unknown; cfg: unknown }): Promise<Project> {
  const t = templateById(i.template) ?? fail(400, 'Unknown template');
  let cfg: Cfg;
  try {
    cfg = normalizeCfg(t, i.cfg ?? defaultCfg(t), true);
  } catch (e) {
    return fail(400, e instanceof Error ? e.message : 'Bad configuration');
  }
  const built = buildTemplate(t, cfg);
  const p = base('template', i.email);
  push(p, { by: 'template', request: t.name, blueprint: shapesToBlueprint(built.shapes, t.name, built.description.slice(0, 300)) });
  return save(p);
}

const longest = (s: MeshStats['sizeMm']) => Math.max(s.x, s.y, s.z);

/** A project around an uploaded STL (or a Meshy result). Scale-only: the blueprint is a bounding box stand-in and the scale lives on the revision. */
export async function createFromMesh(i: { email?: string; file: unknown; origin?: unknown; env?: Record<string, string | undefined> }): Promise<Project> {
  const file = typeof i.file === 'string' ? i.file : '';
  if (!/\.stl$/i.test(file)) fail(400, 'Uploaded models can be scaled here only when they are STL files.');
  const origin = i.origin === 'meshy' ? 'meshy' : 'upload';
  if (origin === 'meshy') {
    if (!(i.env ?? process.env).MESHY_API_KEY) fail(400, 'AI mesh generation is not set up.');
    if (!(await findJobByFile(file))) fail(400, 'That model was not made by AI mesh generation.');
  }
  const stats = await getJson<MeshStats>('uploads', `${file}.stats.json`);
  if (!stats || !(longest(stats.sizeMm) > 0)) fail(400, 'We could not read that model. Send it as a request and we will quote it by hand.');
  const s = stats!.sizeMm;
  const box: Shape = { id: 'mesh', kind: 'box', mode: 'solid', position: { x: 0, y: 0, z: s.z / 2 }, rotation: { x: 0, y: 0, z: 0 }, size: { ...s } };
  const bp = shapesToBlueprint([box], 'Uploaded model', `${origin === 'meshy' ? 'AI-generated' : 'Uploaded'} mesh: scale only. The box shows its overall size.`);
  const p = base('mesh', i.email);
  p.origin = origin;
  p.meshFile = file;
  push(p, { by: 'mesh', blueprint: bp, longestMm: Math.round(longest(s) * 100) / 100 });
  return save(p);
}

// ---------- revise ----------

export type ReviseResult = { project: Project; revision: Revision; diff: BlueprintDiff; cached: boolean };

export function revise(ai: Ai, id: string, i: { email?: string; request: string }, env: Record<string, string | undefined> = process.env): Promise<ReviseResult> {
  return update(id, async (p) => {
    editable(p);
    if (p.source === 'mesh') fail(400, 'Uploaded models can only be scaled, not redrawn.');
    const cap = aiRevisionCap(env);
    if (p.aiRevisions >= cap) fail(429, `This design has used its ${cap} AI revisions. You can still edit it by hand.`);
    const email = p.email ?? i.email ?? fail(400, 'email is required for AI revisions');
    p.email ??= email;
    const request = i.request.slice(0, REVISE_REQUEST_MAX);
    const cur = currentBlueprint(p);
    const json = compactBlueprint(cur) ?? fail(422, 'This design is too large for the AI to revise. Edit it by hand.');
    const key = hash('revise', json, request);
    let bp = (await cached<{ blueprint: Blueprint }>(key))?.blueprint;
    const hit = !!bp;
    if (!bp) {
      const r = parseBlueprintReplySafe(await counted(ai, email, REVISE_SYSTEM, reviseUser(json, request), BLUEPRINT_SCHEMA));
      if (!r.ok) return fail(422, r.reason);
      bp = r.blueprint;
      await putJson(CACHE, `${key}.json`, { blueprint: bp }).catch(() => {});
    }
    const revision = push(p, { by: 'ai', request, blueprint: bp });
    if (!hit) p.aiRevisions += 1;
    return { project: p, revision, diff: diffBlueprints(cur, bp), cached: hit };
  });
}

function parseBlueprintReplySafe(text: string) {
  try {
    return parseBlueprintReply(text);
  } catch {
    return fail(502, 'The AI service did not answer. Try again.');
  }
}

// ---------- manual edit, undo, approve ----------

/** Manual revision: a full blueprint (validated like an AI reply), or for mesh projects { longestMm }. */
export function manual(id: string, i: { blueprint?: unknown; longestMm?: unknown }): Promise<{ project: Project; revision: Revision; diff: BlueprintDiff }> {
  return update(id, (p) => {
    editable(p);
    const cur = currentBlueprint(p);
    if (p.source === 'mesh') {
      const mm = i.longestMm;
      if (typeof mm !== 'number' || !Number.isFinite(mm) || mm <= 0) return fail(400, 'longestMm must be a positive number');
      const k = mm / longest(cur.envelope);
      const s = cur.envelope;
      if (!fitsBed({ x: s.x * k, y: s.y * k, z: s.z * k })) fail(422, `The scaled model does not fit the ${BED_MM.x} x ${BED_MM.y} x ${BED_MM.z} mm print bed.`);
      const shape = { ...cur.parts[0].shapes[0], size: { x: s.x * k, y: s.y * k, z: s.z * k }, position: { x: 0, y: 0, z: (s.z * k) / 2 } };
      const bp = shapesToBlueprint([shape], cur.title, cur.notes);
      const revision = push(p, { by: 'mesh', blueprint: bp, longestMm: Math.round(mm * 100) / 100 });
      return { project: p, revision, diff: diffBlueprints(cur, bp) };
    }
    const r = validateBlueprint(i.blueprint);
    if (!r.ok) return fail(422, r.reason);
    const revision = push(p, { by: 'manual', blueprint: r.blueprint });
    return { project: p, revision, diff: diffBlueprints(cur, r.blueprint) };
  });
}

/** Undo = current points back to the parent revision. Nothing is deleted, so the history stays. */
export const undo = (id: string): Promise<Project> =>
  update(id, (p) => {
    editable(p);
    const parent = rev(p).parent;
    if (parent === null) fail(409, 'Nothing to undo.');
    p.current = parent!;
    return p;
  });

export const approve = (id: string): Promise<Project> =>
  update(id, (p) => {
    if (p.status === 'approved' || p.status === 'finalized' || p.status === 'ordered') return p; // idempotent
    p.status = 'approved';
    p.approvedRev = p.current;
    return p;
  });

// ---------- finalize ----------

function meshOf(shapes: Shape[]): { tris: Float32Array; stats: MeshStats } {
  let tris: Float32Array | null = null;
  let stats: MeshStats | null = null;
  try {
    tris = buildMesh(shapes);
    stats = tris ? meshStats(tris) : null;
  } catch {}
  if (!tris || !stats) {
    tris = templateMesh(shapes); // same build with small deterministic nudges when the first attempt is not closed
    stats = tris ? meshStats(tris) : null;
  }
  if (!tris || !stats) return fail(422, 'This design could not be built into a printable solid. Go back and change it.');
  return { tris, stats };
}

/** Rebuilds the print file on the server from the approved revision (never from anything the browser sends). Idempotent; read-only afterwards. */
export const finalize = (id: string): Promise<Project> =>
  update(id, async (p) => {
    if (p.status === 'finalized' || p.status === 'ordered') return p;
    if (p.status !== 'approved') fail(409, 'Approve the design first.');
    const r = rev(p, p.approvedRev);
    const name = `${Date.now()}-${crypto.randomUUID()}.stl`;
    let stats: MeshStats | null;
    if (p.source === 'mesh') {
      const src = await getBytes('uploads', p.meshFile ?? '') ?? fail(410, 'The uploaded model is no longer stored.');
      const out = scaleStl(src!, r.longestMm ?? 0);
      stats = analyzeModel(out, '.stl');
      if (!stats) fail(422, 'We could not read that model.');
      if (!fitsBed(stats!.sizeMm)) fail(422, 'The scaled model does not fit the print bed.');
      await putBytes('uploads', name, out);
    } else {
      const m = meshOf(blueprintToShapes(r.blueprint));
      if (!fitsBed(m.stats.sizeMm)) fail(422, 'The design does not fit the print bed.');
      stats = m.stats;
      await putBytes('uploads', name, toStl(m.tris));
    }
    await putJson('uploads', `${name}.stats.json`, stats); // priceModel reads this sidecar, so pricing works unchanged
    p.status = 'finalized';
    p.finalRev = r.n;
    p.finalFile = name;
    return p;
  });

/** Stats of the print file a finalized project built (the sidecar priceModel reads), or null. */
export const finalStats = async (p: Project): Promise<MeshStats | null> => (p.finalFile ? getJson<MeshStats>('uploads', `${p.finalFile}.stats.json`) : null);

/** Called by /api/orders once the order is saved. */
export const markOrdered = (id: string): Promise<Project> =>
  update(id, (p) => {
    if (p.status === 'finalized') p.status = 'ordered';
    return p;
  });

/** What an order line needs from a project, or a 400-style error: the project must be finalized with its file present. */
export async function orderInfo(id: unknown): Promise<{ id: string; revision: number; file: string; components: string[] }> {
  const p = typeof id === 'string' ? await getProject(id) : null;
  if (!p) return fail(400, 'design project not found');
  if ((p.status !== 'finalized' && p.status !== 'ordered') || !p.finalFile || p.finalRev === undefined) return fail(400, 'design project is not finalized: approve and finalize it first');
  if (!(await getBytes('uploads', p.finalFile))) return fail(400, 'design file not found');
  return { id: p.id, revision: p.finalRev, file: p.finalFile, components: p.components ?? [] };
}

// ---------- prune ----------

/** Deletes projects that were never ordered and are older than `days` (and the STL a finalized one wrote). Returns how many. */
export async function pruneProjects(at = new Date(), days = PRUNE_DAYS): Promise<number> {
  let n = 0;
  for (const k of await list(DESIGNS)) {
    if (!k.endsWith('.json')) continue;
    const p = await getJson<Project>(DESIGNS, k);
    if (!p || p.status === 'ordered' || at.getTime() - Date.parse(p.createdAt) <= days * 86_400_000) continue;
    if (p.finalFile) {
      await del('uploads', p.finalFile);
      await del('uploads', `${p.finalFile}.stats.json`);
    }
    await del(DESIGNS, k);
    n++;
  }
  return n;
}
