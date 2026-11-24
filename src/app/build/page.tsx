import { Suspense } from 'react';
import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import { BuildRoute } from '@/components/RoutePages';

export const metadata: Metadata = { title: 'Design and build - PrintPro3D', description: 'Plan a part with AI or from a template, approve the plan, then get a price. Or build it yourself from shapes.' };

export default function BuildPage() {
  return (
    <PageShell wide back={{ href: '/shop', label: 'Back to Shop' }} title="Design and build" lead="Plan it, approve the plan, then we build the print file and give you a price. Or make a model from shapes yourself.">
      <Suspense fallback={null}>
        <BuildRoute />
      </Suspense>
    </PageShell>
  );
}
