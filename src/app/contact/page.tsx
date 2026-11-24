import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = { title: 'Contact - PrintPro3D', description: 'How to reach PrintPro3D.' };

const ROUTES = [
  { href: '/request', title: 'Describe an idea', text: 'Tell us what you want to make. We review it and reply with a quote.' },
  { href: '/request?type=replacement', title: 'Replace a broken part', text: 'Share the original part and we review whether it can be reproduced.' },
  { href: '/track', title: 'Track an order', text: 'Enter the order id from your confirmation to see where it is.' },
];

export default function ContactPage() {
  const link = 'text-indigo-600 dark:text-indigo-400 underline hover:no-underline';
  return (
    <PageShell wide title="Contact" lead="The easiest way to reach us is through the site.">
      {/* OWNER: put a real email address and phone number here once you have decided to publish them */}
      <p className="text-gray-600 dark:text-gray-300">
        Send us a message with the <Link href="/request" className={link}>Describe your idea</Link> form, or check an existing order on the{' '}
        <Link href="/track" className={link}>Track</Link> page.
      </p>
      <ul className="grid gap-4 pt-2 md:grid-cols-3">
        {ROUTES.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="pp-lift group block h-full rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <span className="block text-lg font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">{r.title}</span>
              <span className="mt-2 block text-gray-600 dark:text-gray-300">{r.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

