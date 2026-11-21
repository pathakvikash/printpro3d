import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import { ShopRoute } from '@/components/RoutePages';

export const metadata: Metadata = { title: 'Shop ready-made parts - PrintPro3D', description: 'Our own designs, printed to order. Pick a part, a material and a quantity.' };

export default function ShopPage() {
  return (
    <PageShell title="Shop" lead="Our own designs, printed to order. Tap a part to see it in 3D.">
      <ShopRoute />
    </PageShell>
  );
}
