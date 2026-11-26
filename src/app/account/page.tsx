import Link from 'next/link';
import type { Metadata } from 'next';
import { signIn } from '@/auth';
import { sessionUser, listMine } from '@/lib/account';
import { emailAllowed } from '@/lib/adminAuth';
import { card, money, secondaryBtn, submitBtn } from '@/components/ContactFields';

export const metadata: Metadata = { title: 'My orders - PrintPro3D', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '');

export default async function AccountPage() {
  const user = await sessionUser();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">My orders</h1>
      {!user ? (
        <div className={`${card} max-w-md`}>
          <p className="text-sm text-gray-700 dark:text-gray-300">Sign in with Google to see your orders and design requests in one place. We keep only your Google name, email and account id, to link your orders to you.</p>
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/account' }); }}>
            <button type="submit" className={submitBtn}>Sign in with Google</button>
          </form>
        </div>
      ) : (
        <Mine user={user} />
      )}
    </main>
  );
}

async function Mine({ user }: { user: NonNullable<Awaited<ReturnType<typeof sessionUser>>> }) {
  const recs = await listMine(user);
  return (
    <div className="space-y-4">
      <form action="/account/signout" method="post" className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
        <span>Signed in as {user.email}</span>
        <button type="submit" className={secondaryBtn}>Sign out</button>
        {emailAllowed(user.email, undefined) && <Link href="/admin" className="underline">Admin</Link>}
      </form>
      {recs.length === 0 && <p className="text-gray-600 dark:text-gray-300">No orders yet. <Link href="/shop" className="underline">Browse the shop</Link>.</p>}
      <ul className="space-y-3">
        {recs.map((r) => (
          <li key={`${r.type}-${r.id}`} className={`${card} !space-y-1`}>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{r.summary} · {when(r.createdAt)}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Status: {r.status.replace(/_/g, ' ')}{r.total !== null ? ` · ${money.format(r.total)}` : ''}
            </p>
            <Link href={`/track?id=${r.id}`} className="text-sm font-medium text-indigo-700 underline dark:text-indigo-300">Track</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
