import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageShell from '@/components/PageShell';
import ShopRoute from '@/components/ShopRoute';
import FlowStrip from '@/components/FlowStrip';

export const metadata: Metadata = { title: 'Shop - 3D printing, laser cutting and materials - PrintPro3D', description: 'Drone, RC, robotics, toy and hobby parts printed to order, plus filament, resin and laser sheets by enquiry.' };

export default function ShopPage() {
  return (
    <PageShell wide title="Shop" lead="Drone, RC, robotics and hobby parts, printed to order. Open a part to see it in 3D with its drawing.">
      <FlowStrip current="pick" />
      <Suspense><ShopRoute /></Suspense>
    </PageShell>
  );
}
