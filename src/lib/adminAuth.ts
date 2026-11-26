// Gate for the admin API routes. Server only.
// Primary: a Google (Auth.js) session whose email is in ADMIN_EMAILS. Fallback for scripts: Bearer ADMIN_TOKEN, when set.
// Neither ADMIN_EMAILS nor ADMIN_TOKEN set: 503 "admin disabled". A bad bearer token: 1 s delay and a per-IP failure count; after MAX_FAILS in an hour, 429.
import { createHash, timingSafeEqual } from 'node:crypto';
import { clientIp, hit, seen } from './spam.ts';

export const MAX_FAILS = 10;
const sha = (s: string) => createHash('sha256').update(s).digest(); // equal lengths, so timingSafeEqual cannot throw

/** True when `header` is `Bearer <token>` with the right token. Constant-time compare. */
export function tokenOk(header: string | null, token: string): boolean {
  const m = /^Bearer (.+)$/.exec(header ?? '');
  return timingSafeEqual(sha(m?.[1] ?? ''), sha(token)) && m !== null;
}

type Env = Record<string, string | undefined>;

/** ADMIN_EMAILS (comma-separated) as a lower-cased, trimmed list. */
export const adminEmails = (env: Env = process.env) => (env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/** True when `email` is in ADMIN_EMAILS (exact, case-insensitive) and, when `verified` is given, Google says it is verified. */
export function emailAllowed(email: string | null | undefined, verified: boolean | undefined, env: Env = process.env): boolean {
  if (verified === false || typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  return e !== '' && adminEmails(env).includes(e);
}

/** The signed-in Google email from the Auth.js session cookie, or null. */
export async function sessionEmail(): Promise<string | null> {
  try {
    return (await (await import('../auth.ts')).auth())?.user?.email ?? null;
  } catch {
    return null; // e.g. AUTH_SECRET missing
  }
}

/** null when the request may continue, otherwise the error Response to return. `getEmail` is injectable for tests. */
export async function adminGate(request: Request, delayMs = 1000, env: Env = process.env, getEmail: () => Promise<string | null> = sessionEmail): Promise<Response | null> {
  const token = env.ADMIN_TOKEN;
  if (!token && adminEmails(env).length === 0) return Response.json({ error: 'admin disabled' }, { status: 503 });
  const signedIn = await getEmail();
  if (emailAllowed(signedIn, undefined, env)) return null; // signIn already required a verified email
  const header = request.headers.get('authorization');
  if (!token || !header) {
    return signedIn ? Response.json({ error: 'not allowed' }, { status: 403 }) : Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ip = clientIp(request);
  if ((await seen('admin-fail', ip)) >= MAX_FAILS) return Response.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
  if (tokenOk(header, token)) return null;
  await hit('admin-fail', ip, MAX_FAILS);
  await new Promise((r) => setTimeout(r, delayMs));
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/** True outside production (NODE_ENV not production and VERCEL unset). */
export const isLocalDev = (env: Env = process.env) => env.NODE_ENV !== 'production' && !env.VERCEL;

/** Gate for the AI settings routes only: open outside production, the normal admin gate in production. */
export async function aiSettingsGate(request: Request, env: Env = process.env, delayMs = 1000, getEmail: () => Promise<string | null> = sessionEmail): Promise<Response | null> {
  if (isLocalDev(env)) return null;
  return adminGate(request, delayMs, env, getEmail);
}
