'use client';
// One enquiry-only shelf: groups of cards, each with "Price on request" and an Enquire link. No prices, no cart, no stock, no photos.
// Used for "Made to order" (lib/madeToOrder.ts) and "Materials" (lib/supplies.ts) on /shop.
import Link from 'next/link';
import { useEffect } from 'react';
import Icon from './Icon';
import { addBtn } from './ShopParts';

export type ShelfItem = { id: string; group: string; alsoIn?: string[]; title: string; blurb: string; tag?: string; rows?: [string, string][]; href: string };

export default function CatalogShelf({ id, title, lead, groups, items }: {
  id: string; title: string; lead: string; groups: { id: string; label: string }[]; items: ShelfItem[];
}) {
  // the shelf renders client-side after the browser's own hash scroll, so scroll here (again once the cards above have settled)
  useEffect(() => {
    if (location.hash !== `#${id}`) return;
    const go = () => document.getElementById(id)?.scrollIntoView();
    go();
    const h = setTimeout(go, 500);
    return () => clearTimeout(h);
  }, [id]);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`mt-10 scroll-mt-20 border-t border-gray-200 pt-6 dark:border-gray-800`}>
      <h2 id={`${id}-h`} className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{lead}</p>
      {groups.map((g) => {
        const list = items.filter((s) => s.group === g.id || s.alsoIn?.includes(g.id));
        return list.length > 0 && (
          <div key={g.id} className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{g.label}</h3>
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{s.title}</h4>
                  {s.tag && <p className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{s.tag}</p>}
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.blurb}</p>
                  {s.rows && (
                    <dl className="divide-y divide-gray-100 border-y border-gray-100 text-sm dark:divide-gray-800 dark:border-gray-800">
                      {s.rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 py-1">
                          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                          <dd className="text-right text-gray-900 dark:text-gray-100">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">Price on request</p>
                  <div className="mt-auto flex pt-1">
                    <Link href={s.href} aria-label={`Enquire about ${s.title}`} title={`Enquire about ${s.title}`} className={addBtn}><Icon name="cart" />Enquire</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
