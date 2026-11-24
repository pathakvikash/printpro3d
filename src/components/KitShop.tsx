'use client';
// Kit card (shop grid) and kit page: the parts with mini previews, "Add whole kit", and the list of parts bought separately.
// Each line is an ordinary cart line priced from its own mesh; the server reprices every line at checkout like any other.

import Icon from './Icon';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { blueprintData } from '@/lib/blueprint';
import { kitBlocked, kitLines, kitPartCount, type Kit, type KitItem } from '@/lib/kits';
import * as THREE from 'three';
import { prepGeometry } from './PrintMaterial';
import type { V3 } from '@/lib/assembly';
import { meshStats, quote, SETUP_FEE } from '@/lib/quote';
import { normalizeCfg, templateById } from '@/lib/templateDefs';
import { buildTemplate } from '@/lib/templates';
import { buildOffThread } from '@/lib/buildOffThread';
import { productById } from '@/lib/shopProducts';
import type { Shape } from '@/lib/playground';
import { money } from './ContactFields';
import { useCart } from './CartProvider';
import FlowStrip from '@/components/FlowStrip';
import BoughtList from './BoughtList';
import { addBtn, AddLabel, BackToShop, CardActions, CardFrame, SpecRows, useAdded, useReduceMotion } from './ShopParts';

