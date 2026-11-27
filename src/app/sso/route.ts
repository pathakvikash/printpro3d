import { NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { safeNext } from '@/lib/orrery';

export const dynamic = 'force-dynamic';

// Orrery hands the user over here with a 60 s single-use token. Auth.js's 'orrery' provider verifies it (and burns its jti) and sets
// the session cookie, then we go to a same-origin relative path. Any failure sends the user to the normal Google sign-in page.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = q.get('token') ?? '';
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  if (!token) return go('/account');
  try {
    const url = await signIn('orrery', { token, redirect: false }); // sets the session cookie; returns a URL with ?error= on failure
    if (typeof url === 'string' && !/[?&]error=/.test(url)) return go(safeNext(q.get('next')));
  } catch {
    // a bad, expired or replayed token: fall through to the normal sign-in
  }
  return go('/account');
}
