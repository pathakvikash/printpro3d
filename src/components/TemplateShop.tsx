'use client';
// Template cards and the configure dialog for the shop. Config -> shapes -> CSG mesh (templates.ts), then the same mesh
// feeds the 3D view, the blueprint, the spec rows and the price. The server rebuilds all of it from the config on order.

import Icon from './Icon';
import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { blueprint, blueprintData } from '@/lib/blueprint';
import { LAYER_MM } from '@/lib/printSpec';
import { quote, SETUP_FEE } from '@/lib/quote';
import { defaultCfg, normalizeCfg, COMING_SOON, type Cfg, type Field, type TemplateDef } from '@/lib/templateDefs';
import { buildTemplate, templateMesh } from '@/lib/templates';
import BlueprintSheet from './BlueprintSheet';
import { money, secondaryBtn } from './ContactFields';
import { QtyStepper } from './CartDrawer';
import { addBtn, AddLabel, BackToShop, CardFrame, previewBox, SpecRows, useAdded, useDebounced, useReduceMotion } from './ShopParts';
import { useCart } from './CartProvider';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const fmt = (n: number) => n.toFixed(1);
const catLabel = (id: string) => shopCatLabel(shopCat(id) ?? id);

type Result = ReturnType<typeof compute>;
function compute(t: TemplateDef, raw: Cfg) {
  const cfg = normalizeCfg(t, raw);
  const built = buildTemplate(t, cfg);
  const mesh = templateMesh(built.shapes);
  const D = mesh ? blueprintData(mesh, t.material) : null;
  const stats = D?.stats ?? null;
  const q = stats ? quote(stats, t.material, 1) : null;
  return { cfg, built, mesh, D, stats, q, error: !mesh || !stats ? 'This combination of settings cannot be built. Change a value a little.' : D && !D.fits ? 'This combination does not fit the print bed.' : null };
}

// default-config results are shared by the card and its dialog and built once
const defaults = new Map<string, Result>();
const defaultResult = (t: TemplateDef) => {
  if (!defaults.has(t.id)) defaults.set(t.id, compute(t, defaultCfg(t)));
  return defaults.get(t.id)!;
};

const dims = (r: Result) => (r.D ? `${fmt(r.D.size.x)} × ${fmt(r.D.size.y)} × ${fmt(r.D.size.z)} mm` : 'n/a');

export function TemplateCard({ t, index, live, reduceMotion, setVisible }: {
  t: TemplateDef; index: number; live: boolean; reduceMotion: boolean; setVisible: (id: string, v: boolean) => void;
}) {
  const [r, setR] = useState<Result | null>(() => defaults.get(t.id) ?? null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (r) return;
    const h = setTimeout(() => setR(defaultResult(t)), 60 * index); // spread the CSG work so the page paints first
    return () => clearTimeout(h);
  }, [r, t, index]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([en]) => setVisible(t.id, en.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => {
      io.disconnect();
      setVisible(t.id, false);
    };
  }, [t.id, setVisible]);

  const rows: [string, string][] = [
    ['Size', r ? dims(r) : '…'],
    ['Material', t.material],
    ['Weight', r?.q ? `about ${fmt(r.q.grams)} g` : '…'],
    ['From', r?.q ? `${money.format(r.q.total)} (default settings)` : '…'],
  ];
  return (
    <CardFrame
      href={`/shop/${t.id}`}
      category={`${catLabel(t.id)} · Configurable`}
      name={t.name}
      blurb={t.blurb}
      rows={rows}
      previewRef={box}
      preview={live && r?.mesh && <ExamplePreview shapes={r.built.shapes} mesh={r.mesh} reduceMotion={reduceMotion} material={t.material} />}
      actions={<span className={`${secondaryBtn} w-full`}><Icon name="wrench" />Configure</span>}
    />
  );
}

const ctl = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

