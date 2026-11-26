// Tiny client-side look at the Auth.js session: one lazy fetch of /api/auth/session, no next-auth client code, no provider.
// The server is the real gate; `admin` only decides which menu links to show.
import { useEffect, useState } from 'react';

export type AccountUser = { name?: string | null; email?: string | null; image?: string | null; admin?: boolean };

let cached: Promise<AccountUser | null> | undefined;
export const loadUser = () => (cached ??= fetch('/api/auth/session', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => (d?.user?.email ? (d.user as AccountUser) : null))
  .catch(() => null));

/** undefined while loading (or before the delay), null signed out. */
export function useAccountUser(delayMs = 0): AccountUser | null | undefined {
  const [u, setU] = useState<AccountUser | null | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => { void loadUser().then(setU); }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return u;
}