const KitThumb = dynamic(() => import('./assembly/KitThumb'), { ssr: false });
const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const AssemblyViewer = dynamic(() => import('./assembly/AssemblyViewer'), { ssr: false, loading: () => <div aria-hidden className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" /> });

export type Part = { item: KitItem; name: string; material: string; shapes: Shape[]; mesh: Float32Array | null | undefined; unit: number | null; total: number | null };

// everything about one kit item that does not need the mesh
function describe(item: KitItem) {
  const t = templateById(item.templateId);
  if (t) return { name: t.name, material: t.material, shapes: buildTemplate(t, normalizeCfg(t, item.config)).shapes, template: true };
  const p = productById(item.templateId);
  return { name: p?.item.name ?? item.templateId, material: p?.item.material ?? '', shapes: p?.ex.shapes ?? [], template: false };
}

export function useParts(kit: Kit): Part[] {
  const base = useMemo(() => kit.items.map((item) => ({ item, ...describe(item) })), [kit]);
  const [meshes, setMeshes] = useState<(Float32Array | null | undefined)[]>(() => kit.items.map(() => undefined));
  useEffect(() => {
    let on = true;
    base.forEach((b, i) => {
      buildOffThread(b.shapes, b.template).then((m) => m, () => null).then((m) => on && setMeshes((cur) => cur.map((x, j) => (j === i ? m : x))));
    });
    return () => { on = false; };
  }, [base]);
  return base.map((b, i) => {
    const mesh = meshes[i];
    let unit: number | null = null, total: number | null = null;
    if (b.template) {
      const stats = mesh ? blueprintData(mesh, b.material)?.stats : null;
      if (stats) { unit = quote(stats, b.material, 1).unitPrice; total = quote(stats, b.material, b.item.qty).total; }
    } else {
      const price = productById(b.item.templateId)?.item.price;
      if (price != null) { unit = price; total = price * b.item.qty; }
    }
    return { item: b.item, name: b.name, material: b.material, shapes: b.shapes, mesh, unit, total };
  });
}

// The finished build: the kit's assembly() posed in the shared viewer, once every part mesh is built (bounding boxes come from them).
export function FinishedBuild({ kit, parts, focusId }: { kit: Kit; parts: Part[]; focusId?: string | null }) {
  const built = useMemo(() => {
    if (!kit.assembly || parts.some((p) => !p.mesh)) return null;
    const geometries: Record<string, THREE.BufferGeometry> = {}, sizes: Record<string, V3> = {};
    for (const p of parts) {
      const st = meshStats(p.mesh!);
      if (!st) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.mesh!, 3));
      geometries[p.item.templateId] = prepGeometry(g);
      sizes[p.item.templateId] = [st.sizeMm.x, st.sizeMm.y, st.sizeMm.z];
    }
    return { geometries, assembly: kit.assembly(sizes) };
  }, [kit, parts]);
  useEffect(() => () => { if (built) Object.values(built.geometries).forEach((g) => g.dispose()); }, [built]);
  if (!kit.assembly) return null;
  return (
    <section aria-labelledby="kit-finished" className="space-y-2">
      <h2 id="kit-finished" className="text-lg font-semibold text-gray-900 dark:text-white">The finished build</h2>
      {built ? <AssemblyViewer parts={built.assembly} geometries={built.geometries} focusId={focusId} /> : <div role="status" aria-label="Building the finished model" className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" />}
      <p className="text-sm text-gray-600 dark:text-gray-400">Grey parts are bought separately. Bought parts are drawn as placeholders at typical sizes.</p>
    </section>
  );
}

export function KitCard({ kit }: { kit: Kit }) {
  const descs = useMemo(() => kit.items.map((i) => ({ i, ...describe(i) })), [kit]);
  const names = descs.map((d) => `${d.i.qty > 1 ? `${d.i.qty} x ` : ''}${d.name}`);
  const sources = useMemo(() => descs.map((d) => ({ id: d.i.templateId, shapes: d.shapes, template: d.template })), [descs]);
  const { lines, add, toast } = useCart();
  const [added, setAdded] = useAdded();
  const parts = useParts(kit); // unit prices for the cart lines come from the meshes, as on the kit page
  const ready = parts.every((p) => p.unit != null);
  const addAll = () => {
    const mk = kitLines(kit, (i) => parts.find((p) => p.item === i)?.unit ?? 0);
    const why = kitBlocked(lines, mk);
    if (why) { toast(why); return; }
    mk.forEach(add);
    toast('Kit added to cart', true);
    setAdded(true);
  };
  const rows: [string, string][] = [['Printed parts', `${kitPartCount(kit)} in ${kit.items.length} kinds`], ['Bought separately', `${kit.boughtParts.length} items`]];
  return (
    <CardFrame
      href={`/shop/${kit.id}`}
      category={`${shopCatLabel(shopCat(kit.id) ?? '')} · Kit`}
      name={kit.title}
      blurb={kit.blurb}
      rows={rows}
      preview={kit.assembly ? <KitThumb kit={kit} sources={sources} /> : <div className="flex h-full flex-col justify-center gap-0.5 p-4 text-sm text-gray-700 dark:text-gray-300">{names.map((n) => <span key={n}>{n}</span>)}</div>}
      actions={<CardActions kind="kit" id={kit.id} added={added} disabled={!ready} onPrimary={addAll} />}
    />
  );
}

export function KitDetail({ kit }: { kit: Kit }) {
  const { lines, add, toast } = useCart();
  const reduceMotion = useReduceMotion();
  const [added, setAdded] = useAdded();
  const parts = useParts(kit);
  const ready = parts.every((p) => p.unit != null);
  const total = ready ? parts.reduce((n, p) => n + (p.total ?? 0), 0) : null;
  const addAll = () => {
    const mk = kitLines(kit, (i) => parts.find((p) => p.item === i)?.unit ?? 0);
    const why = kitBlocked(lines, mk);
    if (why) { toast(why); return; }
    mk.forEach(add);
    toast('Kit added to cart', true);
    setAdded(true);
  };
  return (
    <div className="space-y-6">
      <BackToShop />
      <FlowStrip current="adjust" />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{shopCatLabel(shopCat(kit.id) ?? '')} · Kit</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{kit.title}</h1>
        <p className="mt-2 max-w-3xl text-gray-700 dark:text-gray-300">{kit.blurb}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FinishedBuild kit={kit} parts={parts} />
        <aside aria-label="Kit total" className="space-y-3 self-start rounded-xl border border-gray-200 p-4 lg:sticky lg:top-20 dark:border-gray-700">
          <SpecRows rows={[['Printed parts', `${kitPartCount(kit)} pieces (${kit.items.length} different parts)`], ['Bought separately', `${kit.boughtParts.length} items`], ['Total', total != null ? `${money.format(total)}` : '…']]} />
          <button type="button" disabled={!ready} onClick={addAll} className={`${addBtn} w-full`}>
            {added ? <AddLabel added /> : <><Icon name="cart" />Add whole kit</>}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">We review your order and send a payment link; printing starts once it is paid.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">The total adds each line as priced on its own page (each line includes {money.format(SETUP_FEE)} setup). Price is an estimate from the meshes; we confirm before payment. Open a part to change its settings before you add it.</p>
          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <BoughtList items={kit.boughtParts} />
          </div>
        </aside>
      </div>
      <section aria-labelledby="kit-parts" className="space-y-3">
        <h2 id="kit-parts" className="text-lg font-semibold text-gray-900 dark:text-white">Printed parts in this kit</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((p) => {
            const t = templateById(p.item.templateId);
            return (
              <li key={p.item.templateId} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="h-36 bg-[#ebe8e1] dark:bg-[#141a2b]" aria-hidden>
                  {p.mesh && <ExamplePreview shapes={p.shapes} mesh={p.mesh} reduceMotion={reduceMotion} material={p.material as 'PLA'} />}
                </div>
                <div className="space-y-1 p-3 text-sm">
                  <Link href={`/shop/${p.item.templateId}`} className="font-semibold text-gray-900 hover:underline dark:text-gray-100">{p.name}</Link>
                  <p className="text-gray-500 dark:text-gray-400">{p.item.qty} × {p.material}{t ? ' · kit settings' : ''}</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{p.total != null ? money.format(p.total) : '…'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div aria-hidden className="h-16 lg:hidden" />
      <div className="pp-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden dark:border-gray-700 dark:bg-gray-900/95">
        <span className="font-mono text-base font-semibold text-gray-900 dark:text-white">{total != null ? money.format(total) : '…'}</span>
        <button type="button" disabled={!ready} onClick={addAll} className={`${addBtn} ml-auto`}>{added ? <AddLabel added /> : <><Icon name="cart" />Add whole kit</>}</button>
      </div>
    </div>
  );
}
