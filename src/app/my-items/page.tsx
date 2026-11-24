import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import MyItems from '@/components/MyItems';

export const metadata: Metadata = { title: 'My items - PrintPro3D', description: 'Models you saved, with your material and colour choices, ready to order again.' };

export default function MyItemsPage() {
  return (
    <PageShell title="My items" lead="Your saved models with your preferences. Order again in one click.">
      <MyItems />
    </PageShell>
  );
}
