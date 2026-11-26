import { signOut } from '@/auth';

// The header's Sign out is a plain form POST here, so the menu needs no client auth code.
export async function POST() {
  await signOut({ redirectTo: '/' });
}
