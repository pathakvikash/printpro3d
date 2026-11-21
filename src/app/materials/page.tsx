import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { CURRENCY, MATERIALS, type MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

export const metadata: Metadata = { title: 'Materials - PrintPro3D', description: 'The plastics we print in: PLA, PETG, ABS and TPU, with what each is good for.' };

const KEYS = Object.keys(MATERIALS) as MaterialKey[];

export default function MaterialsPage() {
  return (
    <PageShell wide title="Materials" lead="Each material has its own live price on the quote step.">
      <ul className="grid gap-4 sm:grid-cols-2">
        {KEYS.map((k) => (
          <li key={k} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{MATERIAL_INFO[k].label}</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{MATERIAL_INFO[k].blurb}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Density</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{MATERIALS[k].density} g/cm³</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Rate</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{CURRENCY} {MATERIALS[k].rate} per gram</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-gray-600 dark:text-gray-400">
        Rates are what the quote uses today and may change.{' '}
        <Link href="/quote" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">Get a quote</Link> to see the price for your part.
      </p>
    </PageShell>
  );
}
