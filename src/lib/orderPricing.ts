// Server-side pricing of the order lines that come from stored files: uploads and finalized design projects. Server only.
// Nothing the browser says about price is read; the price comes from the STL in the store and its stats sidecar.
import { createHash } from 'node:crypto';
import { fitsBed, quote, type MeshStats } from './quote.ts';
import { kitPartByKey } from './kits/adapt.ts';
import type { OrderLine } from './notify.ts';
import { findJobByFile } from './aiJobs.ts';
import { orderInfo } from './designProjects.ts';
import { getBytes, getJson, putJson } from './store.ts';
import { cfgKey, type Cfg, type TemplateDef } from './templateDefs.ts';
import { BuildTimeout, runBuild, type Job } from './priceBuild.ts';

export type SavedLine = OrderLine & { stats?: MeshStats | null; quote?: ReturnType<typeof quote> | null; cfg?: Cfg };

// ---------- part price cache and time budget ----------
// Kit and template parts are rebuilt with CSG on the server (up to ~15 s for the heaviest configs, and the kernel is sometimes flaky),
// while a Vercel function stops at 60 s. So: a computed part (its MeshStats; the price is quote() of it) is remembered in an LRU and in the store,
// builds draw on a shared time budget, and a part that is out of budget or fails to build becomes a line with priceStatus 'review':
// the order is accepted, the owner prices that line by hand. A client price is never used as a fallback.

