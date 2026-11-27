// Server component: sign-in / denied / off states around the admin panels. No client JS, no SessionProvider.
import type { ReactNode } from 'react';
import { auth, signIn, signOut } from '@/auth';
import { adminEmails, emailAllowed, isLocalDev } from '@/lib/adminAuth';
import { card, secondaryBtn, submitBtn } from './ContactFields';

export default async function AdminAccess({ path, localOpen = false, children }: { path: string; localOpen?: boolean; children: ReactNode }) {
  if (localOpen && isLocalDev()) return <>{children}</>; // AI settings stay open without sign-in outside production
  if (adminEmails().length === 0) return <p role="alert" className={`${card} max-w-md text-sm text-gray-700 dark:text-gray-300`}>Admin is off: ADMIN_EMAILS is not set on this server.</p>;
  const su = (await auth().catch(() => null))?.user as { email?: string | null; via?: string } | undefined;
  const email = su?.via === 'orrery' ? null : su?.email ?? null; // an Orrery handoff session is never admin
  const out = async () => { 'use server'; await signOut({ redirectTo: path }); };
  if (email && emailAllowed(email, undefined)) {
    return (
      <>
        <form action={out} className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <span>Signed in as {email}</span>
          <button type="submit" className={secondaryBtn}>Sign out</button>
        </form>
        {children}
      </>
    );
  }
  const denied = !!email; // signed in with a Google account that is not in ADMIN_EMAILS
  return (
    <div className={`${card} max-w-md`}>
      {denied && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">This Google account is not allowed.</p>}
      <p className="text-sm text-gray-700 dark:text-gray-300">{denied ? 'Sign in with the owner Google account instead.' : 'Only the owner can open this page.'}</p>
      <form action={async () => { 'use server'; await signIn('google', { redirectTo: path }); }}>
        <button type="submit" className={submitBtn}>Sign in with Google</button>
      </form>
      {denied && <form action={out}><button type="submit" className={secondaryBtn}>Sign out ({email})</button></form>}
    </div>
  );
}
