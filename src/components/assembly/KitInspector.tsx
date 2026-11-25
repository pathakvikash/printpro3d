'use client';
// Playground > Inspect for a kit: the finished assembled build next to its engineering (blueprint of the selected part,
// a parts list with sizes). Selecting a part in the list tints it in the model and draws its blueprint.
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { blueprint, bounds } from '@/lib/blueprint';
import type { Kit } from '@/lib/kits';
import { FinishedBuild, VariantPicker, useParts } from '../KitShop';
import CreditLine from '../KitCredit';
import BoughtList from '../BoughtList';

const BlueprintPager = dynamic(() => import('../BlueprintSheet').then((m) => m.BlueprintPager), { ssr: false });
const mm = (n: number) => n.toFixed(1);

export default function KitInspector({ kit: top }: { kit: Kit }) {
  const [vi, setVi] = useState(0); // a kit of several products (led-decor): pick one
  const kit = top.variants?.[vi] ?? top;
  const parts = useParts(kit);
  const [sel, setSel] = useState<string | null>(null);
  const id = kit.items.some((i) => i.templateId === sel) ? sel : kit.items[0]?.templateId ?? null;
  const cur = parts.find((p) => p.item.templateId === id);
  const sheet = useMemo(() => (cur?.mesh ? blueprint(cur.mesh, { name: cur.name, material: cur.material }) : null), [cur]);
  const partSheet = sheet ? { title: cur?.name ?? 'part', svg: sheet, filename: `blueprint-${(cur?.name ?? 'part').replace(/\W+/g, '-').toLowerCase()}` } : null;
  return (
    <div className="space-y-6">
      {top.variants && <VariantPicker kit={top} index={vi} onPick={setVi} />}
      {kit.assembly ? <FinishedBuild kit={kit} parts={parts} focusId={id} partSheet={partSheet} /> : partSheet ? <BlueprintPager index={0} onIndex={() => {}} sheets={[partSheet]} /> : <div role="status" aria-label="Drawing the blueprint" className="h-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />}
      <section aria-label="Parts list" className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Parts list</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <tr><th className="px-3 py-2 font-semibold">Part</th><th className="px-3 py-2 font-semibold">Qty</th><th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Size X × Y × Z (mm)</th></tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const on = p.item.templateId === id;
                const s = p.mesh ? bounds(p.mesh).size : null;
                return (
                  <tr key={p.item.templateId} className={`border-t border-gray-200 dark:border-gray-700 ${on ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}`}>
                    <td className="px-3 py-1">
                      <button type="button" aria-pressed={on} onClick={() => setSel(p.item.templateId)} className="min-h-9 text-left font-medium text-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-gray-100">{p.name}</button>
                    </td>
                    <td className="px-3 py-1 text-gray-800 dark:text-gray-200">{p.item.qty}</td>
                    <td className="px-3 py-1 text-gray-800 dark:text-gray-200">{p.material}</td>
                    <td className="px-3 py-1 font-mono text-gray-800 dark:text-gray-200">{s ? `${mm(s.x)} × ${mm(s.y)} × ${mm(s.z)}` : '…'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {kit.credit && <CreditLine credit={kit.credit} files className="break-words" />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div><BoughtList items={kit.boughtParts} title={kit.assemblyData === false ? 'Not printed — buy separately' : undefined} /></div>
        <p className="text-sm text-gray-600 dark:text-gray-300"><Link href={`/shop/${top.id}`} className="font-medium text-indigo-700 underline underline-offset-2 hover:no-underline dark:text-indigo-400">Open the kit page</Link> to see prices and add the whole kit to your cart.</p>
      </div>
    </div>
  );
}
