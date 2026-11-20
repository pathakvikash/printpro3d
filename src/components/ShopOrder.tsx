'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CATALOG, CATEGORIES, type Item } from '@/lib/catalog';
import { exampleById, type Example } from '@/lib/examples';
import { solidsSize } from '@/lib/playground';
import { money, secondaryBtn } from './ContactFields';
import { QtyStepper, SaveButton } from './CartDrawer';
import { useCart } from './CartProvider';

// the 3D preview code loads only when a card first scrolls into view
const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const MAX_CANVASES = 6; // card previews plus the open dialog
const fmt = (n: number) => n.toFixed(1); // same one-decimal size readout as the builder

type Product = { item: Item; ex: Example; dims: string };
// products without a design are left out, so every card has a real 3D model
const PRODUCTS: Product[] = CATALOG.flatMap((item) => {
  const ex = exampleById(item.exampleId);
  const s = ex ? solidsSize(ex.shapes) : null;
  return ex && s ? [{ item, ex, dims: `${fmt(s.x)} × ${fmt(s.y)} × ${fmt(s.z)} mm` }] : [];
});

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
const chipClass = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    on
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  }`;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduce;
}

function ShopCard({ p, live, reduceMotion, setVisible, onView }: {
  p: Product;
  live: boolean;
  reduceMotion: boolean;
  setVisible: (id: string, v: boolean) => void;
  onView: (id: string, opener: HTMLElement) => void;
}) {
  const { item, ex, dims } = p;
  const { lines, add, toast } = useCart();
  const [qty, setQty] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const inCart = lines.find((l) => l.kind === 'shop' && l.id === item.id);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([en]) => setVisible(item.id, en.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => {
      io.disconnect();
      setVisible(item.id, false); // a filtered-out card must not keep a canvas slot
    };
  }, [item.id, setVisible]);

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div ref={box} className="h-44 bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950" aria-hidden>
        {live && <ExamplePreview shapes={ex.shapes} reduceMotion={reduceMotion} />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(item.category)}</span>
            <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
          </div>
          <SaveButton savedKey={`shop:${item.id}`} name={item.name} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{dims} · {item.material}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{money.format(item.price)} each</p>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => onView(item.id, e.currentTarget)}
          className={`${secondaryBtn} w-full`}
        >
          View in 3D
        </button>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <QtyStepper name={item.name} qty={qty} onChange={setQty} />
          <button
            type="button"
            onClick={() => {
              add({ kind: 'shop', id: item.id, qty });
              toast('Added to cart', true);
            }}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 sm:flex-none"
          >
            Add to cart
          </button>
        </div>
        {inCart && <p className="text-sm text-gray-500 dark:text-gray-400">In cart ({inCart.qty})</p>}
      </div>
    </li>
  );
}

function ItemDialog({ p, reduceMotion, onClose }: { p: Product; reduceMotion: boolean; onClose: () => void }) {
  const { item, ex, dims } = p;
  const { lines, add, toast } = useCart();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.kind === 'shop' && l.id === item.id);

  // scroll lock, Escape, and a Tab loop inside the dialog; focus moves into the dialog and the opener gets it back in the parent's onClose
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(
        panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled)'),
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-950 shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(item.category)}</span>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{item.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SaveButton savedKey={`shop:${item.id}`} name={item.name} />
            <button
              ref={closeBtn}
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-72 sm:h-96 bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950">
          <ExamplePreview shapes={ex.shapes} reduceMotion={reduceMotion} interactive />
        </div>

        <div className="space-y-3 p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Drag to rotate. Scroll or pinch to zoom.</p>
          <p className="text-gray-700 dark:text-gray-300">{item.description}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{dims} · {item.material}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{money.format(item.price)} each</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <QtyStepper name={item.name} qty={qty} onChange={setQty} />
            <button
              type="button"
              onClick={() => {
                add({ kind: 'shop', id: item.id, qty });
                toast('Added to cart', true);
                setAdded(true);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 sm:flex-none"
            >
              {added ? 'Added' : 'Add to cart'}
            </button>
          </div>
          {inCart && <p className="text-sm text-gray-500 dark:text-gray-400">In cart ({inCart.qty})</p>}
          <Link href={`/?start=build&example=${item.exampleId}#start`} className={`${secondaryBtn} w-full`}>
            Customise this in the builder
          </Link>
        </div>
      </div>
    </div>
  );
}

// embedded: used on the home page, where the grid is wider and gets three columns on large screens
export default function ShopOrder({ onWholesale, embedded = false }: { onWholesale: () => void; embedded?: boolean }) {
  const reduceMotion = useReduceMotion();
  const [visible, setVisibleSet] = useState<string[]>([]);
  const [cat, setCat] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const setVisible = useCallback((id: string, v: boolean) => {
    setVisibleSet((cur) => (v ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));
  }, []);
  const onView = useCallback((id: string, el: HTMLElement) => {
    opener.current = el;
    setOpenId(id);
  }, []);
  const closeModal = useCallback(() => {
    setOpenId(null);
    opener.current?.focus();
  }, []);

  const chips = [{ id: 'all', label: 'All' }, ...CATEGORIES.filter((c) => PRODUCTS.some((p) => p.item.category === c.id))];
  const shown = PRODUCTS.filter((p) => cat === 'all' || p.item.category === cat);
  // at most six WebGL canvases: the open dialog takes one of them
  const live = new Set(visible.slice(0, openId ? MAX_CANVASES - 1 : MAX_CANVASES));
  const open = PRODUCTS.find((p) => p.item.id === openId);

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={chipClass(cat === c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${embedded ? 'lg:grid-cols-3' : ''}`}>
        {shown.map((p) => (
          <ShopCard key={p.item.id} p={p} live={live.has(p.item.id)} reduceMotion={reduceMotion} setVisible={setVisible} onView={onView} />
        ))}
      </ul>
      {open && <ItemDialog key={open.item.id} p={open} reduceMotion={reduceMotion} onClose={closeModal} />}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Need 100+?{' '}
        <button type="button" onClick={onWholesale} className="text-indigo-600 dark:text-indigo-400 underline">
          Ask for a wholesale price
        </button>
      </p>
    </div>
  );
}
