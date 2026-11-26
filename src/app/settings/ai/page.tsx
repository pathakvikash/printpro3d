import type { Metadata } from 'next';
import AdminAccess from '@/components/AdminAccess';
import AdminAiSettings from '@/components/AdminAiSettings';

export const metadata: Metadata = {
  title: 'AI settings - PrintPro3D',
  robots: { index: false, follow: false },
};

export default function AiSettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">AI settings</h1>
      <AdminAccess path="/settings/ai" localOpen>
        <AdminAiSettings />
      </AdminAccess>
    </main>
  );
}
