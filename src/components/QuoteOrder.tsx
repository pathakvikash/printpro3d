'use client';

import { useMemo, useState } from 'react';
import { analyzeMesh } from '@/lib/meshAnalysis';
import Link from 'next/link';
import Icon from './Icon';
import { BED_MM, MATERIALS, MAX_QTY, fitsBed, quote, type MaterialKey, type MeshStats } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart } from './CartProvider';
import Term from './Term';
import { loadItems, storeItems } from './myItemsStore';
import { saveItem, type MyItem } from '@/lib/myItems';

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
  onMaterial,
}: {
  file: string;
  stats: MeshStats | null;
  positions?: Float32Array | null; // triangle soup of the model, for "What we detected"
  label?: string;
  onAnother?: () => void;
  onMaterial?: (k: MaterialKey) => void; // the preview above shows the picked finish
  project?: string; // a finalized design project: the cart line is a 'design' line and the server prices the STL it built
}) {
  const { add, openCart } = useCart();
  const [material, setMaterial] = useState<MaterialKey>('PLA');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

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

  // saved in this browser only; Order again later goes through the normal cart and the server reprices
  const [colour, setColour] = useState('');
  const [notes, setNotes] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const saveItemHere = () => {
    const item: MyItem = { id: `${file}:${material}`, name: modelName, file, material, colour, qty: validQty ? qty : 1, notes, stats };
    const ok = storeItems(saveItem(loadItems(), item));
    setSavedMsg(ok ? 'Saved to My items.' : 'Could not save: your browser blocked storage.');
  };

  if (added) {
    return (
      <div className={card}>
        <p role="status" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Added to your cart</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {modelName} · {material} · quantity {qty}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => openCart('cart')} aria-label="View cart" title="View cart" className={`${submitBtn} sm:w-auto sm:px-6`}>
            <Icon name="cart" />Cart
          </button>
          {onAnother && (
            <button type="button" onClick={onAnother} aria-label="Add another model" title="Add another model" className={secondaryBtn}>
              <Icon name="plus" />Another
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
        <div role="radiogroup" aria-label="Material" className="grid grid-cols-2 gap-2">
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
                <input type="radio" name="material" value={key} checked={selected} onChange={() => { setMaterial(key); onMaterial?.(key); }} className="sr-only" />
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/20 dark:border-white/30" style={{ backgroundColor: SWATCH[key] }} />
                <span className="font-semibold text-gray-900 dark:text-gray-100">{MATERIAL_INFO[key].label}</span>
                <span className="ml-auto font-semibold text-indigo-600 dark:text-indigo-400">{total !== null ? money.format(total) : 'Quote'}</span>
              </label>
            );
          })}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{MATERIAL_INFO[material].blurb} <Link href="/materials" className="font-medium text-indigo-700 underline underline-offset-2 hover:no-underline dark:text-indigo-400">Compare materials</Link></p>
      </fieldset>

      {/* price and Add stay in view on wide screens (at 1440 x 900 the Add button must not fall below the fold) */}
      <div className="-mx-5 space-y-3 border-y border-gray-200 bg-white px-5 py-3 lg:sticky lg:bottom-0 lg:z-10 dark:border-gray-700 dark:bg-gray-900">
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
        <button type="button" onClick={() => addToCart(false)} disabled={!validQty} aria-label={project ? 'Place order' : 'Add to cart'} title={project ? 'Place order' : 'Add to cart'} className={submitBtn}>
          <Icon name="cart" />{project ? 'Order' : 'Add'}
        </button>
        <button type="button" onClick={() => addToCart(true)} disabled={!validQty} aria-label={project ? 'Place order and checkout' : 'Add and checkout'} title={project ? 'Place order and checkout' : 'Add and checkout'} className={`${secondaryBtn} w-full disabled:opacity-50`}>
          <Icon name="check" />Checkout
        </button>
      </div>
      </div>
      {!project && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <button type="button" onClick={saveItemHere} aria-label="Save to My items" title="Save to My items (kept in this browser)" className={`${secondaryBtn} !w-auto`}><Icon name="save" />Save</button>
          {savedMsg && <><span role="status">{savedMsg}</span><Link href="/my-items" aria-label="View My items" title="View My items" className={`${secondaryBtn} !w-auto`}><Icon name="cube" />Items</Link></>}
        </div>
      )}
      {!project && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="qcolour" className={label}>Colour note (optional)</label>
            <input id="qcolour" value={colour} maxLength={40} onChange={(e) => setColour(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="qnotes" className={label}>Notes (optional)</label>
            <input id="qnotes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} className={input} />
          </div>
        </div>
      )}

      {found && (
        <section aria-labelledby="det-h" className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <h4 id="det-h" className="font-semibold text-gray-900 dark:text-gray-100">What we detected</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Size: {found.sizeMm.x.toFixed(1)} × {found.sizeMm.y.toFixed(1)} × {found.sizeMm.z.toFixed(1)} mm, {found.triangles.toLocaleString()} <Term k="triangles">triangles</Term></li>
            <li>{found.isClosed ? `Volume: ${found.volumeCm3!.toFixed(2)} cm³` : 'Not watertight (open surface), so we cannot give a volume'}</li>
            <li>{found.pieces === 1 ? '1 piece' : `${found.pieces} separate pieces`}{found.throughHoles !== null && <>, {found.throughHoles} <Term k="openings">{found.throughHoles === 1 ? 'opening' : 'openings'}</Term> through the part</>}</li>
            <li>{found.fitsBed ? 'Fits our print bed' : 'Does not fit our print bed'}. Orientation: {found.orientation}</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">{found.limits.join(' ')}</p>
        </section>
      )}

    </div>
  );
}
