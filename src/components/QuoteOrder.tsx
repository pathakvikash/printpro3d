'use client';

import { useMemo, useState } from 'react';
import { blueprint } from '@/lib/blueprint';
import { analyzeMesh } from '@/lib/meshAnalysis';
import Icon from './Icon';
import BlueprintSheet from './BlueprintSheet';
import { BED_MM, MATERIALS, MAX_QTY, fitsBed, quote, type MaterialKey, type MeshStats } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart } from './CartProvider';

// illustrative colours, same as MaterialCards
const SWATCH: Record<MaterialKey, string> = { PLA: '#bfb49c', PETG: '#3f86ad', ABS: '#4a4f57', TPU: '#c2553f' };
const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

// `label` names the model in the cart; `onAnother` (optional) resets the step so another model can be added
export default function QuoteOrder({
  file,
  stats,
  positions,
  label: modelName = 'Your model',
  onAnother,
  project,
}: {
  file: string;
  stats: MeshStats | null;
  positions?: Float32Array | null; // triangle soup of the uploaded mesh, for the drawing
  label?: string;
  onAnother?: () => void;
  project?: string; // a finalized design project: the cart line is a 'design' line and the server prices the STL it built
}) {
  const { add, openCart } = useCart();
  const [material, setMaterial] = useState<MaterialKey>('PLA');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sheet = useMemo(() => (positions && positions.length >= 9 ? blueprint(positions, { name: modelName, material }) : null), [positions, modelName, material]);
  const found = useMemo(() => (positions ? analyzeMesh(positions) : null), [positions]);
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
    add(project ? { kind: 'design', project, label: modelName, material, qty, estimate: price } : { kind: 'model', file, label: modelName, material, qty, estimate: price });
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
            <Icon name="cart" />View cart
          </button>
          {onAnother && (
            <button type="button" onClick={onAnother} className={secondaryBtn}>
              <Icon name="plus" />Add another model
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
        <div role="radiogroup" aria-label="Material" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MATERIAL_KEYS.map((key) => {
            const selected = material === key;
            const total = priceFor(key);
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                    : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500'
                }`}
              >
                <input type="radio" name="material" value={key} checked={selected} onChange={() => setMaterial(key)} className="sr-only" />
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/20 dark:border-white/30" style={{ backgroundColor: SWATCH[key] }} />
                <span className="font-semibold text-gray-900 dark:text-gray-100">{MATERIAL_INFO[key].label}</span>
                <span className="ml-auto font-semibold text-indigo-600 dark:text-indigo-400">{total !== null ? money.format(total) : 'Quote'}</span>
              </label>
            );
          })}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{MATERIAL_INFO[material].blurb}</p>
      </fieldset>

      {found && (
        <section aria-labelledby="det-h" className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <h4 id="det-h" className="font-semibold text-gray-900 dark:text-gray-100">What we detected</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Size: {found.sizeMm.x.toFixed(1)} × {found.sizeMm.y.toFixed(1)} × {found.sizeMm.z.toFixed(1)} mm, {found.triangles.toLocaleString()} triangles</li>
            <li>{found.isClosed ? `Volume: ${found.volumeCm3!.toFixed(2)} cm³` : 'Not watertight (open surface), so we cannot give a volume'}</li>
            <li>{found.pieces === 1 ? '1 piece' : `${found.pieces} separate pieces`}{found.throughHoles !== null && `, ${found.throughHoles} ${found.throughHoles === 1 ? 'opening' : 'openings'} through the part`}</li>
            <li>{found.fitsBed ? 'Fits our print bed' : 'Does not fit our print bed'}. Orientation: {found.orientation}</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">{found.limits.join(' ')}</p>
        </section>
      )}

      {sheet && (
        <section aria-labelledby="bp-h" className="space-y-3">
          <h4 id="bp-h" className="font-semibold text-gray-900 dark:text-gray-100">Blueprint</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">Three views drawn from your file, in mm. Check the size before you order.</p>
          <BlueprintSheet svg={sheet} filename="blueprint" />
        </section>
      )}

      {price !== null ? (
        <p className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
          <Icon name="tag" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">Estimated price</span>
          <span className="ml-auto text-2xl font-bold text-indigo-600 dark:text-indigo-400">{money.format(price)}</span>
        </p>
      ) : (
        <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
          {!stats
            ? 'We will quote this one manually'
            : !fits
              ? `Larger than our ${BED_MM.x}×${BED_MM.y}×${BED_MM.z} mm print area — we will quote this one manually`
              : 'Enter a quantity between 1 and ' + MAX_QTY}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => addToCart(false)} disabled={!validQty} className={submitBtn}>
          <Icon name="cart" />{project ? 'Place order' : 'Add to cart'}
        </button>
        <button type="button" onClick={() => addToCart(true)} disabled={!validQty} className={`${secondaryBtn} w-full disabled:opacity-50`}>
          <Icon name="check" />{project ? 'Place order and checkout' : 'Add and checkout'}
        </button>
      </div>
    </div>
  );
}
