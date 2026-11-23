import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = { title: 'About - PrintPro3D', description: 'A made-to-order 3D printing service. Every order is reviewed before you pay.' };

export default function AboutPage() {
  const link = 'text-indigo-600 dark:text-indigo-400 underline hover:no-underline';
  return (
    <PageShell title="About" lead="PrintPro3D is a made-to-order 3D printing service.">
      <p className="text-gray-600 dark:text-gray-300">
        We print what you ask for, one piece or many: game pieces, gadgets, electronics frames, toys and drone or RC bodies. Nothing is printed ahead of time.
      </p>
      <p className="text-gray-600 dark:text-gray-300">
        We review each order and send a payment link before printing.
      </p>
      {/* OWNER: add business name, city, address and GSTIN here once you decide to publish them. Render nothing until then. */}
      <p>
        <Link href="/quote" className={link}>Get an instant quote</Link>
      </p>
    </PageShell>
  );
}
