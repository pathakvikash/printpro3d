// Build-time mesh cache: runs the same builders the browser uses (templateMesh, buildMesh, kitPartMesh) at the default config of every
// template, shop example, reference part and kit part, and writes public/models/built/<key>.bin plus manifest.json. Runs as "prebuild".
// The browser (src/lib/meshCache.ts via buildOffThread.ts) fetches a file instead of running the CSG when the key matches.
//   node scripts/precompute-meshes.ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { EXAMPLES } from '../src/lib/examples.ts';
import { adaptedKits, kitPartMesh } from '../src/lib/kits/adapt.ts';
import { encodeMesh, kitKey, shapesKey } from '../src/lib/meshCache.ts';
import { buildMesh } from '../src/lib/playground.ts';
import { PARTS } from '../src/lib/parts.ts';
import { partShapes } from '../src/lib/partModels.ts';
import { TEMPLATES, defaultCfg, normalizeCfg } from '../src/lib/templateDefs.ts';
import { buildTemplate, templateMesh } from '../src/lib/templates.ts';

const pub = path.resolve(import.meta.dirname, '../public');
const out = path.join(pub, 'models/built');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const keys = new Set<string>();
let bytes = 0;
const t0 = Date.now();
const put = (key: string, label: string, make: () => Float32Array | null | Promise<Float32Array | null>) => {
  if (keys.has(key)) return;
  keys.add(key); // claimed first, dropped below when it fails
  return (async () => {
    const t = Date.now();
    let m: Float32Array | null = null;
    try { m = await make(); } catch { m = null; }
    if (!m) { keys.delete(key); console.warn(`precompute: ${label} did not build, the browser will build it`); return; }
    writeFileSync(path.join(out, `${key}.bin`), encodeMesh(m));
    bytes += m.byteLength;
    if (Date.now() - t > 3000) console.log(`precompute: ${label} ${Date.now() - t} ms`);
  })();
};

for (const t of TEMPLATES) {
  const { shapes } = buildTemplate(t, normalizeCfg(t, defaultCfg(t)));
  await put(shapesKey(shapes, true), `template ${t.id}`, () => templateMesh(shapes));
}
for (const e of EXAMPLES) await put(shapesKey(e.shapes, false), `example ${e.id}`, () => buildMesh(e.shapes));
for (const p of PARTS) { const s = partShapes(p); await put(shapesKey(s, false), `part ${p.id}`, () => buildMesh(s)); }
const read = (file: string) => Promise.resolve(readFileSync(path.join(pub, file)).buffer as ArrayBuffer);
for (const kit of adaptedKits().flatMap((k) => [k, ...(k.variants ?? [])]))
  for (const it of kit.items) {
    await put(kitKey(it.templateId, it.config), `kit ${it.templateId}`, () => kitPartMesh(it.templateId, it.config, read));
  }

writeFileSync(path.join(out, 'manifest.json'), JSON.stringify([...keys].sort()));
console.log(`precompute: ${keys.size} meshes, ${(bytes / 1048576).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
