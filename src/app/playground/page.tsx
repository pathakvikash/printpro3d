import { Suspense } from 'react';
import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import PlaygroundHub from '@/components/PlaygroundHub';

export const metadata: Metadata = {
  title: 'Playground: inspect and build - PrintPro3D',
  description: 'Inspect any shop part or kit in 3D with its blueprint, then modify it or build your own from shapes and simulate it. Then send it to Get a quote.',
};

export default function PlaygroundPage() {
  return (
    <PageShell wide title="Playground" lead="Inspect any part or kit in 3D with its drawing, then modify it or build your own and simulate it.">
      <Suspense fallback={null}>
        <PlaygroundHub />
      </Suspense>
    </PageShell>
  );
}
