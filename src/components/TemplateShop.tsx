'use client';
// Template cards and the configure dialog for the shop. Config -> shapes -> CSG mesh (templates.ts), then the same mesh
// feeds the 3D view, the blueprint, the spec rows and the price. The server rebuilds all of it from the config on order.

import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { blueprint, blueprintData } from '@/lib/blueprint';
import { LAYER_MM } from '@/lib/printSpec';
import { quote, SETUP_FEE } from '@/lib/quote';
import { defaultCfg, normalizeCfg, type Cfg, type Field, type TemplateDef } from '@/lib/templateDefs';
import { buildTemplate, templateMesh } from '@/lib/templates';
import { buildOffThread } from '@/lib/buildOffThread';
import type { Shape } from '@/lib/playground';
import BlueprintSheet from './BlueprintSheet';
import { money } from './ContactFields';
import { QtyStepper } from './CartDrawer';
import { AiAction, addBtn, AddLabel, BackToShop, CardActions, CardFrame, previewBox, SpecRows, useAdded, useDebounced, useReduceMotion } from './ShopParts';
import { useCart } from './CartProvider';
import { kitBlocked } from '@/lib/kits';
import type { CartLine } from '@/lib/cart';
import { AI_DRAFT_KEY } from '@/lib/aiChat';
import { customLabel } from '@/lib/aiCustomise';
import FlowStrip from '@/components/FlowStrip';
import Term from '@/components/Term';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const AiConfigPanel = dynamic(() => import('./AiConfigPanel'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading AI…</p> });
const fmt = (n: number) => n.toFixed(1);
const catLabel = (id: string) => shopCatLabel(shopCat(id) ?? id);

type Result = ReturnType<typeof compute>;
// meshOf: build the mesh some other way (the shop grid builds it in a worker); the rest is cheap
function compute(t: TemplateDef, raw: Cfg, meshOf: (shapes: Shape[]) => Float32Array | null = templateMesh) {
  const cfg = normalizeCfg(t, raw);
  const built = buildTemplate(t, cfg);
  const mesh = meshOf(built.shapes);
  const D = mesh ? blueprintData(mesh, t.material) : null;
  const stats = D?.stats ?? null;
  const q = stats ? quote(stats, t.material, 1) : null;
  return { cfg, built, mesh, D, stats, q, error: !mesh || !stats ? 'This combination of settings cannot be built. Change a value a little.' : D && !D.fits ? 'This combination does not fit the print bed.' : null };
}

// default-config results, built once per template (the card's mesh comes from a worker)
const defaults = new Map<string, Result>();

const dims = (r: Result) => (r.D ? `${fmt(r.D.size.x)} × ${fmt(r.D.size.y)} × ${fmt(r.D.size.z)} mm` : 'n/a');

export function TemplateCard({ t, live, reduceMotion, setVisible }: {
  t: TemplateDef; live: boolean; reduceMotion: boolean; setVisible: (id: string, v: boolean) => void;
}) {
  const [r, setR] = useState<Result | null>(() => defaults.get(t.id) ?? null);
  const box = useRef<HTMLDivElement>(null);
  const { lines, add, toast } = useCart();
  const [added, setAdded] = useAdded();
  // default settings through the normal 'tpl' line (the server reprices); same configured-parts cap as a kit
  const addDefault = () => {
    if (!r?.q) return;
    const line: CartLine = { kind: 'tpl', id: t.id, cfg: r.cfg, qty: 1, unitPrice: r.q.unitPrice };
    const why = kitBlocked(lines, [line]);
    if (why) { toast(why); return; }
    add(line);
    toast('Added to cart', true);
    setAdded(true);
  };
  useEffect(() => {
    if (r) return;
    // the CSG runs in a worker: on a phone the cards' meshes took seconds of main-thread time
    let on = true;
    const shapes = buildTemplate(t, normalizeCfg(t, defaultCfg(t))).shapes;
    buildOffThread(shapes, true).then((m) => m, () => null).then((m) => {
      if (!on) return;
      if (!defaults.has(t.id)) defaults.set(t.id, compute(t, defaultCfg(t), () => m));
      setR(defaults.get(t.id)!);
    });
    return () => { on = false; };
  }, [r, t]);
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
      actions={<CardActions kind="template" id={t.id} added={added} disabled={!r?.q || !!r.error} onPrimary={addDefault} />}
    />
  );
}

const ctl = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

