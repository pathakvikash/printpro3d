import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = { title: 'Contact - PrintPro3D', description: 'How to reach PrintPro3D.' };

export default function ContactPage() {
  const link = 'text-indigo-600 dark:text-indigo-400 underline hover:no-underline';
  return (
    <PageShell title="Contact" lead="The easiest way to reach us is through the site.">
      {/* OWNER: put a real email address and phone number here once you have decided to publish them */}
      <p className="text-gray-600 dark:text-gray-300">
        Send us a message with the <Link href="/request" className={link}>Describe your idea</Link> form, or check an existing order on the{' '}
        <Link href="/track" className={link}>Track</Link> page.
      </p>
    </PageShell>
  );
}

