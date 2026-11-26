import { signOut } from '@/auth';

// The header's Sign out is a plain form POST here, so the menu needs no client auth code.
// Same-origin only: without this any other site could auto-submit a form and sign visitors out (logout CSRF).
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
  await signOut({ redirectTo: '/' });
}
