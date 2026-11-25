'use client';
// Bill of materials for the Build canvas: dropped templates (priced, add to cart), loose shapes (the existing "Get a price" flow)
// and bought parts (no prices, enquiry only). Template meshes are only built in the browser, after mount, one at a time.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../Icon';
import BoughtList from '../BoughtList';
import { useCart } from '../CartProvider';
import { money } from '../ContactFields';
import { templateById, defaultCfg } from '@/lib/templateDefs';
import { MAX_QTY, fitsBed, meshStats, quote, type MeshStats } from '@/lib/quote';
import { buildOffThread } from '@/lib/buildOffThread';
import { MOTORS } from '@/lib/motors';
import type { BoughtItem } from '@/lib/kits';
import type { Parts } from '@/lib/flight/layout';
import type { Shape } from '@/lib/playground';

const btn = 'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';

// the mesh of a template at its default config is built once per id, off the main thread, and is the same for every drop
const stats = new Map<string, MeshStats | 'error'>();

export default function Bom({ shapes, parts, onPrice, priceBusy, onSave, saving, note }: {
  shapes: Shape[]; parts: Parts; onPrice: () => void; priceBusy: boolean; onSave?: () => void; saving: boolean; note: string | null;
}) {
  const { add, toast } = useCart();
  const [, tick] = useState(0);
  const [adding, setAdding] = useState(false);
  const loose = shapes.filter((s) => !s.group).length;
  const tpls = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of shapes) if (s.group && s.tpl && templateById(s.tpl)) m.set(s.tpl, (m.get(s.tpl) ?? new Set()).add(s.group));
    return [...m].map(([id, g]) => ({ id, qty: Math.min(g.size, MAX_QTY) }));
  }, [shapes]);
  const ids = tpls.map((t) => t.id).join();
  useEffect(() => {
    let live = true;
    void (async () => {
      const { buildTemplate } = await import('@/lib/templates'); // the shape list only: cheap, no CSG
      for (const { id } of tpls) {
        if (stats.has(id)) continue;
        try {
          const mesh = await buildOffThread(buildTemplate(templateById(id)!, defaultCfg(templateById(id)!)).shapes, true);
          const st = mesh ? meshStats(mesh) : null;
          stats.set(id, st && fitsBed(st.sizeMm) ? st : 'error');
        } catch { stats.set(id, 'error'); }
        if (live) tick((x) => x + 1);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const bought = useMemo<BoughtItem[]>(() => {
    const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())];
    return [
      ...count(parts.motors.map((m) => m.motorId)).map(([id, n]): BoughtItem => ({ text: `${n}x ${MOTORS.find((m) => m.id === id)?.name ?? id}`, parts: [id] })),
      ...count(parts.components.map((c) => c.name)).map(([name, n]): BoughtItem => `${n}x ${name}`),
    ];
  }, [parts]);

  const rows = tpls.map(({ id, qty }) => {
    const t = templateById(id)!, st = stats.get(id);
    return { t, qty, total: st && st !== 'error' ? quote(st, t.material, qty).total : null, failed: st === 'error' };
  });
  const addAll = async () => {
    setAdding(true);
    try {
      // the displayed price is the cart line's unit price; the server reprices from id + cfg at checkout
      for (const { t, qty } of rows) {
        const st = stats.get(t.id);
        if (!st || st === 'error') continue;
        add({ kind: 'tpl', id: t.id, cfg: defaultCfg(t), qty, unitPrice: quote(st, t.material, qty).unitPrice });
      }
      toast('Added to cart', true);
    } catch {
      toast('Could not add these parts to the cart. Try again.');
    } finally {
      setAdding(false);
    }
  };

  if (!rows.length && !loose && !bought.length) return null;
  return (
    <section aria-label="Bill of materials" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bill of materials</h3>
      {rows.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
            {rows.map(({ t, qty, total, failed }) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0">{qty}x {t.name} <span className="text-xs text-gray-500 dark:text-gray-400">({t.material})</span></span>
                <span className="shrink-0 text-xs text-gray-600 dark:text-gray-300">{failed ? 'we quote it' : total === null ? 'pricing…' : money.format(total)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addAll} disabled={adding || rows.some((r) => r.total === null && !r.failed) || rows.every((r) => r.failed)} aria-label="Add to cart" title="Add to cart" className={`${btn} w-full`}>
            <Icon name="cart" className="h-4 w-4" />{adding ? 'Adding' : 'Add to cart'}
          </button>
        </div>
      )}
      {loose > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-200">
          <span>{loose} loose {loose === 1 ? 'shape' : 'shapes'}</span>
          <button type="button" onClick={onPrice} disabled={priceBusy} aria-label="Price: get a price for the loose shapes" title="Get a price" className={btn}><Icon name="tag" className="h-4 w-4" />{priceBusy ? 'Building' : 'Price'}</button>
        </div>
      )}
      {bought.length > 0 && <div><BoughtList items={bought} title="Bought parts" /></div>}
      {onSave && (
        <div className="space-y-1">
          <button type="button" onClick={onSave} disabled={saving || !shapes.length} aria-label="Save design" title="Save design" className={`${btn} w-full`}><Icon name="check" className="h-4 w-4" />{saving ? 'Saving' : 'Save'}</button>
          {note && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{note}</p>}
        </div>
      )}
    </section>
  );
}
