import type { Metadata } from 'next';
import AdminPanel from '@/components/AdminPanel';

export const metadata: Metadata = {
  title: 'Admin - PrintPro3D',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Orders and requests</h1>
      <AdminPanel />
    </main>
  );
}
