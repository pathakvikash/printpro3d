import Icon, { type IconName } from '@/components/Icon';
import { Spool } from '@/components/Art';
import { COLOUR } from '@/components/MaterialCards';
import { BED_MM, MATERIALS, MAX_QTY, type MaterialKey } from '@/lib/quote';
import { ALLOWED_EXTS, MAX_UPLOAD } from '@/lib/uploadRules';
import { LAYER_MM } from '@/lib/printSpec';

const chip = 'inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

// Values come only from code. Tolerance and lead time are owner-pending: not in code, so not shown.
const FACTS: { k: string; icon: IconName; v: React.ReactNode }[] = [
  { k: 'Build volume', icon: 'cube', v: `${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm` },
  { k: 'Materials', icon: 'spark', v: <span className="flex flex-wrap gap-1">{(Object.keys(MATERIALS) as MaterialKey[]).map((m) => <span key={m} className={chip}><Spool color={COLOUR[m]} />{m}</span>)}</span> },
  { k: 'File types', icon: 'file', v: <span className="flex flex-wrap gap-1">{ALLOWED_EXTS.map((e) => <span key={e} className={`${chip} font-mono`}>{e.slice(1).toUpperCase()}</span>)}</span> },
  { k: 'Max file size', icon: 'drive', v: `${MAX_UPLOAD / 1024 / 1024} MB` },
  { k: 'Typical layer height', icon: 'layers', v: `${LAYER_MM} mm (assumed)` }, // printSpec: owner to confirm
  { k: 'Quantity per line', icon: 'hash', v: `1 to ${MAX_QTY}` },
];

export default function Capabilities() {
  return (
    <section aria-label="What we can print" className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-8 sm:px-6 md:grid-cols-3 lg:grid-cols-6">
        {FACTS.map((f) => (
          <div key={f.k}>
            <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400"><Icon name={f.icon} className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />{f.k}</dt>
            <dd className="mt-1.5 font-semibold text-gray-900 dark:text-white">{f.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
