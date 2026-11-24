// "Electronics & parts": the non-printed parts our kits list, offered by enquiry. Each card opens a part page with a reference 3D model and a blueprint.
// No prices, no cart, no stock. The sourced motors keep their citation and the 'Test it in Build' link.
import Link from 'next/link';
import { CATEGORY_LABEL, CATEGORY_ORDER, PARTS, REFERENCE_BADGE, isSourcedMotor } from '@/lib/parts';
import PartThumb from './PartThumb';

export default function MotorShelf() {
  return (
    <section aria-labelledby="parts-h" className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800">
      <h2 id="parts-h" className="text-xl font-semibold text-gray-900 dark:text-white">Electronics &amp; parts</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">The motors, props, boards and hardware our kits are designed around. Available from us — enquire for price. Each page has a reference 3D model and a blueprint, so you can check the sizes first.</p>
      {CATEGORY_ORDER.map((c) => {
        const list = PARTS.filter((p) => p.category === c);
        return list.length > 0 && (
          <div key={c} className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{CATEGORY_LABEL[c]}</h3>
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <li key={p.id} className="relative flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500">
                  <PartThumb id={p.id} size={64} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      <Link href={`/shop/part/${p.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">{p.title}</Link>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {p.source?.url ? <>Source: <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="relative z-10 text-indigo-600 underline dark:text-indigo-400">{p.source.label}</a></> : p.source ? `Source: ${p.source.label}` : REFERENCE_BADGE}
                    </p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Enquire for price</p>
                    {isSourcedMotor(p.id) && <Link href="/build?example=drone-plate&sim=1" className="relative z-10 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Test it in Build →</Link>}
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
