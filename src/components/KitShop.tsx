'use client';
// Kit card (shop grid) and kit page: the parts with mini previews, "Add whole kit", and the list of parts bought separately.
// Each line is an ordinary cart line priced from its own mesh; the server reprices every line at checkout like any other.

import Icon from './Icon';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { blueprintData } from '@/lib/blueprint';
import { assemblyBlueprint } from '@/lib/assemblyBlueprint';
import { printPlates } from '@/lib/assembly';
import { partMesh } from '@/lib/partModels';
import { partById } from '@/lib/parts';
import { kitBlocked, kitById, kitLines, kitPartCount, type Kit, type KitItem } from '@/lib/kits';
import { isKitKey, kitPartByKey, kitSettings, settingsSummary } from '@/lib/kits/adapt';
import CreditLine from './KitCredit';
import * as THREE from 'three';
import { prepGeometry } from './PrintMaterial';
import type { V3 } from '@/lib/assembly';
import { meshStats, quote, SETUP_FEE } from '@/lib/quote';
import { normalizeCfg, templateById, type Cfg, type Field } from '@/lib/templateDefs';
import { buildTemplate } from '@/lib/templates';
import { buildOffThread, kitMeshOffThread } from '@/lib/buildOffThread';
import { productById } from '@/lib/shopProducts';
import type { Shape } from '@/lib/playground';
import { money } from './ContactFields';
import { useCart } from './CartProvider';
import { AI_DRAFT_KEY } from '@/lib/aiChat';
import { customLabel } from '@/lib/aiCustomise';
import FlowStrip from '@/components/FlowStrip';
import BoughtList from './BoughtList';
import { AiAction, addBtn, AddLabel, BackToShop, CardActions, CardFrame, SpecRows, useAdded, useDebounced, useReduceMotion } from './ShopParts';
import { SettingsPanel } from './FieldControl';

