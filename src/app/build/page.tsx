import { Suspense } from 'react';
import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import { BuildRoute } from '@/components/RoutePages';

export const metadata: Metadata = { title: 'Build it yourself - PrintPro3D', description: 'Make a simple 3D model from shapes in your browser and get a price.' };

export default function BuildPage() {
  return (
    <PageShell wide title="Build it yourself" lead="Make a simple model from shapes, then get a price for it.">
      <Suspense fallback={null}>
        <BuildRoute />
      </Suspense>
    </PageShell>
  );
}
