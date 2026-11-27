import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import UploadForm from '@/components/UploadForm';
import Capabilities from '@/components/Capabilities';
import MaterialCards from '@/components/MaterialCards';
import { sessionEmail } from '@/lib/adminAuth';
import { preselectFile } from '@/lib/orreryServer';

export const metadata: Metadata = { title: 'Get a quote - PrintPro3D', description: 'Upload an STL or OBJ file and get an instant price for your 3D print.' };

// same wording as the How it works page
const STEPS = [
  { title: 'Start your way', text: 'Upload your file, describe an idea or a part to replace, or pick a ready item.' },
  { title: 'Choose material and quantity', text: 'The price updates as you choose.' },
  { title: 'We review, confirm and print', text: 'We review every order and send you a payment link before we print it.' },
];
const NO_FILE = [
  { href: '/shop', label: 'Pick a ready item in the shop' },
  { href: '/request', label: 'Describe an idea or a part to replace' },
  { href: '/playground', label: 'Build a part yourself' },
];
const link = 'font-medium text-indigo-600 underline hover:no-underline dark:text-indigo-400';

const side = (
  <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
    <section aria-labelledby="next-h">
      <h2 id="next-h" className="text-lg font-semibold text-gray-900 dark:text-white">What happens next</h2>
      <ol className="mt-3 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{i + 1}</span>
            <p className="text-sm text-gray-600 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">{s.title}.</strong> {s.text}</p>
          </li>
        ))}
      </ol>
    </section>
    <section aria-labelledby="nofile-h">
      <h2 id="nofile-h" className="text-lg font-semibold text-gray-900 dark:text-white">No file?</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {NO_FILE.map((l) => <li key={l.href}><Link href={l.href} className={link}>{l.label}</Link></li>)}
      </ul>
    </section>
  </div>
);

const below = (
  <>
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700"><Capabilities /></div>
    <section aria-labelledby="mat-h" className="space-y-3">
      <h2 id="mat-h" className="text-lg font-semibold text-gray-900 dark:text-white">Materials</h2>
      <MaterialCards />
    </section>
  </>
);

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ file?: string; job?: string }> }) {
  const q = await searchParams;
  // ?file= / ?job= (from Orrery or the AI page) preselect a generated model, but only the signed-in user's own
  const preselect = q.file || q.job ? await preselectFile(q, await sessionEmail(true)) : null;
  return (
    <PageShell wide title="Get a quote" lead="Upload your 3D file, pick a material and quantity, and see the price.">
      <UploadForm idle={{ side, below }} preselect={preselect ?? undefined} />
    </PageShell>
  );
}
