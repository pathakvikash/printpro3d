import { BED_MM, MATERIALS, MAX_QTY } from '@/lib/quote';
import { ALLOWED_EXTS, MAX_UPLOAD } from '@/lib/uploadRules';
import { LAYER_MM } from '@/lib/printSpec';

// Values come only from code. Tolerance and lead time are owner-pending: not in code, so not shown.
const FACTS: [string, string][] = [
  ['Build volume', `${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`],
  ['Materials', Object.keys(MATERIALS).join(' · ')],
  ['File types', ALLOWED_EXTS.map((e) => e.slice(1).toUpperCase()).join(', ')],
  ['Max file size', `${MAX_UPLOAD / 1024 / 1024} MB`],
  ['Typical layer height', `${LAYER_MM} mm (assumed)`], // printSpec: owner to confirm
  ['Quantity per line', `1 to ${MAX_QTY}`],
];

export default function Capabilities() {
  return (
    <section aria-label="What we can print" className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-8 sm:px-6 md:grid-cols-3 lg:grid-cols-6">
        {FACTS.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">{k}</dt>
            <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
