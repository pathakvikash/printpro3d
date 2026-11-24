import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PartDetail from '@/components/PartDetail';
import { PARTS, partById } from '@/lib/parts';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => PARTS.map((p) => ({ id: p.id }));

// Plain metadata only: no Product or Offer data, because these parts are enquiry-only.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = partById((await params).id);
  return p ? { title: `${p.title} - PrintPro3D`, description: `${p.blurb} Reference model with a blueprint; enquire for availability.` } : {};
}

export default async function PartPage({ params }: Props) {
  const p = partById((await params).id);
  if (!p) notFound();
  return (
    <section className="bg-gray-50 py-8 dark:bg-gray-900 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6"><PartDetail part={p} /></div>
    </section>
  );
}
