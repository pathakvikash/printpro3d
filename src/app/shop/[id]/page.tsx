import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/ProductDetail';
import { CATALOG, shopVisible } from '@/lib/catalog';
import { KITS } from '@/lib/kits';
import { TEMPLATES } from '@/lib/templateDefs';

type Props = { params: Promise<{ id: string }> };

const visible = () => [...shopVisible(CATALOG), ...shopVisible(TEMPLATES), ...shopVisible(KITS)];
const find = (id: string) => visible().find((x) => x.id === id);

export const dynamicParams = false;
export const generateStaticParams = () => visible().map((x) => ({ id: x.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const x = find((await params).id);
  if (!x) return {};
  return { title: `${'title' in x ? x.title : x.name} - PrintPro3D`, description: 'description' in x ? x.description : x.blurb };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!find(id)) notFound();
  // the product is the page: its own h1 and Back to Shop link
  return (
    <section className="bg-gray-50 py-8 dark:bg-gray-900 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6"><ProductDetail id={id} /></div>
    </section>
  );
}
