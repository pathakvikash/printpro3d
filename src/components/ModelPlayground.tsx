'use client';
// The /playground page: look at a sample or your own STL/OBJ with the shared viewer (ModelViewer) and the shared blueprint
// (blueprint() + BlueprintSheet), then hand the same file to /quote. Nothing here loads or measures a model by itself.
// (The shape builder is Playground.tsx; this one only views.)
import Icon from './Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MaterialCards from './MaterialCards';
import { LIGHTS, type LightKey } from '@/lib/lights';
import { blueprint, bounds } from '@/lib/blueprint';
import { SHOP_CATEGORIES, shopCat, shopVisible } from '@/lib/catalog';
import type { TemplateDef } from '@/lib/templateDefs';
import type { Kit } from '@/lib/kits';
import { MATERIALS, meshStats, type MaterialKey } from '@/lib/quote';
import { setPendingFile } from '@/lib/pendingFile';
import { ALLOWED_EXTS, extOf, fileProblem } from '@/lib/uploadRules';

const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false, loading: () => <div role="status" aria-label="Loading the 3D viewer" className="h-[340px] animate-pulse rounded-xl bg-gray-200 sm:h-[460px] dark:bg-gray-800" /> });
const AssemblyDemo = dynamic(() => import('./assembly/AssemblyDemo'), { ssr: false, loading: () => <div role="status" aria-label="Loading the assembly demo" className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" /> });
const BlueprintSheet = dynamic(() => import('./BlueprintSheet'), { ssr: false });
const KitInspector = dynamic(() => import('./assembly/KitInspector'), { ssr: false, loading: () => <div role="status" aria-label="Loading the kit" className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" /> });
type Extra = { tpls: TemplateDef[]; kits: Kit[] }; // templates and kits are plain data: loaded with the samples, after the page shows
type Lib = typeof import('@/lib/shopProducts'); // pulls three + the CSG: loaded after the page shows, not in its first load

type ItemKind = 'sample' | 'tpl' | 'kit';
type Source = { kind: ItemKind; id: string } | { kind: 'file'; file: File; url: string | null };
type Mode = 'both' | 'model' | 'blueprint';
const MODE_HINT: Record<string, string> = { model: '3D view', both: 'Side by side', blueprint: 'Blueprint view' };
const MODES: [Mode, string][] = [['model', '3D'], ['both', 'Split'], ['blueprint', 'Blueprint']];
const KEYS = Object.keys(MATERIALS) as MaterialKey[];
const mm = (n: number) => n.toFixed(1);

const btn = 'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:border-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const chip = (on: boolean) => `min-h-10 max-w-full truncate rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'}`;

export default function ModelPlayground() {
  const router = useRouter();
  const [lib, setLib] = useState<Lib | null>(null);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loaded, setLoaded] = useState<Float32Array | null>(null); // the soup the viewer parsed from an uploaded file
  const [material, setMaterial] = useState<MaterialKey>('PLA');
  const [mode, setMode] = useState<Mode>('model');
  const [light, setLight] = useState<LightKey>('studio');
  const [dims, setDims] = useState(true);
  const [spin, setSpin] = useState(false);
  const [demo, setDemo] = useState(false);
  const [resetKey, setReset] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { void import('@/lib/shopProducts').then(setLib); }, []);
  useEffect(() => { void Promise.all([import('@/lib/templateDefs'), import('@/lib/kits')]).then(([t, k]) => setExtra({ tpls: shopVisible(t.TEMPLATES), kits: shopVisible(k.KITS) }), () => setExtra({ tpls: [], kits: [] })); }, []);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const products = lib?.PRODUCTS ?? [];
  const current = products[0] ? { kind: 'sample' as const, id: products[0].item.id } : null;
  const active: Source | null = source ?? current;
  const product = active?.kind === 'sample' ? lib?.productById(active.id) : undefined;
  const tpl = active?.kind === 'tpl' ? extra?.tpls.find((t) => t.id === active.id) : undefined;
  const kit = active?.kind === 'kit' ? extra?.kits.find((k) => k.id === active.id) : undefined;
  // a template at its default settings, built in the worker like the samples
  const [tplBuilt, setTplBuilt] = useState<{ id: string; m: Float32Array | null } | null>(null);
  useEffect(() => {
    if (!tpl) return;
    let on = true;
    Promise.all([import('@/lib/templates'), import('@/lib/templateDefs'), import('@/lib/buildOffThread')])
      .then(([t, d, b]) => b.buildOffThread(t.buildTemplate(tpl, d.normalizeCfg(tpl, d.defaultCfg(tpl))).shapes, true))
      .then((m) => on && setTplBuilt({ id: tpl.id, m }), () => on && setTplBuilt({ id: tpl.id, m: null }));
    return () => { on = false; };
  }, [tpl]);
  const tplMesh = tpl && tplBuilt?.id === tpl.id ? tplBuilt.m : null;
  // sample meshes are built in the worker: the CSG in render was a ~1.4 s main-thread task on a phone
  const [built, setBuilt] = useState<{ id: string; m: Float32Array | null } | null>(null);
  const cached = product && lib ? lib.cachedMesh(product) : undefined;
  useEffect(() => {
    if (!product || !lib || cached !== undefined) return;
    let on = true;
    import('@/lib/buildOffThread').then((b) => b.buildOffThread(product.ex.shapes)).then((m) => { lib.keepMesh(product, m); if (on) setBuilt({ id: product.item.id, m }); }, () => on && setBuilt({ id: product.item.id, m: null }));
    return () => { on = false; };
  }, [product, lib, cached]);
  const mesh = cached ?? (built && built.id === product?.item.id ? built.m : null);
  const file = active?.kind === 'file' ? active : null;
  const soup = file ? loaded : tpl ? tplMesh : mesh;
  const shown = soup && soup.length >= 9 ? soup : null;
  const itemId = product?.item.id ?? tpl?.id;
  const name = file ? file.file.name : product?.item.name ?? tpl?.name ?? kit?.title ?? 'Sample model';
  const sheet = useMemo(() => (shown ? blueprint(shown, { name, material }) : null), [shown, name, material]);
  const size = useMemo(() => (shown ? bounds(shown).size : null), [shown]);
  const stats = useMemo(() => (shown ? meshStats(shown) : null), [shown]);
  const stage = useMemo(() => ({ pan: true, light, dims, autoRotate: spin, resetKey }), [light, dims, spin, resetKey]);

  const pick = (s: Source) => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setLoaded(null);
    setNote(null);
    setSource(s);
  };

  const take = (f?: File) => {
    if (!f) return;
    const err = fileProblem(f.name, f.size);
    if (err) return setNote(err);
    const ext = extOf(f.name);
    // the viewer picks its loader from the url's extension; the fragment gives a blob url one without changing what is fetched
    const url = ext === '.stl' || ext === '.obj' ? `${URL.createObjectURL(f)}#model${ext}` : null;
    pick({ kind: 'file', file: f, url });
    urlRef.current = url ? url.split('#')[0] : null;
    if (!url) setNote(`${ext.slice(1).toUpperCase()} files cannot be previewed here, but you can still send it to Get a quote.`);
  };

  const send = useCallback(async () => {
    let f: File | null = null;
    if (file) f = file.file;
    else if (soup && itemId) {
      const { toStl } = await import('@/lib/playground');
      f = new File([toStl(soup) as BlobPart], `${itemId}.stl`, { type: 'model/stl' });
    }
    if (!f) return setNote('Pick a model first.');
    const err = fileProblem(f.name, f.size);
    if (err) return setNote(err);
    setPendingFile(f); // the same hand-off the home page uses: /quote uploads it and shows the price
    router.push('/quote');
  }, [file, soup, itemId, router]);

  const group = (cat: string): { kind: ItemKind; id: string; name: string }[] => [
    ...products.filter((p) => shopCat(p.item.id) === cat).map((p) => ({ kind: 'sample' as const, id: p.item.id, name: p.item.name })),
    ...(extra?.tpls ?? []).filter((t) => shopCat(t.id) === cat).map((t) => ({ kind: 'tpl' as const, id: t.id, name: t.name })),
    ...(extra?.kits ?? []).filter((k) => shopCat(k.id) === cat).map((k) => ({ kind: 'kit' as const, id: k.id, name: `${k.title} · Kit` })),
  ];
  // Modify this: catalogue samples open in the builder; templates and kits are configured on their shop page
  const modifyHref = product ? `/playground?mode=build&example=${product.item.exampleId}` : tpl || kit ? `/shop/${tpl?.id ?? kit?.id}` : null;
  const sideBySide = mode === 'both';
  const loading = !lib; // samples come with lib; templates and kits join the list when extra arrives

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
      className={`space-y-4 ${over ? 'rounded-xl ring-2 ring-indigo-500' : ''}`}
    >
      <section aria-label="Choose a model" className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <label className="sr-only" htmlFor="pg-model">Model</label>
        <select
          id="pg-model"
          disabled={loading}
          value={loading ? '' : active?.kind === 'file' ? 'file' : active ? `${active.kind}:${active.id}` : ''}
          onChange={(e) => {
            if (e.target.value === 'file') return;
            const [kind, ...rest] = e.target.value.split(':');
            pick({ kind: kind as ItemKind, id: rest.join(':') });
          }}
          className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:max-w-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          {loading ? <option value="">Loading models…</option> : (<>
            {file && <option value="file">{file.file.name}</option>}
            {SHOP_CATEGORIES.map((c) => {
              const list = group(c.id);
              return list.length ? (
                <optgroup key={c.id} label={c.label}>
                  {list.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name}</option>)}
                </optgroup>
              ) : null;
            })}
          </>)}
        </select>
        {kit && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Kit</span>}
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {modifyHref && <Link href={modifyHref} className={`${btn} flex-1 border-indigo-600 bg-indigo-600 text-white hover:border-indigo-700 hover:bg-indigo-700 dark:border-indigo-600 dark:bg-indigo-600 dark:text-white sm:flex-none`}><Icon name="wrench" className="h-4 w-4" />Modify</Link>}
          <input ref={input} type="file" accept={ALLOWED_EXTS.join(',')} className="sr-only" aria-label="Choose a 3D file" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" title="Drop an STL or OBJ anywhere here" className={`${btn} flex-1 sm:flex-none`} onClick={() => input.current?.click()}><Icon name="upload" className="h-4 w-4" />Upload</button>
          <Link href="/playground?mode=build" title="Start from scratch" className={`${btn} flex-1 sm:flex-none`}><Icon name="plus" className="h-4 w-4" />New</Link>
        </div>
      </section>
      <h2 className="sr-only">{name}</h2>
      <p className="-mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">Or drop an STL or OBJ anywhere on this page. It stays in your browser until you send it to Get a quote.</p>
      {note && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}

      {kit ? <KitInspector key={kit.id} kit={kit} /> : (<>
      <div className={`grid gap-4 ${sideBySide ? '' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'}`}>
        <section aria-label="Viewer" className="min-w-0 space-y-4">
          <div className={sideBySide ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]' : 'space-y-4'}>
            <div className={mode === 'blueprint' ? 'hidden' : 'space-y-2'}>
              <div className="h-[340px] sm:h-[460px]">
                {file?.url ? (
                  <ModelViewer key={file.url} url={file.url} material={material} onPositions={setLoaded} className="h-full" stage={stage} />
                ) : shown && !file ? (
                  <ModelViewer key={itemId} positions={shown} material={material} className="h-full" stage={stage} />
                ) : (
                  <div role="status" className={`flex h-full items-center justify-center rounded-xl px-6 text-center text-sm text-gray-600 dark:text-gray-300 ${file ? 'bg-gray-100 dark:bg-gray-800' : 'pp-skeleton'}`}>{file ? 'No preview for this file type.' : 'Loading the model…'}</div>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Drag to rotate. Scroll or pinch to zoom. Right-drag or two fingers to pan. Layer lines assume 0.2 mm layers.</p>
            </div>
            {mode !== 'model' && (
              <div aria-label="Blueprint">
                {sheet ? <BlueprintSheet svg={sheet} filename={`blueprint-${name.replace(/\W+/g, '-').toLowerCase()}`} /> : <div role="status" aria-label="Drawing the blueprint" className="h-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />}
              </div>
            )}
          </div>

          {size && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Overall size: {mm(size.x)} × {mm(size.y)} × {mm(size.z)} mm
              {stats && <span className="font-normal text-gray-600 dark:text-gray-400"> · {stats.volumeCm3.toFixed(1)} cm³ · {shown ? Math.floor(shown.length / 9).toLocaleString() : 0} triangles</span>}
            </p>
          )}
        </section>

        <aside aria-label="View settings" className="rounded-xl border border-gray-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">View settings</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 [&>*]:py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                {MODES.map(([m, label]) => (
                  <button key={m} type="button" aria-pressed={mode === m} aria-label={MODE_HINT[m]} title={MODE_HINT[m]} onClick={() => setMode(m)} className={`min-h-10 whitespace-nowrap border-r border-gray-300 px-3 py-1.5 text-sm font-medium last:border-r-0 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-gray-600 ${mode === m ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100'}`}>{label}</button>
                ))}
              </div>
              <button type="button" aria-label="Reset camera" title="Reset camera" className={`${btn} w-10 px-0`} onClick={() => setReset((k) => k + 1)}><Icon name="reset" className="h-4 w-4" /></button>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={dims} onChange={(e) => setDims(e.target.checked)} />Dimensions</label>
            <label className="flex min-h-10 items-center gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} />Auto-rotate</label>
            <div role="group" aria-label="Lighting" className="space-y-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Lighting</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LIGHTS) as LightKey[]).map((k) => <button key={k} type="button" aria-pressed={light === k} className={chip(light === k)} onClick={() => setLight(k)}>{LIGHTS[k]}</button>)}
              </div>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => void send()} disabled={!file && !soup} aria-label="Send to Get a quote" title="Send to Get a quote" className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"><Icon name="arrow" className="h-4 w-4" />Send to Get a quote</button>
              <p className="text-xs text-gray-600 dark:text-gray-300">Sends {file ? file.file.name : itemId ? `${itemId}.stl` : 'the model'} exactly as shown, at its real size. Get a quote re-measures it and prices it.</p>
            </div>
          </div>
        </aside>
      </div>

      <section aria-label="Select material" className="space-y-3 pt-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select material</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Pick a material to see its finish on the model above{stats ? " and this part's weight in it" : ''}.</p>
        <MaterialCards selected={material} onSelect={setMaterial} partVolumeCm3={stats?.volumeCm3} />
        <p className="text-xs text-gray-600 dark:text-gray-400">{KEYS.length} materials, same prices and weights as Get a quote.</p>
      </section>

      <section aria-label="Assembly demo" className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assembly demo</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">A sample drone kit: printed frame plate and camera mount, with the motors and battery you buy shown as grey placeholders. Try Exploded, Spin and Unboxing.</p>
        {demo ? <AssemblyDemo /> : <button type="button" aria-label="Open the assembly demo" title="Open the assembly demo" className={btn} onClick={() => setDemo(true)}><Icon name="play" className="h-4 w-4" />Demo</button>}
      </section>
      </>)}
    </div>
  );
}
