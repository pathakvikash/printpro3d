'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHOP_CATEGORIES, shopCat, shopCatLabel, shopVisible } from '@/lib/catalog';
import { PRODUCTS, specFromMesh, type Product } from '@/lib/shopProducts';
import { buildOffThread } from '@/lib/buildOffThread';
import type { MaterialKey } from '@/lib/quote';
import { money } from './ContactFields';
import { QtyStepper, SaveButton } from './CartDrawer';
import { useCart } from './CartProvider';
import { TEMPLATES } from '@/lib/templateDefs';
import { ComingSoon, TemplateCard } from './TemplateShop';
import { addBtn, AddLabel, CardFrame, chipClass, useAdded, useReduceMotion } from './ShopParts';

// the 3D preview code loads only when a card first scrolls into view
const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const MAX_CANVASES = 6; // live card previews at once

function ShopCard({ p, live, reduceMotion, setVisible }: {
  p: Product; live: boolean; reduceMotion: boolean; setVisible: (id: string, v: boolean) => void;
}) {
  const { item, ex, dims } = p;
  const { lines, add, toast } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useAdded();
  // the print mesh is built in a worker: building every card's CSG during hydration blocked the page for ~0.7 s on desktop
  const [mesh, setMesh] = useState<Float32Array | null>();
  useEffect(() => {
    let on = true;
    buildOffThread(ex.shapes).then((m) => on && setMesh(m), () => on && setMesh(null));
    return () => { on = false; };
  }, [ex.shapes]);
  const spec = useMemo(() => (mesh === undefined ? null : specFromMesh(p, mesh, item.material)), [p, mesh, item.material]);
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

  const rows: [string, string][] = [
    ['Size', dims],
    ['Material', item.material],
    ['Weight', !spec ? '…' : spec.grams != null ? `about ${spec.grams.toFixed(1)} g` : 'n/a'],
    ['Price', `${money.format(item.price)} each`],
  ];
  return (
    <CardFrame
      href={`/shop/${item.id}`}
      category={shopCatLabel(shopCat(item.id) ?? '')}
      name={item.name}
      blurb={item.description}
      rows={rows}
      previewRef={box}
      preview={
        item.photo ? (
          <div className="relative h-full">
            <Image src={item.photo} alt={item.photoAlt ?? item.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : (
          live && mesh !== undefined && <div className="h-full"><ExamplePreview shapes={ex.shapes} mesh={mesh} reduceMotion={reduceMotion} material={item.material as MaterialKey} /></div>
        )
      }
      save={<SaveButton savedKey={`shop:${item.id}`} name={item.name} />}
      actions={
        <>
          <QtyStepper name={item.name} qty={qty} onChange={setQty} />
          <button
            type="button"
            onClick={() => { add({ kind: 'shop', id: item.id, qty }); toast('Added to cart', true); setAdded(true); }}
            className={addBtn}
            title={inCart ? `In cart (${inCart.qty})` : undefined}
          >
            <AddLabel added={added} />
          </button>
        </>
      }
    />
  );
}

// limit: show only the first n parts, no chips or search (the home page)
export default function ShopOrder({ onWholesale, limit }: { onWholesale: () => void; limit?: number }) {
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [visible, setVisibleSet] = useState<string[]>([]);
  // category and search live in the URL, so the browser Back button from a product page restores them
  const cat = params.get('cat') ?? 'all';
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);

  const setVisible = useCallback((id: string, v: boolean) => {
    setVisibleSet((cur) => (v ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));
  }, []);
  const setUrl = (next: { cat?: string; q?: string }) => {
    const sp = new URLSearchParams(params.toString());
    const c = next.cat ?? cat;
    const s = next.q ?? q;
    if (c === 'all') sp.delete('cat'); else sp.set('cat', c);
    if (s.trim()) sp.set('q', s); else sp.delete('q');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const needle = q.trim().toLowerCase();
  const match = (cats: string, ...text: string[]) =>
    (cat === 'all' || cats === cat) && (!needle || text.join(' ').toLowerCase().includes(needle));
  // templates are shown on /shop; the home page (limit) keeps showing the fixed parts
  const tpls = limit === undefined ? shopVisible(TEMPLATES).filter((t) => match(shopCat(t.id) ?? '', t.name, t.blurb, t.material, shopCatLabel(shopCat(t.id) ?? ''))) : [];
  const shown = PRODUCTS.filter((p) => match(shopCat(p.item.id) ?? '', p.item.name, p.item.description, p.item.material, shopCatLabel(shopCat(p.item.id) ?? ''))).slice(0, limit);
  const chips = [{ id: 'all', label: 'All' }, ...SHOP_CATEGORIES.filter((c) => PRODUCTS.some((p) => shopCat(p.item.id) === c.id) || TEMPLATES.some((t) => shopCat(t.id) === c.id))];
  const live = new Set(visible.slice(0, MAX_CANVASES));

  return (
    <div className="space-y-6">
      {limit === undefined && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setUrl({ cat: c.id })} className={chipClass(cat === c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search parts</span>
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setUrl({ q: e.target.value }); }}
              placeholder="Search parts"
              className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tpls.map((t, i) => (
          <TemplateCard key={t.id} t={t} index={i} live={live.has(t.id)} reduceMotion={reduceMotion} setVisible={setVisible} />
        ))}
        {shown.map((p) => (
          <ShopCard key={p.item.id} p={p} live={live.has(p.item.id)} reduceMotion={reduceMotion} setVisible={setVisible} />
        ))}
      </ul>
      {tpls.length + shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No parts match. <button type="button" className="text-indigo-600 underline dark:text-indigo-400" onClick={() => { setQ(''); setUrl({ cat: 'all', q: '' }); }}>Clear filters</button>
        </p>
      )}
      {limit === undefined && <ComingSoon />}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Need 100+?{' '}
        <button type="button" onClick={onWholesale} className="text-indigo-600 dark:text-indigo-400 underline">
          Ask for a wholesale price
        </button>
      </p>
    </div>
  );
}