const KitThumb = dynamic(() => import('./assembly/KitThumb'), { ssr: false });
const BlueprintSheet = dynamic(() => import('./BlueprintSheet'), { ssr: false });
const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false });
const AiConfigPanel = dynamic(() => import('./AiConfigPanel'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading AI…</p> });
const AssemblyViewer = dynamic(() => import('./assembly/AssemblyViewer'), { ssr: false, loading: () => <div aria-hidden className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" /> });

export type Part = { kit: boolean; item: KitItem; name: string; material: string; shapes: Shape[]; mesh: Float32Array | null | undefined; unit: number | null; total: number | null };

// everything about one kit item that does not need the mesh
function describe(item: KitItem) {
  if (isKitKey(item.templateId)) { // a printed part of a kit file (src/lib/kits/): its mesh comes from kitMeshOffThread, not from shapes
    const hit = kitPartByKey(item.templateId);
    return { name: item.label ?? hit?.part.label ?? item.templateId, material: hit?.part.material ?? 'PLA', shapes: [] as Shape[], template: false, kit: true };
  }
  const t = templateById(item.templateId);
  if (t) return { name: t.name, material: t.material, shapes: buildTemplate(t, normalizeCfg(t, item.config)).shapes, template: true, kit: false };
  const p = productById(item.templateId);
  return { name: p?.item.name ?? item.templateId, material: p?.item.material ?? '', shapes: p?.ex.shapes ?? [], template: false, kit: false };
}

type Built = { item: KitItem; mesh: Float32Array | null | undefined };

export function useParts(kit: Kit): Part[] {
  const base = useMemo(() => kit.items.map((item) => ({ item, ...describe(item) })), [kit]);
  // `item` says which kit object a mesh was built for: after a settings change the old mesh stays on screen but carries no price until the new one arrives
  const [meshes, setMeshes] = useState<Built[]>(() => kit.items.map((item) => ({ item, mesh: undefined })));
  const done = useRef(new Map<string, Float32Array | null>()); // part + settings -> mesh, so stepping back to a value already built is instant
  useEffect(() => {
    let on = true;
    base.forEach((b, i) => {
      const key = `${b.item.templateId}|${JSON.stringify(b.item.config)}`;
      const set = (m: Float32Array | null | undefined) => on && setMeshes((cur) => cur.map((x, j) => (j === i ? { item: b.item, mesh: m } : x)));
      if (done.current.has(key)) return set(done.current.get(key));
      (b.kit ? kitMeshOffThread(b.item.templateId, b.item.config) : buildOffThread(b.shapes, b.template)).then((m) => m, () => null).then((m) => {
        if (done.current.size > 40) done.current.delete(done.current.keys().next().value!);
        done.current.set(key, m);
        set(m);
      });
    });
    return () => { on = false; };
  }, [base]);
  return useMemo(() => base.map((b, i) => {
    const mesh = meshes[i]?.mesh, fresh = meshes[i]?.item === b.item;
    let unit: number | null = null, total: number | null = null;
    if (!fresh) { /* priced once the rebuilt mesh arrives */ }
    else if (b.kit) {
      const stats = mesh ? meshStats(mesh) : null;
      if (stats) { unit = quote(stats, b.material, 1).unitPrice; total = quote(stats, b.material, b.item.qty).total; }
    } else if (b.template) {
      const stats = mesh ? blueprintData(mesh, b.material)?.stats : null;
      if (stats) { unit = quote(stats, b.material, 1).unitPrice; total = quote(stats, b.material, b.item.qty).total; }
    } else {
      const price = productById(b.item.templateId)?.item.price;
      if (price != null) { unit = price; total = price * b.item.qty; }
    }
    return { kit: b.kit, item: b.item, name: b.name, material: b.material, shapes: b.shapes, mesh, unit, total };
  }), [base, meshes]);
}

// Assembly part id (digits stripped) -> its reference model in parts.ts, for the assembly drawing; others stay placeholders.
const BOUGHT_MODEL: Record<string, string> = { battery: 'lipo-3s-4s', puck: 'gps-puck-25', camera: 'camera-19', motor: 'motor-1404', prop: 'prop-3in', esp32: 'board-esp32-devkit', sg90: 'servo-sg90' };

// The finished build: the kit's assembly() posed in the shared viewer, once every part mesh is built (bounding boxes come from them).
export function FinishedBuild({ kit, parts, focusId, updating }: { kit: Kit; parts: Part[]; focusId?: string | null; updating?: boolean }) {
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
    const all = kit.assembly(sizes);
    return kit.assemblyData === false ? { geometries, ...(() => { const r = printPlates(all, kit.plates); return { assembly: r.parts, plates: r.plates }; })() } : { geometries, assembly: all, plates: 0 };
  }, [kit, parts]);
  const sheet = useMemo(() => {
    if (!built) return null;
    const meshes: Record<string, Float32Array> = {};
    for (const p of parts) meshes[p.item.templateId] = p.mesh!;
    const ref = (a: { id: string }) => {
      const id = a.id.replace(/\d+$/, '');
      // the kits of src/lib/kits/ name their own reference parts (refs); the two template kits use the table above
      const pid = kit.items.some((i) => isKitKey(i.templateId)) ? kit.refs?.[a.id] ?? kit.refs?.[id] : kit.id === 'rover-kit' && id === 'motor' ? 'adafruit-tt-48' : BOUGHT_MODEL[id];
      const part = pid ? partById(pid) : null;
      return part ? partMesh(part) : null;
    };
    return assemblyBlueprint(built.assembly, meshes, { name: kit.title, ref, plates: !!built.plates });
  }, [built, parts, kit]);
  useEffect(() => () => { if (built) Object.values(built.geometries).forEach((g) => g.dispose()); }, [built]);
  if (!kit.assembly) return null;
  const plates = kit.assemblyData === false; // no real assembly data: show what gets printed, never a guessed assembly
  return (
    <section aria-labelledby="kit-finished" className="space-y-2">
      <h2 id="kit-finished" className="text-lg font-semibold text-gray-900 dark:text-white">{plates ? 'What you\'ll print' : 'The finished build'}</h2>
      {built ? <div className="relative"><AssemblyViewer parts={built.assembly} geometries={built.geometries} focusId={focusId} plates={built.plates || undefined} />{updating && <p role="status" className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Updating…</p>}</div> : <div role="status" aria-label={plates ? 'Laying out the print plates' : 'Building the finished model'} className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" />}
      {plates ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Shown as printed, not assembled.{(kit.plates?.length ?? 0) > 1 && ' Parts are laid out flat on two print plates.'}{kit.credit && <> <a href={kit.credit.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 underline underline-offset-2 hover:no-underline dark:text-indigo-400">Assembly guide on the source project page →</a></>}</p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">Grey parts are bought separately. Bought parts are drawn as placeholders at typical sizes.{kit.approximate && ' The positions of the parts are approximate (a stacked layout, not the real fit).'}</p>
      )}
      {kit.credit && <CreditLine credit={kit.credit} />}
      {sheet && (
        <div className="space-y-2 pt-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plates ? 'Print plate drawing' : 'Assembly drawing'}</h3>
          <BlueprintSheet svg={sheet} filename={`${plates ? 'print-plates' : 'assembly'}-${kit.id}`} />
        </div>
      )}
    </section>
  );
}

export function KitCard({ kit }: { kit: Kit }) {
  const descs = useMemo(() => kit.items.map((i) => ({ i, ...describe(i) })), [kit]);
  const names = descs.map((d) => `${d.i.qty > 1 ? `${d.i.qty} x ` : ''}${d.name}`);
  const sources = useMemo(() => descs.map((d) => ({ id: d.i.templateId, shapes: d.shapes, template: d.template, kit: d.kit ? { key: d.i.templateId, cfg: d.i.config } : undefined })), [descs]);
  const { lines, add, toast } = useCart();
  const [added, setAdded] = useAdded();
  const parts = useParts(kit); // unit prices for the cart lines come from the meshes, as on the kit page
  const ready = parts.every((p) => p.unit != null);
  const settings = useMemo(() => kitSettings(kit), [kit]);
  const addAll = () => {
    const mk = kitLines(kit, (i) => parts.find((p) => p.item === i)?.unit ?? 0, { note: settings ? settingsSummary(settings.fields, settings.defaults) : undefined });
    const why = kitBlocked(lines, mk);
    if (why) { toast(why); return; }
    mk.forEach(add);
    toast('Kit added to cart', true);
    setAdded(true);
  };
  const rows: [string, string][] = kit.variants
    ? [['Products', `${kit.variants.length}: ${kit.variants.map((v) => v.title).join(', ')}`], ['Printed parts', `${kitPartCount(kit)} in ${kit.items.length} kinds (first product)`]]
    : [['Printed parts', `${kitPartCount(kit)} in ${kit.items.length} kinds`], ['Bought separately', `${kit.boughtParts.length} items`]];
  if (kit.credit) rows.push(['Design', `by ${kit.credit.author}, ${kit.credit.licence}`]);
  return (
    <CardFrame
      href={`/shop/${kit.id}`}
      category={`${shopCatLabel(shopCat(kit.id) ?? '')} · Kit${kit.badge ? ` · ${kit.badge}` : ''}`}
      name={kit.title}
      blurb={kit.blurb}
      rows={rows}
      preview={kit.assembly ? <KitThumb kit={kit} sources={sources} /> : <div className="flex h-full flex-col justify-center gap-0.5 p-4 text-sm text-gray-700 dark:text-gray-300">{names.map((n) => <span key={n}>{n}</span>)}</div>}
      actions={<CardActions kind="kit" id={kit.id} added={added} disabled={!ready} onPrimary={() => addAll()} title={kit.variants ? `Add the ${kit.variants[0].title} kit to cart (choose the product on the kit page)` : undefined} />}
    />
  );
}

// the light grid card (ShopCards.tsx) swaps itself for this one once KitShop has loaded
export function KitCardById({ id }: { id: string }) {
  const kit = kitById(id);
  return kit && <KitCard kit={kit} />;
}

const PRODUCT_LABEL = (v: Kit) => v.id.split('/')[1]?.replace(/^./, (c) => c.toUpperCase()) ?? v.title;

export function VariantPicker({ kit, index, onPick }: { kit: Kit; index: number; onPick: (i: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Product" className="flex flex-wrap gap-2">
      {kit.variants!.map((v, i) => (
        <button key={v.id} type="button" role="radio" aria-checked={i === index} aria-label={v.title} title={v.title} onClick={() => onPick(i)}
          className={`inline-flex h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${i === index ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100' : 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'}`}>
          <Icon name="cube" />{PRODUCT_LABEL(v)}
        </button>
      ))}
    </div>
  );
}

// ---------- settings in the URL (shareable link): only values that differ from the defaults ----------

function writeQuery(q: Record<string, string>) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams(q).toString();
  window.history.replaceState(window.history.state, '', url);
}
const queryText = (fields: Field[], cfg: Cfg, defaults: Cfg) => Object.fromEntries(fields.filter((f) => cfg[f.key] !== defaults[f.key]).map((f) => [f.key, String(cfg[f.key])]));
function cfgFromQuery(fields: Field[], defaults: Cfg): Cfg {
  const q = new URLSearchParams(window.location.search), out: Cfg = { ...defaults };
  for (const f of fields) {
    const v = q.get(f.key);
    if (v !== null) out[f.key] = f.type === 'range' ? Number(v) : f.type === 'bool' ? v === 'true' : v;
  }
  return out;
}

// A kit of several products (led-decor) lets the customer pick one; everything below follows the pick.
export function KitDetail({ kit }: { kit: Kit }) {
  const [vi, setVi] = useState(0);
  useEffect(() => { // shared link: ?product=clock
    const i = kit.variants?.findIndex((v) => v.id.split('/')[1] === new URLSearchParams(window.location.search).get('product')) ?? -1;
    if (i > 0) setVi(i);
  }, [kit]);
  const active = kit.variants?.[vi] ?? kit;
  const pick = (i: number) => { setVi(i); writeQuery({ product: kit.variants![i].id.split('/')[1] }); };
  const picker = kit.variants && <VariantPicker kit={kit} index={vi} onPick={pick} />;
  return <KitDetailBody key={active.id} kit={active} top={kit} picker={picker} />;
}

function KitDetailBody({ kit: base, top, picker }: { kit: Kit; top: Kit; picker?: React.ReactNode }) {
  const { lines, add, toast } = useCart();
  const reduceMotion = useReduceMotion();
  const [added, setAdded] = useAdded();
  // settings: the kit file's config fields; every change is checked with the kit's own strict validation, then built in the worker once it settles
  const settings = useMemo(() => kitSettings(base), [base]);
  const [cfg, setCfg] = useState<Cfg>(() => settings?.defaults ?? {});
  const [problem, setProblem] = useState<string | null>(null);
  const applied = useDebounced(cfg, 250);
  const [aiOpen, setAiOpen] = useState(false);
  const [proposal, setProposal] = useState<Cfg | null>(null); // an AI settings proposal being previewed; nothing is applied until Accept
  const shown = proposal ?? applied;
  const kit = useMemo(() => settings?.build({ ...settings.defaults, ...shown }) ?? base, [settings, shown, base]);
  useEffect(() => {
    if (!settings) return;
    try { const q = cfgFromQuery(settings.fields, settings.defaults); settings.build(q); if (settings.fields.some((f) => q[f.key] !== settings.defaults[f.key])) setCfg(q); } catch { /* a bad shared link shows the defaults */ }
  }, [settings]);
  const change = (next: Cfg) => {
    if (!settings) return;
    try { settings.build(next); } catch (e) { setProblem(e instanceof Error ? e.message : 'These settings cannot be built.'); return; }
    setProblem(null);
    setCfg(next);
    writeQuery({ ...(base.id.includes('/') ? { product: base.id.split('/')[1] } : {}), ...queryText(settings.fields, next, settings.defaults) });
  };
  const changed = !!settings && settings.fields.some((f) => cfg[f.key] !== settings.defaults[f.key]);
  const pending = !proposal && applied !== cfg;
  const parts = useParts(kit);
  const ready = !pending && parts.every((p) => p.unit != null);
  const total = ready ? parts.reduce((n, p) => n + (p.total ?? 0), 0) : null;
  const addAll = (use: Cfg = cfg) => {
    const mk = kitLines(kit, (i) => parts.find((p) => p.item === i)?.unit ?? 0, { name: top.title, note: settings ? settingsSummary(settings.fields, use) : undefined });
    const why = kitBlocked(lines, mk);
    if (why) { toast(why); return; }
    mk.forEach(add);
    toast('Kit added to cart', true);
    setAdded(true);
  };
  const lastTotal = useRef<number | null>(null); // the price before a proposal, for the before -> after line
  if (!proposal && total != null) lastTotal.current = total;
  const accept = (next: Cfg) => {
    if (!settings) return;
    const why = kitBlocked(lines, kitLines(kit, (i) => parts.find((p) => p.item === i)?.unit ?? 0, { name: top.title }));
    if (why) { toast(why); return; }
    addAll(next);
    change(next);
    setProposal(null);
    toast(`Added to cart: ${customLabel(top.title)}`, true);
  };
  const shapeSource = parts.find((p) => p.shapes.length > 0)?.shapes; // template-based kit parts only; STL and kit-file parts have no editable shapes
  const toBuilder = shapeSource ? () => {
    try { sessionStorage.setItem(AI_DRAFT_KEY, JSON.stringify({ title: customLabel(top.title), notes: '', shapes: shapeSource, source: 'copy' })); } catch { return null; }
    return '/playground?mode=build&from=ai&ai=1';
  } : null;
  return (
    <div className="space-y-6">
      <BackToShop />
      <FlowStrip current="adjust" />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{shopCatLabel(shopCat(top.id) ?? '')} · Kit{top.badge ? ` · ${top.badge}` : ''}</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{top.title}{top.badge && <span className="ml-3 align-middle rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{top.badge}</span>}</h1>
        <p className="mt-2 max-w-3xl text-gray-700 dark:text-gray-300">{top.blurb}</p>
        {top.credit && <CreditLine credit={top.credit} files className="mt-2 max-w-3xl break-words" />}
      </div>
      {picker}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <FinishedBuild kit={kit} parts={parts} updating={!ready} />
        </div>
        <aside aria-label="Kit total" className="space-y-3 self-start rounded-xl border border-gray-200 p-4 lg:sticky lg:top-20 dark:border-gray-700">
          {settings && (
            <SettingsPanel bare id="kit-settings" title="Settings" fields={settings.fields} cfg={cfg} onField={(k, v) => change({ ...cfg, [k]: v })}
              changed={changed} onReset={() => change(settings.defaults)} aiOpen={aiOpen} onAi={() => setAiOpen((o) => !o)}>
              {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}
            </SettingsPanel>
          )}
          {settings && aiOpen && (
            <AiConfigPanel kind="kit" id={base.id} name={top.title} fields={settings.fields} current={{ ...settings.defaults, ...cfg }}
              priceNow={lastTotal.current != null ? money.format(lastTotal.current) : '…'} priceNew={proposal && total != null ? money.format(total) : null}
              ready={ready} onProposal={setProposal} onAccept={accept} onBuilder={toBuilder} onClose={() => { setAiOpen(false); setProposal(null); }} />
          )}
          <SpecRows rows={[['Printed parts', `${kitPartCount(kit)} pieces (${kit.items.length} different parts)`], ['Bought separately', `${kit.boughtParts.length} items`], ['Total', total != null ? `${money.format(total)}` : '…']]} />
          <div className="flex gap-3"><CardActions kind="kit" id={top.id} added={added} disabled={!ready} onPrimary={() => addAll()} secondaryHref="#kit-parts" title={top.variants ? `Add the ${kit.title} kit to cart` : undefined} /></div>
          <p className="text-xs text-gray-500 dark:text-gray-400">We review your order and send a payment link; printing starts once it is paid.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">The total adds each line as priced on its own page (each line includes {money.format(SETUP_FEE)} setup). Price is an estimate from the meshes; we confirm before payment. {settings ? 'Change the settings above before you add it.' : 'Open a part to change its settings before you add it.'}</p>
          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <BoughtList items={kit.boughtParts} title={kit.assemblyData === false ? 'Not printed — buy separately' : undefined} />
          </div>
        </aside>
      </div>
      <section aria-labelledby="kit-parts" className="space-y-3">
        <h2 id="kit-parts" className="text-lg font-semibold text-gray-900 dark:text-white">Printed parts in this kit</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((p) => {
            const t = templateById(p.item.templateId);
            const page = !p.kit; // printed parts of the kit files have no page of their own
            return (
              <li key={p.item.templateId} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="h-36 bg-[#ebe8e1] dark:bg-[#141a2b]" aria-hidden>
                  {p.mesh && <ExamplePreview shapes={p.shapes} mesh={p.mesh} reduceMotion={reduceMotion} material={p.material as 'PLA'} />}
                </div>
                <div className="space-y-1 p-3 text-sm">
                  {page ? <Link href={`/shop/${p.item.templateId}`} className="font-semibold text-gray-900 hover:underline dark:text-gray-100">{p.name}</Link> : <span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>}
                  <p className="text-gray-500 dark:text-gray-400">{p.item.qty} × {p.material}{t || (p.kit && Object.keys(p.item.config).length > 0) ? ' · kit settings' : ''}</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{p.total != null ? money.format(p.total) : '…'}</p>
                  {kit.credit && <CreditLine credit={kit.credit} className="break-words" />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div aria-hidden className="h-16 lg:hidden" />
      <div className="pp-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden dark:border-gray-700 dark:bg-gray-900/95">
        <span className="font-mono text-base font-semibold text-gray-900 dark:text-white">{total != null ? money.format(total) : '…'}</span>
        <button type="button" disabled={!ready} onClick={() => addAll()} aria-label="Add whole kit to cart" title="Add whole kit to cart" className={`${addBtn} ml-auto`}>{added ? <AddLabel added /> : <><Icon name="cart" />Add</>}</button>
      </div>
    </div>
  );
}
