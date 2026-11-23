'use client';
// Template cards and the configure dialog for the shop. Config -> shapes -> CSG mesh (templates.ts), then the same mesh
// feeds the 3D view, the blueprint, the spec rows and the price. The server rebuilds all of it from the config on order.

import Icon from './Icon';
import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '@/lib/catalog';
import { blueprint, blueprintData } from '@/lib/blueprint';
import { LAYER_MM } from '@/lib/printSpec';
import { quote, SETUP_FEE } from '@/lib/quote';
import { defaultCfg, normalizeCfg, COMING_SOON, type Cfg, type Field, type TemplateDef } from '@/lib/templateDefs';
import { buildTemplate, templateMesh } from '@/lib/templates';
import BlueprintSheet from './BlueprintSheet';
import { money, secondaryBtn } from './ContactFields';
import { QtyStepper } from './CartDrawer';
import { useCart } from './CartProvider';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const fmt = (n: number) => n.toFixed(1);
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

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

export function TemplateCard({ t, index, live, reduceMotion, setVisible, onView }: {
  t: TemplateDef; index: number; live: boolean; reduceMotion: boolean;
  setVisible: (id: string, v: boolean) => void; onView: (id: string, opener: HTMLElement) => void;
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

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div ref={box} className="h-44 bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950" aria-hidden>
        {live && r?.mesh && <ExamplePreview shapes={r.built.shapes} mesh={r.mesh} reduceMotion={reduceMotion} material={t.material} />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(t.category)} · Configurable</span>
          <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{t.name}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.blurb}</p>
        {r ? (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300">{dims(r)} at default settings · {t.material}</p>
            {r.q && <p className="text-sm text-gray-500 dark:text-gray-400">about {fmt(r.q.grams)} g</p>}
            {r.q && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{money.format(r.q.total)} at default settings</p>}
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Working out size and price…</p>
        )}
        <button type="button" aria-haspopup="dialog" onClick={(e) => onView(t.id, e.currentTarget)} className={`${secondaryBtn} mt-auto w-full`}>
          <Icon name="wrench" />Configure
        </button>
      </div>
    </li>
  );
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const h = setTimeout(() => setD(v), ms);
    return () => clearTimeout(h);
  }, [v, ms]);
  return d;
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
      <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={v} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-indigo-600" />
    </div>
  );
}

export function TemplateDialog({ t, reduceMotion, onClose }: { t: TemplateDef; reduceMotion: boolean; onClose: () => void }) {
  const { add, toast } = useCart();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [cfg, setCfg] = useState<Cfg>(() => defaultCfg(t));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const applied = useDebounced(cfg, 250); // CSG runs on the settled values only
  const pending = applied !== cfg;
  const r = useMemo(() => compute(t, applied), [t, applied]);
  const svg = useMemo(() => (sheet && r.mesh ? blueprint(r.mesh, { name: t.name, id: t.id, material: t.material }) : null), [sheet, r, t]);
  const total = r.stats ? quote(r.stats, t.material, qty).total : null;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'));
      const first = els[0], last = els[els.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!added) return;
    const h = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(h);
  }, [added]);

  const rows: [string, string][] = [
    ['Size', dims(r)],
    ['Volume', r.stats ? `${r.stats.volumeCm3.toFixed(2)} cm³` : 'n/a'],
    ['Material', t.material],
    ['Est. weight', r.q ? `${fmt(r.q.grams)} g` : 'n/a'],
    ['Layers', r.D?.layers != null ? `${r.D.layers} at ${LAYER_MM} mm` : 'n/a'],
    ['Pieces', String(r.built.parts)],
  ];
  const canAdd = !pending && !r.error && !!r.q;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl dark:bg-gray-950 sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{catLabel(t.category)}</span>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{t.name}</h2>
          </div>
          <button ref={closeBtn} type="button" aria-label="Close" onClick={onClose} className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid md:grid-cols-[1.15fr_1fr]">
          <div className="space-y-3 p-5 pt-0">
            <div className="relative h-72 overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 sm:h-96">
              {r.mesh && <ExamplePreview shapes={r.built.shapes} mesh={r.mesh} reduceMotion={reduceMotion} interactive material={t.material} />}
              {pending && <p role="status" className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Updating…</p>}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Drag to turn. Scroll or pinch to zoom. The model, the drawing and the price all come from the same mesh.</p>
            <button type="button" aria-pressed={sheet} onClick={() => setSheet((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              <Icon name="grid" />Blueprint {sheet ? '↑' : '↓'}
            </button>
          </div>

          <div className="space-y-3 p-5 pt-0">
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
            <dl className="divide-y divide-gray-200 border-y border-gray-200 text-sm dark:divide-gray-700 dark:border-gray-700">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="text-right font-mono text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
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
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-indigo-600 px-4 font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {added ? <><Icon name="check" />Added</> : <><Icon name="cart" />Add to cart</>}
              </button>
            </div>
          </div>
        </div>

        {t.marketLinks.length > 0 && (
          <section aria-labelledby={`${titleId}-mk`} className="border-t border-gray-200 p-5 dark:border-gray-800">
            <h3 id={`${titleId}-mk`} className="text-base font-semibold text-gray-900 dark:text-white">Off-the-shelf alternatives — Not made by PrintPro3D</h3>
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

        {sheet && svg && (
          <div className="p-5 pt-0">
            <BlueprintSheet svg={svg} filename={`${t.id}-blueprint`} />
          </div>
        )}
      </div>
    </div>
  );
}

export function ComingSoon() {
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Coming soon: {COMING_SOON.map((c) => c.name).join(', ')}.
    </p>
  );
}
