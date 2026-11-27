// Customer accounts without a database: a signed-in Google user is {sub, email, name}. Orders and requests carry the sub and verified
// email (set server-side from the session, never from the request body); a per-user index in the store lists them. Server only.
import { getJson, list, putJson } from './store.ts';

export type SessionUser = { sub: string; email: string; name: string; image?: string };
export type MyRecord = { type: 'order' | 'request'; id: string; createdAt: string; status: string; total: number | null; currency: string; summary: string };
type Entry = { type: 'order' | 'request'; id: string; createdAt: string };

const FOLDER = { order: 'orders', request: 'requests' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUB = /^[A-Za-z0-9]{1,64}$/; // Google subs are numeric; also a valid store key
const INDEX_NS = 'user-orders';
// orders before Google accounts existed have no owner: match those by contact email; later ones only by session owner
const ACCOUNTS_SINCE = '2026-11-27T00:00:00.000Z';

/** The signed-in user from the Auth.js session cookie (needs a Google sub and email), or null. */
export async function sessionUser(): Promise<SessionUser | null> {
  try {
    const u = (await (await import('../auth.ts')).auth())?.user as { id?: string; email?: string | null; name?: string | null; image?: string | null } | undefined;
    return u?.id && SUB.test(u.id) && u.email ? { sub: u.id, email: u.email.toLowerCase(), name: u.name ?? '', ...(u.image ? { image: u.image } : {}) } : null;
  } catch {
    return null;
  }
}

/** Fields to store on a new order/request: the session's sub and verified email, or nothing when signed out. */
export const ownerFields = (u: SessionUser | null) => (u ? { userSub: u.sub, userEmail: u.email } : {});

/** Adds a record to the user's index. ponytail: read-modify-write, two orders at the same instant can drop one entry; the email scan in listMine still finds it. */
export async function indexAdd(u: SessionUser | null, entry: Entry): Promise<void> {
  if (!u || !SUB.test(u.sub)) return;
  const key = `${u.sub}.json`;
  const old = await getJson<Entry[]>(INDEX_NS, key);
  await putJson(INDEX_NS, key, [...(Array.isArray(old) ? old : []), entry]);
}

/**
 * The user's orders and requests, newest first. A record counts only when its stored sub is this user's or its contact email
 * equals this user's verified email, so nobody sees another user's records.
 * ponytail: the email match scans every record file on each call; fine at current volume, add an email index or a DB past a few thousand records.
 */
export async function listMine(u: SessionUser): Promise<MyRecord[]> {
  const email = u.email.toLowerCase();
  const found = new Map<string, MyRecord>();
  const take = (type: 'order' | 'request', r: Record<string, unknown> | null) => {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') return;
    // records placed while signed in carry userSub/userEmail from the session; the typed contact email only counts for
    // older records with no owner, so nobody can push a record into someone else's list by typing their address
    const mine = r.userSub === u.sub
      || (typeof r.userEmail === 'string' && r.userEmail.toLowerCase() === email)
      || (!r.userSub && typeof r.email === 'string' && r.email.trim().toLowerCase() === email && String(r.createdAt ?? '') < ACCOUNTS_SINCE);
    if (!mine) return;
    found.set(`${type}-${r.id}`, {
      type, id: r.id, createdAt: String(r.createdAt ?? ''), status: String(r.status ?? ''),
      total: typeof r.total === 'number' ? r.total : null, currency: String(r.currency ?? ''),
      summary: type === 'order' ? `${Array.isArray(r.lines) ? r.lines.length : 1} item(s)` : `Design request: ${String(r.category ?? '')}`,
    });
  };
  const index = await getJson<Entry[]>(INDEX_NS, `${u.sub}.json`);
  for (const e of Array.isArray(index) ? index : []) {
    if (e && (e.type === 'order' || e.type === 'request') && UUID.test(e.id)) take(e.type, await getJson(FOLDER[e.type], `${e.id.toLowerCase()}.json`));
  }
  for (const type of ['order', 'request'] as const) {
    for (const k of await list(FOLDER[type])) {
      if (k.endsWith('.json') && !found.has(`${type}-${k.slice(0, -5)}`)) take(type, await getJson(FOLDER[type], k));
    }
  }
  return [...found.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * True when a record placed while signed in as `sub` references `file` (a model line's upload or a request image). Read-time fallback for
 * files stored before owner records existed: reads only this user's index, and a record counts only when its userSub (set from the session)
 * is `sub` and it was created before LEGACY_LINK_BEFORE, so neither a typed contact email, a forged index entry nor a new order links anyone.
 */
// Owner records went in after this instant (set before the change was deployed). Only records created before it can link a legacy file:
// otherwise anyone could place a free order naming someone else's file and unlock it.
export const LEGACY_LINK_BEFORE = '2026-11-27T12:40:00.000Z';

export async function linksFile(sub: string, file: string): Promise<boolean> {
  if (!SUB.test(sub)) return false;
  const index = await getJson<Entry[]>(INDEX_NS, `${sub}.json`);
  for (const e of Array.isArray(index) ? index : []) {
    if (!e || (e.type !== 'order' && e.type !== 'request') || !UUID.test(e.id)) continue;
    const r = await getJson<{ userSub?: unknown; createdAt?: unknown; lines?: unknown; names?: unknown }>(FOLDER[e.type], `${e.id.toLowerCase()}.json`);
    if (!r || r.userSub !== sub || !(String(r.createdAt ?? '') < LEGACY_LINK_BEFORE)) continue;
    const lines = Array.isArray(r.lines) ? r.lines.map((l: { file?: unknown } | null) => l?.file) : [];
    if ([...lines, ...(Array.isArray(r.names) ? r.names : [])].includes(file)) return true;
  }
  return false;
}
