// Who may read a stored upload. Owner records live in 'upload-owners' (key `${file}.json`); files without one are admin-only.
// `email` only ever comes from a verified session (or an Orrery token sub), never from a typed contact email. Server only.
import { emailAllowed, sessionEmail } from './adminAuth.ts';
import { sessionUser } from './account.ts';
import { bearerSub } from './orrery.ts';
import { getJson, putJson } from './store.ts';

export type Owner = { sub?: string; email?: string; guest?: string };
export const OWNERS = 'upload-owners';
export const GUEST_COOKIE = 'pp3d_guest';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The guest id from the cookie header, or null when absent or malformed. */
export function guestFromRequest(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === GUEST_COOKIE) {
      const id = v.join('=');
      return UUID.test(id) ? id.toLowerCase() : null;
    }
  }
  return null;
}

/** Owner of what this request stores: the signed-in session's sub/email plus a guest id (minted, with its Set-Cookie value, when the request has none). */
export async function ownerFor(request: Request, getUser: typeof sessionUser = sessionUser): Promise<{ owner: Owner; setCookie?: string }> {
  const u = await getUser();
  let guest = guestFromRequest(request);
  let setCookie: string | undefined;
  if (!guest) {
    guest = crypto.randomUUID();
    setCookie = `${GUEST_COOKIE}=${guest}; Path=/; SameSite=Lax; HttpOnly; Max-Age=31536000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  }
  return { owner: { ...(u ? { sub: u.sub, email: u.email } : {}), guest }, ...(setCookie ? { setCookie } : {}) };
}

/** Adds the guest Set-Cookie (when one was minted) to a response and returns it. */
export function withCookie<T extends Response>(res: T, setCookie?: string): T {
  if (setCookie) res.headers.append('Set-Cookie', setCookie);
  return res;
}

/** True when `file` already has an owner record. */
export const hasOwner = async (file: string): Promise<boolean> => (await getJson<Owner>(OWNERS, `${file}.json`)) !== null;

/** Stores who owns `file`, once: an existing record is never overwritten (returns false). An empty owner writes nothing.
 * ponytail: read then write, two simultaneous first writers can race; names are random so only an attacker who knows one could try. */
export async function recordOwner(file: string, owner: Owner): Promise<boolean> {
  if (!owner.sub && !owner.email && !owner.guest) return false;
  if (await hasOwner(file)) return false;
  await putJson(OWNERS, `${file}.json`, owner);
  return true;
}

export type JobInfo = { email: string; owner?: Owner };
export type AccessDeps = {
  admin: () => Promise<boolean>;
  user: () => Promise<{ sub: string; email: string } | null>;
  bearer: (request: Request) => { sub: string } | Response | null;
  owner: (file: string) => Promise<Owner | null>;
  jobOf: (file: string) => Promise<JobInfo | null>; // the AI job that made `file`; scans the job list, so called last
};

const real: AccessDeps = {
  admin: async () => emailAllowed(await sessionEmail(), undefined),
  user: sessionUser,
  bearer: bearerSub,
  owner: (file) => getJson<Owner>(OWNERS, `${file}.json`),
  async jobOf(file) {
    return (await import('./aiJobs.ts')).findJobByFile(file);
  },
};

/** Job ownership by VERIFIED identity. Website jobs: job.owner. Orrery jobs (no owner field, email = token sub): only for a bearer request. The typed contact email never counts. */
function jobMatches(j: JobInfo | null, who: { sub?: string; email: string }, bearer: boolean): boolean {
  if (!j) return false;
  if (j.owner) return j.owner.email === who.email || (!!who.sub && j.owner.sub === who.sub);
  return bearer && j.email.trim().toLowerCase() === who.email;
}

/** Admin, the file's owner (session, guest cookie), or an Orrery service token whose sub owns it. */
export async function canRead(request: Request, file: string, deps: AccessDeps = real): Promise<boolean> {
  if (await deps.admin()) return true;
  const owner = await deps.owner(file);
  const job = () => (file.toLowerCase().endsWith('.stl') ? deps.jobOf(file) : Promise.resolve(null));
  if (request.headers.get('authorization')) {
    const b = deps.bearer(request);
    if (!b || b instanceof Response) return false;
    return owner?.email === b.sub || jobMatches(await job(), { email: b.sub }, true);
  }
  const u = await deps.user();
  if (u && ((owner?.sub && owner.sub === u.sub) || (owner?.email && owner.email === u.email))) return true;
  const guest = guestFromRequest(request);
  if (guest && owner?.guest === guest) return true;
  return !!u && jobMatches(await job(), u, false);
}