class BedError extends Error {} // a part that builds but is too big: a real rejection, not a review
export const PRICE_BUDGET_MS = 40_000;
const LRU_MAX = 500;
const lru = new Map<string, MeshStats>();
// stored stats go stale when a builder changes: a new deploy (commit sha) starts a fresh cache
const cacheKey = (id: string, cfg: Cfg) => createHash('sha256').update(JSON.stringify([process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev', id, Object.keys(cfg).sort().map((k) => [k, cfg[k]])])).digest('hex');
export const clearPriceCache = () => lru.clear(); // the in-memory side only (tests, bench)

/** Wall-clock budget shared by the lines of one order. `longest` = slowest build so far: a new build starts only if that much time is left. */
export type Budget = { deadline: number; longest: number };
export const newBudget = (ms = PRICE_BUDGET_MS): Budget => ({ deadline: Date.now() + ms, longest: 0 });

export type Stats = { stats: MeshStats } | { review: string };
/** Stats of one part: LRU, then store, then a build within the budget. A build that is refused or fails is a `review` result, and is not cached. */
export async function partStats(id: string, cfg: Cfg, job: Job | (() => MeshStats | null | Promise<MeshStats | null>), budget?: Budget): Promise<Stats> {
  const key = cacheKey(id, cfg);
  const hit = lru.get(key);
  if (hit) { lru.delete(key); lru.set(key, hit); return { stats: hit }; }
  const saved = await getJson<MeshStats>('price-cache', `${key}.json`);
  if (saved && saved.volumeCm3 > 0) return { stats: remember(key, saved) };
  if (budget && Date.now() + budget.longest >= budget.deadline) return { review: 'not priced in time' };
  const t = Date.now();
  let stats: MeshStats | null = null;
  try {
    stats = typeof job === 'function' ? await job() : await runBuild(job, budget?.deadline);
  } catch (e) {
    if (e instanceof BuildTimeout) return { review: 'not priced in time' };
    if (/print bed/.test(e instanceof Error ? e.message : '')) throw new BedError(e instanceof Error ? e.message : 'bed'); // a template too big to print
  }
  if (budget) budget.longest = Math.max(budget.longest, Date.now() - t);
  if (!stats) return { review: 'build failed' };
  if (fitsBed(stats.sizeMm)) { remember(key, stats); await putJson('price-cache', `${key}.json`, stats).catch(() => {}); }
  return { stats };
}
function remember(key: string, s: MeshStats): MeshStats {
  lru.set(key, s);
  if (lru.size > LRU_MAX) lru.delete(lru.keys().next().value!);
  return s;
}

/** A line the server could not price: accepted, total null, the owner prices it (priceStatus 'review'). */
const reviewLine = (line: Omit<SavedLine, 'stats' | 'quote' | 'total' | 'priceStatus' | 'reviewReason'>, reason: string): SavedLine =>
  ({ ...line, stats: null, quote: null, total: null, priceStatus: 'review', reviewReason: reason });


export async function priceModel(file: string, material: string, qty: number): Promise<SavedLine> {
  if (file.endsWith('.stats.json') || !(await getBytes('uploads', file))) throw new Error('file not found');

  // stats were computed at upload time; missing or invalid sidecar means manual quote
  let stats: MeshStats | null = null;
  try {
    const s = await getJson<{ volumeCm3?: unknown; sizeMm?: Record<string, unknown> }>('uploads', `${file}.stats.json`);
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    if (s && ok(s.volumeCm3) && (s.volumeCm3 as number) > 0 && s.sizeMm && ok(s.sizeMm.x) && ok(s.sizeMm.y) && ok(s.sizeMm.z)) {
      stats = { volumeCm3: s.volumeCm3 as number, sizeMm: { x: s.sizeMm.x as number, y: s.sizeMm.y as number, z: s.sizeMm.z as number } };
    }
  } catch {}

  let q: ReturnType<typeof quote> | null = null;
  if (stats) {
    const r = quote(stats, material, qty); // validates material + qty
    if (fitsBed(stats.sizeMm)) q = r;
  } else {
    quote({ volumeCm3: 0, sizeMm: { x: 0, y: 0, z: 0 } }, material, qty); // validate only
  }
  // ponytail: setup fee and minimum order apply per model line — one fee per order if that proves too steep
  const ai = await findJobByFile(file); // file came from an AI generation: tell the owner the prompt
  return {
    kind: 'model', file, material, qty, stats, quote: q, total: q ? q.total : null,
    ...(ai ? { aiPrompt: ai.prompt } : {}),
  };
}

/** A kit part line: the mesh is rebuilt from the kit file (builder + validated config) or read from the STL file we ship in public/models/kits;
 * the price is quote() of that mesh. `key` and `cfg` must already be checked (orderChecks); the client's label and price are never read. */
export async function priceKit(key: string, cfg: Cfg, qty: number, budget?: Budget): Promise<SavedLine> {
  const hit = kitPartByKey(key);
  if (!hit) throw new Error('unknown kit part');
  const { source, part } = hit;
  const config = Object.entries(cfg).map(([k, v]) => `${k}: ${v}`).join(', ');
  const base = { kind: 'kit' as const, id: key, itemName: `${source.title}: ${part.label}`, config, cfg, qty, material: part.material };
  const r = await partStats(key, cfg, { kit: key, cfg }, budget);
  if ('review' in r) return reviewLine(base, r.review);
  if (!fitsBed(r.stats.sizeMm)) throw new Error('this kit part does not fit the print bed');
  const q = quote(r.stats, part.material, qty);
  return { ...base, stats: r.stats, quote: q, total: q.total };
}

/** A template line, same rules as a kit line (cache, budget, review instead of rejection when the build fails). */
export async function priceTpl(tpl: TemplateDef, cfg: Cfg, qty: number, budget?: Budget): Promise<SavedLine> {
  const config = tpl.fields.map((f) => `${f.label}: ${f.type === 'select' ? f.options.find((o) => o.value === cfg[f.key])?.label : cfg[f.key]}`).join(', ');
  const base = { kind: 'tpl' as const, id: tpl.id, itemName: tpl.name, config, cfg, qty, material: tpl.material };
  let r: Stats;
  try {
    r = await partStats(`tpl:${tpl.id}:${cfgKey(tpl, cfg)}`, cfg, { tpl: tpl.id, cfg }, budget);
  } catch (e) {
    if (e instanceof BedError) throw new Error('this configuration does not fit the print bed');
    throw e;
  }
  if ('review' in r) return reviewLine(base, r.review);
  const q = quote(r.stats, tpl.material, qty);
  return { ...base, stats: r.stats, quote: q, total: q.total };
}

/** A design line: the project must be finalized with its file in the store; the price is computed from that server-built STL. */
export async function priceDesign(project: string, material: string, qty: number): Promise<SavedLine> {
  const info = await orderInfo(project);
  const line = await priceModel(info.file, material, qty);
  return { ...line, kind: 'design', project: info.id, revision: info.revision, ...(info.components.length ? { components: info.components } : {}) };
}

/** Order note block for design lines: project id, revision and the components the customer supplies (not printed). */
export const designNotes = (lines: SavedLine[]): string =>
  lines.filter((l) => l.kind === 'design')
    .map((l) => `Design project ${l.project} rev ${l.revision}.${l.components?.length ? ` User-supplied components (not printed): ${l.components.map((c) => c.replace(/\s+/g, ' ')).join(', ')}.` : ''}`)
    .join('\n');
