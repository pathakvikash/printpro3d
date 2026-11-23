// Guardrails for AI generation: prompt screening and a per-day usage ledger. Server only.
// Env: AI_DAILY_PER_EMAIL (default 3; 20 for the blueprint flow), AI_DAILY_TOTAL (default 40; 200 for the blueprint flow).
import { getJson, putJson } from './store.ts';

export const PROMPT_MIN = 3;
export const PROMPT_MAX = 400;
export const DESIGN_PROMPT_MAX = 600; // the blueprint planner takes a longer brief than the mesh generator

// ponytail: static deny-list — add an LLM/vision classifier when volume justifies it; a human still approves every order
// Plain words are matched on word boundaries, so "magazine rack" and "knife block" pass; only weapon-specific
// phrases are listed for knives, blades and magazines. "receiver" alone is allowed (radio receiver): only
// "upper/lower receiver" is blocked. Known false positives ("silencer" for a car exhaust, a name like "Mario") are
// sent to "I have an idea", where a person reads the request.
const WEAPONS = [
  'gun', 'handgun', 'pistol', 'revolver', 'rifle', 'shotgun', 'firearm', 'smg', 'ar 15', 'ar15', 'ak 47', 'ak47', 'glock',
  'ghost gun', 'lower receiver', 'upper receiver', 'suppressor', 'silencer', 'magazine well', 'magwell',
  'ammo', 'ammunition', 'bump stock', 'auto sear', 'grenade', 'explosive', 'pipe bomb', 'molotov', 'taser', 'weapon',
  'switchblade', 'dagger', 'brass knuckles', 'knuckle duster', 'shuriken', 'throwing star', 'nunchaku',
  'combat knife', 'tactical knife', 'throwing knife', 'fighting knife', 'butterfly knife', 'survival knife', 'trench knife',
  'combat blade', 'fighting blade', 'attack blade',
];
// household things that contain a weapon word
const ALLOWED = ['glue gun', 'hot glue gun', 'heat gun', 'nail gun', 'staple gun', 'spray gun', 'caulk gun', 'grease gun', 'water gun', 'squirt gun', 'soldering gun', 'paint gun'];
const PROTECTED = [
  'mickey mouse', 'minnie mouse', 'disney', 'pixar', 'frozen elsa', 'pikachu', 'pokemon', 'nintendo', 'mario', 'luigi', 'zelda', 'sonic the hedgehog',
  'spiderman', 'spider man', 'batman', 'superman', 'marvel', 'avengers', 'iron man', 'hulk', 'captain america', 'thor', 'deadpool',
  'harry potter', 'hogwarts', 'star wars', 'darth vader', 'yoda', 'mandalorian', 'baby yoda', 'hello kitty', 'barbie', 'peppa pig', 'bluey',
  'winnie the pooh', 'minecraft', 'naruto', 'goku', 'dragon ball', 'doraemon', 'shinchan', 'transformers', 'optimus prime', 'gundam', 'lego',
  'nike', 'adidas', 'rolex', 'gucci', 'louis vuitton', 'apple logo', 'playstation', 'xbox',
];

/** Lowercase, drop accents, turn punctuation into single spaces. */
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const matcher = (words: string[]) => new RegExp(`\\b(?:${words.map((w) => w.replace(/ /g, '\\s+')).join('|')})s?\\b`);
const WEAPON_RE = matcher(WEAPONS);
const ALLOWED_RE = new RegExp(`\\b(?:${ALLOWED.map((w) => w.replace(/ /g, '\\s+')).join('|')})s?\\b`, 'g');
const PROTECTED_RE = matcher(PROTECTED);

export type PromptCheck = { ok: true; prompt: string } | { ok: false; reason: string };

export function checkPrompt(input: unknown, max = PROMPT_MAX): PromptCheck {
  const prompt = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (prompt.length < PROMPT_MIN || prompt.length > max) {
    return { ok: false, reason: `Describe your model in ${PROMPT_MIN} to ${max} characters.` };
  }
  const n = norm(prompt);
  if (WEAPON_RE.test(n.replace(ALLOWED_RE, ' '))) {
    return { ok: false, reason: "We can't generate weapons or weapon parts. Try describing something else." };
  }
  if (PROTECTED_RE.test(n)) {
    return { ok: false, reason: "We can't generate characters or brands we don't have rights to. Describe your own design instead." };
  }
  return { ok: true, prompt };
}

// ---- usage ledger ----
// ponytail: JSON ledger in the store (ai-usage). takeUsage is atomic inside one server process only; several instances can overshoot a little

type Ledger = { total: number; emails: Record<string, number> };
export type Limit = { ok: true } | { ok: false; scope: 'email' | 'total'; limit: number };

const intEnv = (k: string, d: number) => {
  const n = Number.parseInt(process.env[k] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
export const normEmail = (e: string) => e.trim().toLowerCase();
const day = (now: Date) => now.toISOString().slice(0, 10); // UTC day
// each kind has its own ledger and its own limits. generate keeps the original file name, so existing counts still apply.
// 'project' = the blueprint-first flow (create/revise): 20 per email per day by default, same env overrides.
export type LedgerKind = 'generate' | 'design' | 'project';
const key = (now: Date, kind: LedgerKind) => (kind === 'generate' ? `${day(now)}.json` : `${kind}-${day(now)}.json`);
const DEFAULTS: Record<LedgerKind, { email: number; total: number }> = { generate: { email: 3, total: 40 }, design: { email: 3, total: 40 }, project: { email: 20, total: 200 } };

async function load(now: Date, kind: LedgerKind): Promise<Ledger> {
  const l = await getJson<Ledger>('ai-usage', key(now, kind));
  if (l && typeof l.total === 'number' && l.emails && typeof l.emails === 'object') return l;
  return { total: 0, emails: {} };
}

function verdict(l: Ledger, email: string, kind: LedgerKind): Limit {
  const perEmail = intEnv('AI_DAILY_PER_EMAIL', DEFAULTS[kind].email);
  const total = intEnv('AI_DAILY_TOTAL', DEFAULTS[kind].total);
  if (l.total >= total) return { ok: false, scope: 'total', limit: total };
  if ((l.emails[normEmail(email)] ?? 0) >= perEmail) return { ok: false, scope: 'email', limit: perEmail };
  return { ok: true };
}

/** Is one more generation allowed today for this email? Read only: use takeUsage to count one. */
export async function checkLimit(email: string, now = new Date(), kind: LedgerKind = 'generate'): Promise<Limit> {
  return verdict(await load(now, kind), email, kind);
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Checks the limits and, when allowed, counts one use, as one step (calls in this process run one at a time, so
 * concurrent requests cannot all pass before any of them is counted). Call it right before the paid call: the use is
 * not refunded if that call fails, because a failed call cannot be retried for free.
 */
export function takeUsage(email: string, now = new Date(), kind: LedgerKind = 'generate'): Promise<Limit> {
  const run = async (): Promise<Limit> => {
    const l = await load(now, kind);
    const v = verdict(l, email, kind);
    if (!v.ok) return v;
    const k = normEmail(email);
    l.total += 1;
    l.emails[k] = (l.emails[k] ?? 0) + 1;
    await putJson('ai-usage', key(now, kind), l);
    return v;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}
