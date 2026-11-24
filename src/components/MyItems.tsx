'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from './Icon';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart } from './CartProvider';
import { loadItems, storeItems } from './myItemsStore';
import { MATERIALS, MAX_QTY, fitsBed, quote, type MaterialKey } from '@/lib/quote';
import { removeItem, toCartLine, updateItem, type MyItem } from '@/lib/myItems';

// three.js loads only when a preview is asked for
const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false, loading: () => <p role="status" className="p-4 text-center text-sm text-gray-500">Loading preview…</p> });

const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

// display estimate only: the server reprices the order
function estimateFor(i: MyItem): number | null {
  if (!i.stats || !fitsBed(i.stats.sizeMm)) return null;
  try {
    return quote(i.stats, i.material, i.qty).total;
  } catch {
    return null;
  }
}

function Row({ item, onChange, onRemove }: { item: MyItem; onChange: (patch: Partial<MyItem>) => void; onRemove: () => void }) {
  const { add, openCart } = useCart();
  const [preview, setPreview] = useState(false);
  const est = estimateFor(item);
  const id = `mi-${item.id}`;
  return (
    <li className={card}>
      <div className="flex items-start justify-between gap-3">
        <input aria-label="Name" value={item.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} className={`${input} font-semibold`} />
        <button type="button" onClick={onRemove} aria-label="Remove from My items" title="Remove from My items" className={`${secondaryBtn} !w-auto shrink-0`}><Icon name="trash" />Remove</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-m`} className={label}>Material</label>
          <select id={`${id}-m`} value={item.material} onChange={(e) => onChange({ material: e.target.value as MaterialKey })} className={input}>
            {MATERIAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-c`} className={label}>Colour note</label>
          <input id={`${id}-c`} value={item.colour} maxLength={40} onChange={(e) => onChange({ colour: e.target.value })} className={input} />
        </div>
        <div>
          <label htmlFor={`${id}-q`} className={label}>Quantity</label>
          <input id={`${id}-q`} type="number" min={1} max={MAX_QTY} step={1} value={item.qty} onChange={(e) => { const q = e.target.valueAsNumber; if (Number.isInteger(q) && q >= 1 && q <= MAX_QTY) onChange({ qty: q }); }} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-n`} className={label}>Notes</label>
        <textarea id={`${id}-n`} value={item.notes} maxLength={300} rows={2} onChange={(e) => onChange({ notes: e.target.value })} className={input} />
      </div>
      {preview ? (
        <div className="h-64 overflow-hidden rounded-xl"><ModelViewer url={`/api/upload/${item.file}`} material={item.material} /></div>
      ) : (
        <button type="button" onClick={() => setPreview(true)} aria-label="Show preview" title="Show preview" className={secondaryBtn}><Icon name="eye" />Preview</button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-gray-600 dark:text-gray-300 sm:flex-1">{est !== null ? `Estimate ${money.format(est)}. Final price is confirmed when you order.` : 'We will quote this one.'}</p>
        <button
          type="button"
          onClick={() => { add(toCartLine(item, est)); openCart('cart'); }}
          aria-label="Order this again" title="Order this again"
          className={`${submitBtn} sm:w-auto sm:px-6`}
        >
          <Icon name="cart" />Reorder
        </button>
      </div>
    </li>
  );
}

export default function MyItems() {
  const [items, setItems] = useState<MyItem[] | null>(null);
  useEffect(() => setItems(loadItems()), []);

  const commit = (next: MyItem[]) => { setItems(next); storeItems(next); };

  if (items === null) return <p role="status" className="text-sm text-gray-500">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className={card}>
        <p className="text-gray-700 dark:text-gray-200">Nothing saved yet. Upload a model on the quote page and choose Save to My items.</p>
        <Link href="/quote" aria-label="Get a quote" title="Get a quote" className={`${secondaryBtn} sm:w-auto`}><Icon name="upload" />Quote</Link>
      </div>
    );
  }
  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-300">Saved in this browser only. Clearing site data removes the list.</p>
      <ul className="space-y-4">
        {items.map((i) => (
          <Row key={i.id} item={i} onChange={(p) => commit(updateItem(items, i.id, p))} onRemove={() => commit(removeItem(items, i.id))} />
        ))}
      </ul>
    </>
  );
}
