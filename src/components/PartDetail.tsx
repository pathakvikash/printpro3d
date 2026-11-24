'use client';
// One electronics part: reference 3D model, blueprint, standard dimensions, accuracy and source, and an enquiry link. No price, no cart.
import { useMemo } from 'react';
import Link from 'next/link';
import { KITS, kitsUsingPart } from '@/lib/kits';
import { CATEGORY_LABEL, LIPO_NOTE, REFERENCE_BADGE, isSourcedMotor, type Part } from '@/lib/parts';
import { partMesh, partReference } from '@/lib/partModels';
import { BackToShop, SpecRows } from './ShopParts';
import { submitBtn } from './ContactFields';
import ModelWithBlueprint from './ModelWithBlueprint';

export default function PartDetail({ part }: { part: Part }) {
  const mesh = useMemo(() => partMesh(part), [part]);
  const reference = useMemo(() => partReference(part), [part]);
  const kits = kitsUsingPart(part.id, KITS);
  return (
    <div className="space-y-6">
      <BackToShop />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Electronics &amp; parts · {CATEGORY_LABEL[part.category]}</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{part.title}</h1>
        <p className="mt-2 max-w-3xl text-gray-700 dark:text-gray-300">{part.blurb}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {mesh
            ? <ModelWithBlueprint positions={mesh} name={part.title} id={part.id} reference={reference} />
            : <p role="alert" className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">The reference model could not be built.</p>}
        </div>
        <aside aria-label="Part details" className="min-w-0 space-y-4 self-start rounded-xl border border-gray-200 p-4 lg:sticky lg:top-20 dark:border-gray-700">
          <p className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{REFERENCE_BADGE}</p>
          <SpecRows rows={part.specs.map((x) => [x.label, x.value])} />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">Accuracy: {part.accuracy === 'sourced' ? 'standard dimensions, sourced' : 'typical'}.</span>{' '}
            {part.accuracy === 'typical' && 'Check these against the part you have in hand.'}
          </p>
          {part.source && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Source:{' '}
              {part.source.url ? <a href={part.source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline dark:text-indigo-400">{part.source.label}</a> : part.source.label}. {part.source.note}
            </p>
          )}
          {part.category === 'battery' && <p role="note" className="rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">{LIPO_NOTE}</p>}
          <Link href={`/request?part=${encodeURIComponent(part.id)}`} className={submitBtn}>Enquire about this part</Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">Available from us — enquire for price. We reply with availability and the next steps.</p>
          {isSourcedMotor(part.id) && <Link href="/playground?mode=build&example=drone-plate&sim=1" className="block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Test it in Build →</Link>}
        </aside>
      </div>
      {kits.length > 0 && (
        <section aria-labelledby="used-in" className="space-y-2">
          <h2 id="used-in" className="text-lg font-semibold text-gray-900 dark:text-white">Used in</h2>
          <ul className="flex flex-wrap gap-3">
            {kits.map((k) => <li key={k.id}><Link href={`/shop/${k.id}`} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">{k.title}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