export function FieldControl({ f, value, onChange }: { f: Field; value: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
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
          <button type="button" aria-label={`Decrease ${f.label}`} title={`Decrease ${f.label}`} disabled={v <= f.min} onClick={() => step(-1)} className={`${ctl} h-10 w-10 px-0 disabled:opacity-40`}>−</button>
          <span className="w-16 text-center font-mono text-sm text-gray-900 dark:text-gray-100" aria-live="off">{v}{f.unit ? ` ${f.unit}` : ''}</span>
          <button type="button" aria-label={`Increase ${f.label}`} title={`Increase ${f.label}`} disabled={v >= f.max} onClick={() => step(1)} className={`${ctl} h-10 w-10 px-0 disabled:opacity-40`}>+</button>
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
  const [aiOpen, setAiOpen] = useState(false);
  const [proposal, setProposal] = useState<Cfg | null>(null); // an AI settings proposal being previewed; nothing is applied until Accept
  const pending = !proposal && applied !== cfg;
  const r = useMemo(() => compute(t, proposal ?? applied), [t, proposal, applied]);
  const cur = useMemo(() => (proposal ? compute(t, applied) : r), [t, proposal, applied, r]);
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
  const addToCart = () => {
    if (!r.q) return;
    add({ kind: 'tpl', id: t.id, cfg: r.cfg, qty, unitPrice: r.q.unitPrice });
    toast('Added to cart', true);
    setAdded(true);
  };
  const canAdd = !pending && !proposal && !r.error && !!r.q;
  const accept = (next: Cfg) => {
    if (!r.q || r.error) return;
    add({ kind: 'tpl', id: t.id, cfg: r.cfg, qty, unitPrice: r.q.unitPrice });
    setCfg(next); setProposal(null);
    toast(`Added to cart: ${customLabel(t.name)}`, true);
  };
  const toBuilder = () => { // a sandbox copy for the builder: the template itself is not touched
    try { sessionStorage.setItem(AI_DRAFT_KEY, JSON.stringify({ title: customLabel(t.name), notes: '', shapes: r.built.shapes, source: 'copy' })); } catch { return null; }
    return '/playground?mode=build&from=ai&ai=1';
  };

  return (
    <div className="space-y-6">
      <BackToShop />
      <FlowStrip current="adjust" />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(t.id)} · Configurable</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{t.name}</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3 md:sticky md:top-20 md:self-start">
          <div className={`relative ${previewBox}`}>
            {r.mesh && <ExamplePreview shapes={r.built.shapes} mesh={r.mesh} reduceMotion={reduceMotion} interactive material={t.material} />}
            {pending && <p role="status" className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Updating…</p>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Drag to turn. Scroll or pinch to zoom. The model, the drawing and the price all come from the same mesh.</p>
          <SpecRows rows={rows} />
        </div>

        <div className="space-y-3">
          <fieldset id="settings" className="scroll-mt-24 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Your settings</legend>
            {t.fields.map((f) => (
              <FieldControl key={f.key} f={f} value={cfg[f.key]} onChange={(v) => setCfg((c) => ({ ...c, [f.key]: v }))} />
            ))}
          </fieldset>
          <div className="flex gap-3"><AiAction onClick={() => setAiOpen((o) => !o)} pressed={aiOpen} /></div>
          {aiOpen && (
            <AiConfigPanel kind="template" id={t.id} name={t.name} fields={t.fields} current={normalizeCfg(t, cfg)}
              priceNow={cur.q ? money.format(quote(cur.stats!, t.material, qty).total) : 'n/a'} priceNew={proposal && r.stats ? money.format(quote(r.stats, t.material, qty).total) : null}
              ready={!r.error && !!r.q} onProposal={setProposal} onAccept={accept} onBuilder={toBuilder} onClose={() => { setAiOpen(false); setProposal(null); }} />
          )}
          {r.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{r.error}</p> : <p className="text-sm text-gray-700 dark:text-gray-300">{r.built.description}</p>}
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total != null ? money.format(total) : 'n/a'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">for {qty} · made to order · includes {money.format(SETUP_FEE)} setup</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Suggested material {t.material}, colour {t.colour}. Price is an estimate from the mesh; we confirm before payment.</p>
          <QtyStepper name={t.name} qty={qty} onChange={setQty} />
          <div className="flex gap-3 pt-1">
            <CardActions kind="template" id={t.id} added={added} disabled={!canAdd} onPrimary={addToCart} secondaryHref="#settings" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">We review your order and send a payment link; printing starts once it is paid.</p>
        </div>
      </div>

      <div aria-hidden className="h-16 md:hidden" />
      <div className="pp-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden dark:border-gray-700 dark:bg-gray-900/95">
        <span className="font-mono text-base font-semibold text-gray-900 dark:text-white">{total != null ? money.format(total) : 'n/a'}</span>
        <button type="button" disabled={!canAdd} onClick={addToCart} aria-label="Add to cart" title="Add to cart" className={`${addBtn} ml-auto`}><AddLabel added={added} /></button>
      </div>

      <section aria-label="Blueprint" className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Blueprint</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Terms on the drawing: <Term k="fill-factor">fill factor</Term>, <Term k="third-angle">third-angle projection</Term>, <Term k="openings">openings</Term>.</p>
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
