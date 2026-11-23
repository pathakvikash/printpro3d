'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CATALOG, CATEGORIES, type Item } from '@/lib/catalog';
import { exampleById, type Example } from '@/lib/examples';
import { buildMesh, solidsSize } from '@/lib/playground';
import { blueprint, blueprintData } from '@/lib/blueprint';
import { LAYER_MM } from '@/lib/printSpec';
import { MATERIALS, quote, type MaterialKey } from '@/lib/quote';
import MaterialCards from './MaterialCards';
import BlueprintSheet from './BlueprintSheet';
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

// the print mesh the price is computed from; built once per item, on first use
const meshes = new Map<string, Float32Array | null>();
const meshOf = (p: Product) => {
  if (!meshes.has(p.item.id)) meshes.set(p.item.id, buildMesh(p.ex.shapes));
  return meshes.get(p.item.id) ?? null;
};
// weight and layers come from the mesh, never typed in
function specOf(p: Product, finish: string) {
  const m = meshOf(p);
  const D = m ? blueprintData(m, p.item.material) : null;
  const grams = D?.stats && Object.hasOwn(MATERIALS, finish) ? quote(D.stats, finish, 1).grams : null;
  return { volume: D?.stats?.volumeCm3 ?? null, grams, layers: D?.layers ?? null };
}

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
  const spec = useMemo(() => specOf(p, item.material), [p, item.material]);
  const box = useRef<HTMLDivElement>(null);
  const inCart = lines.find((l) => l.kind === 'shop' && l.id === item.id);

  useEffect(() => {
    const el = box.current;
    if (item.photo || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([en]) => setVisible(item.id, en.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => {
      io.disconnect();
      setVisible(item.id, false); // a filtered-out card must not keep a canvas slot
    };
  }, [item.id, item.photo, setVisible]);

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {item.photo ? (
        <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
          <Image src={item.photo} alt={item.photoAlt ?? item.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(e) => onView(item.id, e.currentTarget)}
            className="absolute bottom-2 right-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            View in 3D
          </button>
        </div>
      ) : (
        <div ref={box} className="h-44 bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950" aria-hidden>
          {live && <ExamplePreview shapes={ex.shapes} reduceMotion={reduceMotion} material={item.material as MaterialKey} />}
        </div>
      )}
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
        {spec.grams != null && <p className="text-sm text-gray-500 dark:text-gray-400">about {spec.grams.toFixed(1)} g · {spec.layers} layers at {LAYER_MM} mm</p>}
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{money.format(item.price)} each</p>
        {!item.photo && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(e) => onView(item.id, e.currentTarget)}
            className={`${secondaryBtn} w-full`}
          >
            View in 3D
          </button>
        )}

        <div className="mt-auto flex items-center gap-3 pt-2">
          <QtyStepper name={item.name} qty={qty} onChange={setQty} />
          <button
            type="button"
            onClick={() => {
              add({ kind: 'shop', id: item.id, qty });
              toast('Added to cart', true);
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] bg-indigo-600 px-4 font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
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
  const [finish, setFinish] = useState(item.material as MaterialKey); // preview only; the part is sold in item.material
  const [tab, setTab] = useState<'3d' | 'photo'>('3d');
  const [sheet, setSheet] = useState(false);
  const spec = useMemo(() => specOf(p, finish), [p, finish]);
  const svg = useMemo(() => {
    const m = sheet ? meshOf(p) : null;
    return m ? blueprint(m, { name: item.name, id: item.id, material: item.material }) : null;
  }, [sheet, p, item]);
  const rows: [string, string][] = [
    ['Size', dims],
    ['Volume', spec.volume != null ? `${spec.volume.toFixed(2)} cm³` : 'n/a'],
    ['Material', item.material],
    ['Est. weight', spec.grams != null ? `${spec.grams.toFixed(1)} g in ${finish}` : 'n/a'],
    ['Layers', spec.layers != null ? `${spec.layers} at ${LAYER_MM} mm` : 'n/a'],
  ];

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
        className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-950 shadow-2xl sm:max-w-4xl sm:rounded-2xl"
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

        <div className="grid md:grid-cols-[1.15fr_1fr]">
          <div className="space-y-3 p-5 pt-0">
            <div className="h-72 overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 sm:h-96">
              {tab === 'photo' ? (
                item.photo ? (
                  <Image src={item.photo} alt={item.photoAlt ?? item.name} width={640} height={480} className="h-full w-full object-cover" />
                ) : (
                  <p className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-300">A photo of the real printed part will go here.</p>
                )
              ) : (
                <ExamplePreview shapes={ex.shapes} reduceMotion={reduceMotion} interactive material={finish} />
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Drag to turn. Scroll or pinch to zoom. Layer lines are drawn at their true {LAYER_MM} mm here.</p>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Preview type" className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                {(['3d', 'photo'] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-700 dark:text-gray-200'}`}>
                    {t === '3d' ? '3D' : 'Photo'}
                  </button>
                ))}
              </div>
              <button type="button" aria-pressed={sheet} onClick={() => setSheet((v) => !v)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                Blueprint {sheet ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="space-y-3 p-5 pt-0 md:pt-0">
            <p className="text-gray-700 dark:text-gray-300">{item.description}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {money.format(item.price)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">each · made to order</span>
            </p>
            <dl className="divide-y divide-gray-200 border-y border-gray-200 text-sm dark:divide-gray-700 dark:border-gray-700">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="text-right font-mono text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-3 pt-1">
              <QtyStepper name={item.name} qty={qty} onChange={setQty} />
              <button
                type="button"
                onClick={() => {
                  add({ kind: 'shop', id: item.id, qty });
                  toast('Added to cart', true);
                  setAdded(true);
                }}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] bg-indigo-600 px-4 font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                {added ? 'Added' : 'Add to cart'}
              </button>
            </div>
            {inCart && <p className="text-sm text-gray-500 dark:text-gray-400">In cart ({inCart.qty})</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={`/blueprint/${item.id}`} className={`${secondaryBtn} w-full`}>See the drawing</Link>
              <Link href={`/build?example=${item.exampleId}`} className={`${secondaryBtn} w-full`}>Customise in the builder</Link>
            </div>
          </div>
        </div>

        <section aria-labelledby={`${titleId}-mat`} className="border-t border-gray-200 p-5 dark:border-gray-800">
          <h3 id={`${titleId}-mat`} className="text-lg font-semibold text-gray-900 dark:text-white">Pick a material, see it on the part</h3>
          <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            Choosing a material changes the finish on the 3D view above and the estimated weight of this part. Notes are the ones already on the materials page.
          </p>
          <MaterialCards partVolumeCm3={spec.volume ?? undefined} selected={finish} onSelect={setFinish} />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Sold in {item.material}. Other finishes are a preview only.</p>
        </section>

        {sheet && svg && (
          <div className="p-5 pt-0">
            <BlueprintSheet svg={svg} filename={`${item.id}-blueprint`} />
          </div>
        )}
      </div>
    </div>
  );
}

// embedded: used on the home page, where the grid is wider and gets three columns on large screens; limit: show only the first n parts, no filter chips
export default function ShopOrder({ onWholesale, embedded = false, limit }: { onWholesale: () => void; embedded?: boolean; limit?: number }) {
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
  const shown = PRODUCTS.filter((p) => cat === 'all' || p.item.category === cat).slice(0, limit);
  // at most six WebGL canvases: the open dialog takes one of them
  const live = new Set(visible.slice(0, openId ? MAX_CANVASES - 1 : MAX_CANVASES));
  const open = PRODUCTS.find((p) => p.item.id === openId);

  return (
    <div className="space-y-6">
      {limit === undefined && (
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={chipClass(cat === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
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
