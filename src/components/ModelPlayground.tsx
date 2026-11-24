'use client';
// The /playground page: look at a sample or your own STL/OBJ with the shared viewer (ModelViewer) and the shared blueprint
// (blueprint() + BlueprintSheet), then hand the same file to /quote. Nothing here loads or measures a model by itself.
// (The shape builder is Playground.tsx; this one only views.)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import MaterialCards from './MaterialCards';
import { LIGHTS, type LightKey } from '@/lib/lights';
import { blueprint, bounds } from '@/lib/blueprint';
import { SHOP_CATEGORIES, shopCat } from '@/lib/catalog';
import { MATERIALS, meshStats, type MaterialKey } from '@/lib/quote';
import { setPendingFile } from '@/lib/pendingFile';
import { ALLOWED_EXTS, extOf, fileProblem } from '@/lib/uploadRules';

const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false, loading: () => <div role="status" aria-label="Loading the 3D viewer" className="h-[340px] animate-pulse rounded-xl bg-gray-200 sm:h-[460px] dark:bg-gray-800" /> });
const BlueprintSheet = dynamic(() => import('./BlueprintSheet'), { ssr: false });
type Lib = typeof import('@/lib/shopProducts'); // pulls three + the CSG: loaded after the page shows, not in its first load

type Source = { kind: 'sample'; id: string } | { kind: 'file'; file: File; url: string | null };
type Mode = 'both' | 'model' | 'blueprint';
const MODES: [Mode, string][] = [['model', '3D'], ['both', 'Side by side'], ['blueprint', 'Blueprint']];
const KEYS = Object.keys(MATERIALS) as MaterialKey[];
const mm = (n: number) => n.toFixed(1);

const btn = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:border-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'}`;

export default function ModelPlayground() {
  const router = useRouter();
  const [lib, setLib] = useState<Lib | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loaded, setLoaded] = useState<Float32Array | null>(null); // the soup the viewer parsed from an uploaded file
  const [material, setMaterial] = useState<MaterialKey>('PLA');
  const [mode, setMode] = useState<Mode>('both');
  const [light, setLight] = useState<LightKey>('studio');
  const [dims, setDims] = useState(true);
  const [spin, setSpin] = useState(false);
  const [resetKey, setReset] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { void import('@/lib/shopProducts').then(setLib); }, []);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const products = lib?.PRODUCTS ?? [];
  const current = source?.kind === 'sample' ? source : products[0] ? { kind: 'sample' as const, id: products[0].item.id } : null;
  const active: Source | null = source ?? current;
  const product = active?.kind === 'sample' ? lib?.productById(active.id) : undefined;
  const mesh = useMemo(() => (product && lib ? lib.meshOf(product) : null), [product, lib]);
  const file = active?.kind === 'file' ? active : null;
  const soup = file ? loaded : mesh;
  const shown = soup && soup.length >= 9 ? soup : null;
  const name = file ? file.file.name : product?.item.name ?? 'Sample model';
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
    else if (mesh && product) {
      const { toStl } = await import('@/lib/playground');
      f = new File([toStl(mesh) as BlobPart], `${product.item.id}.stl`, { type: 'model/stl' });
    }
    if (!f) return setNote('Pick a model first.');
    const err = fileProblem(f.name, f.size);
    if (err) return setNote(err);
    setPendingFile(f); // the same hand-off the home page uses: /quote uploads it and shows the price
    router.push('/quote');
  }, [file, mesh, product, router]);

  const group = (cat: string) => products.filter((p) => shopCat(p.item.id) === cat);
  const sideBySide = mode === 'both';

  return (
    <div className="space-y-8">
      <section aria-label="Choose a model" className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
          className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${over ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900'}`}
        >
          <input ref={input} type="file" accept={ALLOWED_EXTS.join(',')} className="sr-only" aria-label="Choose a 3D file" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600`} onClick={() => input.current?.click()}>Upload your own</button>
          <p className="text-sm text-gray-600 dark:text-gray-300">Drop an STL or OBJ here to view it. It stays in your browser until you send it to Get a quote.</p>
        </div>
        {SHOP_CATEGORIES.map((c) => {
          const list = group(c.id);
          return list.length ? (
            <div key={c.id}>
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{c.label}</h2>
              <ul className="flex flex-wrap gap-2">
                {list.map((p) => (
                  <li key={p.item.id}>
                    <button type="button" aria-pressed={active?.kind === 'sample' && active.id === p.item.id} className={chip(active?.kind === 'sample' && active.id === p.item.id)} onClick={() => pick({ kind: 'sample', id: p.item.id })}>{p.item.name}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null;
        })}
        {!lib && <div role="status" aria-label="Loading sample models" className="h-8 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />}
      </section>

      <section aria-label="Viewer" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
            {MODES.map(([m, label]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`border-r border-gray-300 px-3 py-1.5 text-sm font-medium last:border-r-0 dark:border-gray-600 ${mode === m ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100'}`}>{label}</button>
            ))}
          </div>
          <button type="button" className={btn} onClick={() => setReset((k) => k + 1)}>Reset camera</button>
          <label className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={dims} onChange={(e) => setDims(e.target.checked)} />Dimensions</label>
          <label className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} />Auto-rotate</label>
        </div>

        <div className={sideBySide ? 'grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]' : 'space-y-4'}>
          <div className={mode === 'blueprint' ? 'hidden' : 'space-y-2'}>
            <div className="h-[340px] sm:h-[460px]">
              {file?.url ? (
                <ModelViewer key={file.url} url={file.url} material={material} onPositions={setLoaded} className="h-full" stage={stage} />
              ) : shown && !file ? (
                <ModelViewer key={product?.item.id} positions={shown} material={material} className="h-full" stage={stage} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl bg-gray-100 px-6 text-center text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">{file ? 'No preview for this file type.' : 'Loading the model…'}</div>
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

        <div role="group" aria-label="Lighting" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Lighting</span>
          {(Object.keys(LIGHTS) as LightKey[]).map((k) => <button key={k} type="button" aria-pressed={light === k} className={chip(light === k)} onClick={() => setLight(k)}>{LIGHTS[k]}</button>)}
        </div>
      </section>

      <section aria-label="Material preview" className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Material preview</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Pick a material to see its finish on the model above{stats ? " and this part's weight in it" : ''}.</p>
        <MaterialCards selected={material} onSelect={setMaterial} partVolumeCm3={stats?.volumeCm3} />
        <p className="text-xs text-gray-600 dark:text-gray-400">{KEYS.length} materials, same prices and weights as Get a quote.</p>
      </section>

      <section aria-label="Send to Get a quote" className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <button type="button" onClick={() => void send()} disabled={!file && !mesh} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">Send to Get a quote</button>
        <p className="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">Sends {file ? file.file.name : product ? `${product.item.id}.stl` : 'the model'} exactly as shown, at its real size. Get a quote re-measures it and prices it.</p>
        {note && <p role="status" className="w-full text-sm text-amber-700 dark:text-amber-300">{note}</p>}
      </section>
    </div>
  );
}
