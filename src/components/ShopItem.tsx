'use client';
// Product page body for a fixed-price shop item: interactive 3D view, the drawing under it, specs, material preview, add to cart.

import Icon from './Icon';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { blueprint } from '@/lib/blueprint';
import { LAYER_MM } from '@/lib/printSpec';
import type { MaterialKey } from '@/lib/quote';
import { meshOf, specOf, type Product } from '@/lib/shopProducts';
import MaterialCards from './MaterialCards';
import BlueprintSheet from './BlueprintSheet';
import { money, secondaryBtn } from './ContactFields';
import { QtyStepper, SaveButton } from './CartDrawer';
import { useCart } from './CartProvider';
import { addBtn, AddLabel, BackToShop, previewBox, SpecRows, useAdded, useReduceMotion } from './ShopParts';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });

export default function ItemDetail({ p }: { p: Product }) {
  const { item, ex, dims } = p;
  const { lines, add, toast } = useCart();
  const reduceMotion = useReduceMotion();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useAdded();
  const [finish, setFinish] = useState(item.material as MaterialKey); // preview only; the part is sold in item.material
  const [tab, setTab] = useState<'3d' | 'photo'>('3d');
  const inCart = lines.find((l) => l.kind === 'shop' && l.id === item.id);
  const spec = useMemo(() => specOf(p, finish), [p, finish]);
  const svg = useMemo(() => {
    const m = meshOf(p);
    return m ? blueprint(m, { name: item.name, id: item.id, material: item.material }) : null;
  }, [p, item]);
  const rows: [string, string][] = [
    ['Size', dims],
    ['Volume', spec.volume != null ? `${spec.volume.toFixed(2)} cm³` : 'n/a'],
    ['Material', item.material],
    ['Est. weight', spec.grams != null ? `${spec.grams.toFixed(1)} g in ${finish}` : 'n/a'],
    ['Layers', spec.layers != null ? `${spec.layers} at ${LAYER_MM} mm (assumed)` : 'n/a'],
  ];

  return (
    <div className="space-y-6">
      <BackToShop />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{shopCatLabel(shopCat(item.id) ?? '')}</span>
          <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{item.name}</h1>
        </div>
        <SaveButton savedKey={`shop:${item.id}`} name={item.name} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className={previewBox}>
            {tab === 'photo' && item.photo ? (
              <Image src={item.photo} alt={item.photoAlt ?? item.name} width={640} height={480} className="h-full w-full object-cover" />
            ) : (
              <ExamplePreview shapes={ex.shapes} reduceMotion={reduceMotion} interactive material={finish} />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Drag to turn. Scroll or pinch to zoom. Layer lines are drawn at their true {LAYER_MM} mm here.</p>
          {item.photo && ( // no photo yet: no Photo tab, nothing placeholder-like shown to customers
            <div role="group" aria-label="Preview type" className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
              {(['3d', 'photo'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-700 dark:text-gray-200'}`}>
                  {t === '3d' ? '3D' : 'Photo'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-gray-700 dark:text-gray-300">{item.description}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {money.format(item.price)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">each · made to order</span>
          </p>
          <SpecRows rows={rows} />
          <div className="flex items-center gap-3 pt-1">
            <QtyStepper name={item.name} qty={qty} onChange={setQty} />
            <button type="button" onClick={() => { add({ kind: 'shop', id: item.id, qty }); toast('Added to cart', true); setAdded(true); }} className={addBtn}>
              <AddLabel added={added} />
            </button>
          </div>
          {inCart && <p className="text-sm text-gray-500 dark:text-gray-400">In cart ({inCart.qty})</p>}
          <Link href={`/build?example=${item.exampleId}`} className={`${secondaryBtn} w-full`}><Icon name="wrench" />Customise in the builder</Link>
        </div>
      </div>

      <section aria-label="Blueprint" className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Blueprint</h2>
        {svg && <BlueprintSheet svg={svg} filename={`${item.id}-blueprint`} />}
      </section>

      <section aria-labelledby="mat-h" className="border-t border-gray-200 pt-4 dark:border-gray-800">
        <h2 id="mat-h" className="text-lg font-semibold text-gray-900 dark:text-white">Pick a material, see it on the part</h2>
        <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">Choosing a material changes the finish on the 3D view above and the estimated weight of this part.</p>
        <MaterialCards partVolumeCm3={spec.volume ?? undefined} selected={finish} onSelect={setFinish} />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Sold in {item.material}. Other finishes are a preview only.</p>
      </section>
    </div>
  );
}
