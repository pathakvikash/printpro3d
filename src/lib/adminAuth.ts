// Gate for the admin API routes. Server only.
// Only a Google (Auth.js) session whose email is in ADMIN_EMAILS gets in; there is no password or token route.
// ADMIN_EMAILS unset: 503 "admin disabled".

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
export async function adminGate(_request: Request, env: Env = process.env, getEmail: () => Promise<string | null> = sessionEmail): Promise<Response | null> {
  if (adminEmails(env).length === 0) return Response.json({ error: 'admin disabled' }, { status: 503 });
  const signedIn = await getEmail();
  if (emailAllowed(signedIn, undefined, env)) return null; // signIn already required a verified email
  return signedIn ? Response.json({ error: 'not allowed' }, { status: 403 }) : Response.json({ error: 'Unauthorized' }, { status: 401 });
}

/** True outside production (NODE_ENV not production and VERCEL unset). */
export const isLocalDev = (env: Env = process.env) => env.NODE_ENV !== 'production' && !env.VERCEL;

/** Gate for the AI settings routes only: open outside production, the normal admin gate in production. */
export async function aiSettingsGate(request: Request, env: Env = process.env, getEmail: () => Promise<string | null> = sessionEmail): Promise<Response | null> {
  if (isLocalDev(env)) return null;
  return adminGate(request, env, getEmail);
}
