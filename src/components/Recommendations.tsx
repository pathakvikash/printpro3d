// Product page extras: related printed parts and the bought-separately list. Renders nothing when there is nothing to say.
import Link from 'next/link';
import { CATALOG, shopCat, shopCatLabel } from '@/lib/catalog';
import { recommendFor } from '@/lib/recommend';
import { TEMPLATES } from '@/lib/templateDefs';

const nameOf = (id: string) => CATALOG.find((x) => x.id === id)?.name ?? TEMPLATES.find((x) => x.id === id)?.name ?? id;

export default function Recommendations({ id }: { id: string }) {
  const { pairsWith, boughtParts } = recommendFor(id);
  if (!pairsWith.length && !boughtParts.length) return null;
  return (
    <div className="space-y-6">
      {pairsWith.length > 0 && (
        <section aria-labelledby="pairs-h" className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <h2 id="pairs-h" className="text-lg font-semibold text-gray-900 dark:text-white">Pairs well with</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pairsWith.map((p) => (
              <li key={p}>
                <Link href={`/shop/${p}`} className="block h-full rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500">
                  <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{shopCatLabel(shopCat(p) ?? '')}</span>
                  <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">{nameOf(p)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {boughtParts.length > 0 && (
        <section aria-labelledby="need-h" className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <h2 id="need-h" className="text-lg font-semibold text-gray-900 dark:text-white">You will also need (bought separately)</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Not sold here. Figures come from the cited source or are marked typical.</p>
          <ul className="mt-3 space-y-3">
            {boughtParts.map((b) => (
              <li key={b.name} className="rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{b.name}</p>
                <p className="mt-0.5 text-gray-700 dark:text-gray-300">{b.spec}</p>
                <p className="mt-0.5 text-gray-500 dark:text-gray-400">{b.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
