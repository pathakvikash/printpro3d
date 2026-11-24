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
import { quote, SETUP_FEE } from '@/lib/quote';
import { normalizeCfg, templateById } from '@/lib/templateDefs';
import { buildTemplate } from '@/lib/templates';
import { buildOffThread } from '@/lib/buildOffThread';
import { productById } from '@/lib/shopProducts';
import type { Shape } from '@/lib/playground';
import { money, secondaryBtn } from './ContactFields';
import { useCart } from './CartProvider';
import { addBtn, AddLabel, BackToShop, CardFrame, SpecRows, useAdded, useReduceMotion } from './ShopParts';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });

type Part = { item: KitItem; name: string; material: string; shapes: Shape[]; mesh: Float32Array | null | undefined; unit: number | null; total: number | null };

// everything about one kit item that does not need the mesh
function describe(item: KitItem) {
  const t = templateById(item.templateId);
  if (t) return { name: t.name, material: t.material, shapes: buildTemplate(t, normalizeCfg(t, item.config)).shapes, template: true };
  const p = productById(item.templateId);
  return { name: p?.item.name ?? item.templateId, material: p?.item.material ?? '', shapes: p?.ex.shapes ?? [], template: false };
}

function useParts(kit: Kit): Part[] {
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

export function KitCard({ kit }: { kit: Kit }) {
  const names = kit.items.map((i) => `${i.qty > 1 ? `${i.qty} x ` : ''}${describe(i).name}`);
  const rows: [string, string][] = [['Printed parts', `${kitPartCount(kit)} in ${kit.items.length} kinds`], ['Bought separately', `${kit.boughtParts.length} items`]];
  return (
    <CardFrame
      href={`/shop/${kit.id}`}
      category={`${shopCatLabel(shopCat(kit.id) ?? '')} · Kit`}
      name={kit.title}
      blurb={kit.blurb}
      rows={rows}
      preview={<div className="flex h-full flex-col justify-center gap-0.5 p-4 text-sm text-gray-700 dark:text-gray-300">{names.map((n) => <span key={n}>{n}</span>)}</div>}
      actions={<Link href={`/shop/${kit.id}`} tabIndex={-1} className={`${secondaryBtn} w-full`}><Icon name="wrench" />See the kit</Link>}
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
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{shopCatLabel(shopCat(kit.id) ?? '')} · Kit</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{kit.title}</h1>
        <p className="mt-2 max-w-3xl text-gray-700 dark:text-gray-300">{kit.blurb}</p>
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
      <div className="max-w-md space-y-3">
        <SpecRows rows={[['Printed parts', `${kitPartCount(kit)} in ${kit.items.length} lines`], ['Total', total != null ? `${money.format(total)}` : '…']]} />
        <p className="text-xs text-gray-500 dark:text-gray-400">The total adds each line as priced on its own page (each line includes {money.format(SETUP_FEE)} setup). Price is an estimate from the meshes; we confirm before payment. Open a part to change its settings before you add it.</p>
        <button type="button" disabled={!ready} onClick={addAll} className={`${addBtn} w-full`}>
          {added ? <AddLabel added /> : <><Icon name="cart" />Add whole kit</>}
        </button>
      </div>
      <section aria-labelledby="kit-bought" className="border-t border-gray-200 pt-4 dark:border-gray-800">
        <h2 id="kit-bought" className="text-lg font-semibold text-gray-900 dark:text-white">Bought separately</h2>
        <p className="mb-2 mt-1 text-sm text-gray-600 dark:text-gray-400">We do not sell these. Specs are typical for this kind of build: check them against your parts.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
          {kit.boughtParts.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </section>
    </div>
  );
}
