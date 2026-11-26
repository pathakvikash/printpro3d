import type { Metadata } from 'next';
import AdminAccess from '@/components/AdminAccess';
import AdminPanel from '@/components/AdminPanel';

export const metadata: Metadata = {
  title: 'Admin - PrintPro3D',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Admin: AI settings, orders and requests</h1>
      <AdminAccess path="/admin" error={error}>
        <AdminPanel />
      </AdminAccess>
    </main>
  );
}
