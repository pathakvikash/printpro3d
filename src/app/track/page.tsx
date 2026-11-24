import { Suspense } from 'react';
import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import TrackOrder from '@/components/TrackOrder';

export const metadata: Metadata = { title: 'Track your order - PrintPro3D', description: 'Check the status of your order or design request with its id.' };

export default function TrackPage() {
  return (
    <PageShell wide title="Track your order" lead="Enter the id from your confirmation to see where your order is.">
      <Suspense fallback={null}>
        <TrackOrder />
      </Suspense>
    </PageShell>
  );
}
