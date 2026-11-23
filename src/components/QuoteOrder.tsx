'use client';

import { useMemo, useState } from 'react';
import { blueprint } from '@/lib/blueprint';
import BlueprintSheet from './BlueprintSheet';
import { BED_MM, MATERIALS, MAX_QTY, fitsBed, quote, type MaterialKey, type MeshStats } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart } from './CartProvider';

const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

// `label` names the model in the cart; `onAnother` (optional) resets the step so another model can be added
export default function QuoteOrder({
  file,
  stats,
  positions,
  label: modelName = 'Your model',
  onAnother,
}: {
  file: string;
  stats: MeshStats | null;
  positions?: Float32Array | null; // triangle soup of the uploaded mesh, for the drawing
  label?: string;
  onAnother?: () => void;
}) {
  const { add, openCart } = useCart();
  const [material, setMaterial] = useState<MaterialKey>('PLA');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sheet = useMemo(() => (positions && positions.length >= 9 ? blueprint(positions, { name: modelName, material }) : null), [positions, modelName, material]);
  const fits = stats ? fitsBed(stats.sizeMm) : false;
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY;
  // live line total for one material at the current quantity; null means we quote it by hand
  const priceFor = (key: MaterialKey): number | null => {
    if (!stats || !fits || !validQty) return null;
    try {
      return quote(stats, key, qty).total;
    } catch {
      return null;
    }
  };
  const price = priceFor(material);

  const addToCart = (checkout: boolean) => {
    // estimate is the line total we showed; null means we quote it by hand
    add({ kind: 'model', file, label: modelName, material, qty, estimate: price });
    setAdded(true);
    if (checkout) openCart('cart', 'checkout');
  };

  if (added) {
    return (
      <div className={card}>
        <p role="status" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Added to your cart</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {modelName} · {material} · quantity {qty}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => openCart('cart')} className={`${submitBtn} sm:w-auto sm:px-6`}>
            View cart
          </button>
          {onAnother && (
            <button type="button" onClick={onAnother} className={secondaryBtn}>
              Add another model
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={card}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Instant quote</h3>

      {stats && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Size: {stats.sizeMm.x.toFixed(1)} × {stats.sizeMm.y.toFixed(1)} × {stats.sizeMm.z.toFixed(1)} mm · Volume:{' '}
          {stats.volumeCm3.toFixed(2)} cm³
        </p>
      )}

      <div>
        <label htmlFor="qty" className={label}>Quantity</label>
        <input
          id="qty" type="number" min={1} max={MAX_QTY} step={1} value={Number.isNaN(qty) ? '' : qty}
          onChange={(e) => setQty(e.target.valueAsNumber)} className={`${input} sm:max-w-[10rem]`}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Material</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MATERIAL_KEYS.map((key) => {
            const selected = material === key;
            const total = priceFor(key);
            return (
              <label
                key={key}
                className={`flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                    : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{MATERIAL_INFO[key].label}</span>
                  <input
                    type="radio"
                    name="material"
                    value={key}
                    checked={selected}
                    onChange={() => setMaterial(key)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{MATERIAL_INFO[key].blurb}</span>
                <span className="mt-auto pt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {total !== null ? money.format(total) : 'Quote on request'}
                  {total !== null && <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">for {qty}</span>}
                </span>
                {selected && <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">✓ Selected</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {sheet && (
        <section aria-labelledby="bp-h" className="space-y-3">
          <h4 id="bp-h" className="font-semibold text-gray-900 dark:text-gray-100">Blueprint</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">Three views drawn from your file, in mm. Check the size before you order.</p>
          <BlueprintSheet svg={sheet} filename="blueprint" />
        </section>
      )}

      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        {price !== null
          ? `Estimated price: ${money.format(price)}`
          : !stats
            ? 'We will quote this one manually'
            : !fits
              ? `Larger than our ${BED_MM.x}×${BED_MM.y}×${BED_MM.z} mm print area — we will quote this one manually`
              : 'Enter a quantity between 1 and ' + MAX_QTY}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => addToCart(false)} disabled={!validQty} className={submitBtn}>
          Add to cart
        </button>
        <button type="button" onClick={() => addToCart(true)} disabled={!validQty} className={`${secondaryBtn} w-full disabled:opacity-50`}>
          Add and checkout
        </button>
      </div>
    </div>
  );
}
