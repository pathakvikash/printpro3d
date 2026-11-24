import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { AiDesignRoute } from '@/components/RoutePages';
import { modelFor, pickProvider } from '@/lib/aiDesign';
import { aiEnv } from '@/lib/aiSettings';

export const metadata: Metadata = { title: 'Draw it with AI - PrintPro3D', description: 'Describe a part or add a photo and get an editable 3D model made from simple shapes.' };
export const dynamic = 'force-dynamic';

export default async function DrawPage() {
  const env = await aiEnv();
  const provider = pickProvider(env);
  const enabled = (provider !== null && modelFor(provider, env) !== null) || process.env.NODE_ENV !== 'production';
  return (
    <PageShell title="Draw it with AI" lead="Describe it or add a photo; we draw a 3D model you can edit.">
      {enabled ? (
        <AiDesignRoute />
      ) : (
        <p className="text-gray-600 dark:text-gray-300">
          This is not available yet. You can{' '}
          <Link href="/request" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">describe your idea</Link> and we review it and send you a quote.
        </p>
      )}
    </PageShell>
  );
}
