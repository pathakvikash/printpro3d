import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import CreditLine from '@/components/KitCredit';
import { KITS } from '@/lib/kits';

export const metadata: Metadata = { title: 'Credits - PrintPro3D', description: 'Third-party designs we print, with their authors, licences and source links.' };

export default function CreditsPage() {
  const credited = KITS.filter((k) => k.credit);
  return (
    <PageShell wide title="Credits" lead="Some kits are designs by other people, shared under open licences. We print their files and credit them here and on each kit page.">
      <ul className="space-y-4">
        {credited.map((k) => (
          <li key={k.id} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white"><Link href={`/shop/${k.id}`} className="hover:underline">{k.title}</Link></h2>
            <CreditLine credit={k.credit!} files className="mt-2 break-words text-sm" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Printed parts are the upstream STL files. Where we repaired or simplified a file for printing, the kit's credits file says exactly what changed. The licence text is next to the files (see the licence link above).</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gray-600 dark:text-gray-400">The other kits and parts in the shop are our own designs. Motor figures come from the sources cited on their part pages.</p>
    </PageShell>
  );
}
