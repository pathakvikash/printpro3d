import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageShell from '@/components/PageShell';
import ExampleBlueprint from '@/components/ExampleBlueprint';
import { CATALOG } from '@/lib/catalog';
import { exampleById } from '@/lib/examples';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => CATALOG.map((i) => ({ id: i.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = CATALOG.find((i) => i.id === id);
  return item ? { title: `Blueprint: ${item.name} - PrintPro3D`, description: `Three-view drawing of ${item.name} with dimensions in mm.` } : {};
}

export default async function BlueprintPage({ params }: Props) {
  const { id } = await params;
  const item = CATALOG.find((i) => i.id === id);
  const ex = item && exampleById(item.exampleId);
  if (!item || !ex) notFound();
  return (
    <PageShell wide title={`Blueprint: ${item.name}`} lead="Drawn from the same mesh the price is computed from. Check the size before you order.">
      <ExampleBlueprint id={item.id} />
    </PageShell>
  );
}
