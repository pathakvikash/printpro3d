'use client';
// The "Bought separately" list on a kit page: each row keeps its text and links to the part pages we can enquire about.
import Link from 'next/link';
import { boughtPartIds, boughtText, type BoughtItem } from '@/lib/kits';
import { partById } from '@/lib/parts';
import PartThumb from './PartThumb';
import Term from './Term';

export default function BoughtList({ items, title = 'Bought separately' }: { items: BoughtItem[]; title?: string }) {
  return (
    <>
      <h2 id="kit-bought" className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="mb-2 mt-1 text-xs text-gray-600 dark:text-gray-400">Available from us — enquire for price. Specs are typical for this kind of build: check them against your parts.</p>
      <ul className="space-y-2.5 text-sm text-gray-800 dark:text-gray-200">
        {items.map((b) => {
          const text = boughtText(b);
          return (
            <li key={text}>
              <span>{text.split(/\b(FC|ESC|AIO)\b/).map((w, i) => (w === 'FC' || w === 'ESC' || w === 'AIO' ? <Term key={i} k={w.toLowerCase() as 'fc'}>{w}</Term> : w))}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {boughtPartIds(b).flatMap((id) => partById(id) ?? []).map((p) => (
                  <Link key={p.id} href={`/shop/part/${p.id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    <PartThumb id={p.id} size={24} />{p.title}
                  </Link>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
