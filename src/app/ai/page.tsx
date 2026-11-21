import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { AiGenerateRoute } from '@/components/RoutePages';

export const metadata: Metadata = { title: 'Generate with AI - PrintPro3D', description: 'Describe a part or add a photo and get a 3D model to print.' };
// the AI choice depends on MESHY_API_KEY at runtime
export const dynamic = 'force-dynamic';

export default function AiPage() {
  const enabled = Boolean(process.env.MESHY_API_KEY);
  return (
    <PageShell title="Generate with AI" lead="Describe a part or add a photo and we generate a 3D model.">
      {enabled ? (
        <AiGenerateRoute />
      ) : (
        <p className="text-gray-600 dark:text-gray-300">
          This is not available yet. You can{' '}
          <Link href="/request" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">describe your idea</Link> and we design it for you.
        </p>
      )}
    </PageShell>
  );
}
