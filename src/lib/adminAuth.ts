// Bearer-token gate for the admin API routes. Server only.
// ADMIN_TOKEN unset: 503 "admin disabled". Wrong token: a 1 s delay and a per-IP failure count; after MAX_FAILS in an hour, 429.
import { createHash, timingSafeEqual } from 'node:crypto';
import { clientIp, hit, seen } from './spam.ts';

export const MAX_FAILS = 10;
const sha = (s: string) => createHash('sha256').update(s).digest(); // equal lengths, so timingSafeEqual cannot throw

/** True when `header` is `Bearer <token>` with the right token. Constant-time compare. */
export function tokenOk(header: string | null, token: string): boolean {
  const m = /^Bearer (.+)$/.exec(header ?? '');
  return timingSafeEqual(sha(m?.[1] ?? ''), sha(token)) && m !== null;
}

/** null when the request may continue, otherwise the error Response to return. */
export async function adminGate(request: Request, delayMs = 1000): Promise<Response | null> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return Response.json({ error: 'admin disabled' }, { status: 503 });
  const ip = clientIp(request);
  if ((await seen('admin-fail', ip)) >= MAX_FAILS) return Response.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
  if (tokenOk(request.headers.get('authorization'), token)) return null;
  await hit('admin-fail', ip, MAX_FAILS);
  await new Promise((r) => setTimeout(r, delayMs));
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
