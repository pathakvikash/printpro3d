import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageShell from '@/components/PageShell';
import ShopRoute from '@/components/ShopRoute';

export const metadata: Metadata = { title: 'Shop ready-made parts - PrintPro3D', description: 'Drone, RC, robotics, toy and hobby parts printed to order. Pick a part, a material and a quantity.' };

export default function ShopPage() {
  return (
    <PageShell wide title="Shop" lead="Drone, RC, robotics and hobby parts, printed to order. Open a part to see it in 3D with its drawing.">
      <Suspense><ShopRoute /></Suspense>
    </PageShell>
  );
}
