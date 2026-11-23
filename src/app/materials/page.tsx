import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { BED_MM, CURRENCY, MATERIALS, MAX_QTY, type MaterialKey } from '@/lib/quote';
import { ALLOWED_EXTS, MAX_UPLOAD } from '@/lib/uploadRules';
import { MATERIAL_INFO } from '@/lib/materialInfo';
import MaterialCards from '@/components/MaterialCards';

export const metadata: Metadata = { title: 'Materials - PrintPro3D', description: 'The plastics we print in: PLA, PETG, ABS and TPU, with what each is good for.' };

const KEYS = Object.keys(MATERIALS) as MaterialKey[];

const CAPABILITIES: [string, string][] = [
  ['Print bed', `${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`],
  ['Materials', KEYS.join(', ')],
  ['File types', ALLOWED_EXTS.map((e) => e.slice(1).toUpperCase()).join(', ')],
  ['Maximum file size', `${MAX_UPLOAD / 1024 / 1024} MB`],
  ['Maximum quantity per line', String(MAX_QTY)],
];

const th = 'px-4 py-3 text-left font-semibold text-gray-900 dark:text-white';
const td = 'px-4 py-3 text-gray-600 dark:text-gray-300';

export default function MaterialsPage() {
  return (
    <PageShell wide title="Materials" lead="Each material has its own live price on the quote step.">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What we can print</h2>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <table className="w-full text-sm">
          <caption className="sr-only">Printing capabilities</caption>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {CAPABILITIES.map(([k, v]) => (
              <tr key={k}>
                <th scope="row" className={th}>{k}</th>
                <td className={td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">Only STL and OBJ files get an instant price. Other file types are accepted and quoted by hand.</p>
      <h2 className="pt-4 text-2xl font-bold text-gray-900 dark:text-white">Compare materials</h2>
      <MaterialCards />
      <p className="text-sm text-gray-600 dark:text-gray-400">The words compare the four materials with each other. They are not measurements.</p>
      <h2 className="pt-4 text-2xl font-bold text-gray-900 dark:text-white">Price per material</h2>
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
        <Link href="/quote" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">Get an instant quote</Link> to see the price for your part.
      </p>
    </PageShell>
  );
}