function FieldControl({ f, value, onChange }: { f: Field; value: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  const id = useId();
  if (f.type === 'bool') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
        {f.label}
      </label>
    );
  }
  if (f.type === 'select') {
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-gray-800 dark:text-gray-200">{f.label}</label>
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${ctl} min-w-0 max-w-[60%]`}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  const v = value as number;
  const step = (d: number) => onChange(Math.min(f.max, Math.max(f.min, Math.round((v + d * f.step) * 1000) / 1000)));
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-gray-800 dark:text-gray-200">{f.label}</label>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={`Decrease ${f.label}`} disabled={v <= f.min} onClick={() => step(-1)} className={`${ctl} h-8 w-8 px-0 disabled:opacity-40`}>−</button>
          <span className="w-16 text-center font-mono text-sm text-gray-900 dark:text-gray-100" aria-live="off">{v}{f.unit ? ` ${f.unit}` : ''}</span>
          <button type="button" aria-label={`Increase ${f.label}`} disabled={v >= f.max} onClick={() => step(1)} className={`${ctl} h-8 w-8 px-0 disabled:opacity-40`}>+</button>
        </div>
      </div>
      <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={v} aria-valuetext={`${v}${f.unit ? ` ${f.unit}` : ''}`} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-indigo-600" />
    </div>
  );
}

// the product page body: live configurator, 3D view and drawing always side by side / stacked, price from the same mesh
export function TemplateDetail({ t }: { t: TemplateDef }) {
  const { add, toast } = useCart();
  const reduceMotion = useReduceMotion();
  const titleId = useId();
  const [cfg, setCfg] = useState<Cfg>(() => defaultCfg(t));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useAdded();
  const applied = useDebounced(cfg, 250); // CSG runs on the settled values only
  const pending = applied !== cfg;
  const r = useMemo(() => compute(t, applied), [t, applied]);
  const svg = useMemo(() => (r.mesh ? blueprint(r.mesh, { name: t.name, id: t.id, material: t.material }) : null), [r, t]);
  const total = r.stats ? quote(r.stats, t.material, qty).total : null;

  const rows: [string, string][] = [
    ['Size', dims(r)],
    ['Volume', r.stats ? `${r.stats.volumeCm3.toFixed(2)} cm³` : 'n/a'],
    ['Material', t.material],
    ['Est. weight', r.q ? `${fmt(r.q.grams)} g` : 'n/a'],
    ['Layers', r.D?.layers != null ? `${r.D.layers} at ${LAYER_MM} mm (assumed)` : 'n/a'],
    ['Pieces', String(r.built.parts)],
  ];
  const canAdd = !pending && !r.error && !!r.q;

  return (
    <div className="space-y-6">
      <BackToShop />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(t.id)} · Configurable</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{t.name}</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className={`relative ${previewBox}`}>
            {r.mesh && <ExamplePreview shapes={r.built.shapes} mesh={r.mesh} reduceMotion={reduceMotion} interactive material={t.material} />}
            {pending && <p role="status" className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Updating…</p>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Drag to turn. Scroll or pinch to zoom. The model, the drawing and the price all come from the same mesh.</p>
        </div>

        <div className="space-y-3">
          <fieldset className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Your settings</legend>
            {t.fields.map((f) => (
              <FieldControl key={f.key} f={f} value={cfg[f.key]} onChange={(v) => setCfg((c) => ({ ...c, [f.key]: v }))} />
            ))}
          </fieldset>
          {r.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{r.error}</p> : <p className="text-sm text-gray-700 dark:text-gray-300">{r.built.description}</p>}
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total != null ? money.format(total) : 'n/a'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">for {qty} · made to order · includes {money.format(SETUP_FEE)} setup</span>
          </p>
          <SpecRows rows={rows} />
          <p className="text-xs text-gray-500 dark:text-gray-400">Suggested material {t.material}, colour {t.colour}. Price is an estimate from the mesh; we confirm before payment.</p>
          <div className="flex items-center gap-3 pt-1">
            <QtyStepper name={t.name} qty={qty} onChange={setQty} />
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                if (!r.q) return;
                add({ kind: 'tpl', id: t.id, cfg: r.cfg, qty, unitPrice: r.q.unitPrice });
                toast('Added to cart', true);
                setAdded(true);
              }}
              className={addBtn}
            >
              <AddLabel added={added} />
            </button>
          </div>
        </div>
      </div>

      <section aria-label="Blueprint" className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Blueprint</h2>
        {svg ? <BlueprintSheet svg={svg} filename={`${t.id}-blueprint`} /> : <p className="text-sm text-gray-500 dark:text-gray-400">No drawing for these settings.</p>}
      </section>

      {t.marketLinks.length > 0 && (
        <section aria-labelledby={`${titleId}-mk`} className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <h2 id={`${titleId}-mk`} className="text-base font-semibold text-gray-900 dark:text-white">Off-the-shelf alternatives — Not made by PrintPro3D</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {t.marketLinks.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline dark:text-indigo-400">{m.label}</a>
                <span className="text-gray-500 dark:text-gray-400">{m.priceBand ? ` · ${m.priceBand}` : ''} · checked {m.checkedOn}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ComingSoon() {
  if (!COMING_SOON.length) return null;
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Coming soon: {COMING_SOON.map((c) => c.name).join(', ')}.
    </p>
  );
}
