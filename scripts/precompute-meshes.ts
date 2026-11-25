// Build-time mesh cache: runs the same builders the browser uses (templateMesh, buildMesh, kitPartMesh) at the default config of every
// template, shop example, reference part and kit part, and writes public/models/built/<key>.bin plus manifest.json. Runs as "prebuild".
// The browser (src/lib/meshCache.ts via buildOffThread.ts) fetches a file instead of running the CSG when the key matches.
//   node scripts/precompute-meshes.ts          all items, each in its own child process (4 at a time)
//   node scripts/precompute-meshes.ts <index>  one item (what the children run)
// One process per item because ~90 CSG builds in one process crashed Node (V8 "change_in_bytes < kMaxReasonableBytes"): a crash now
// costs only that item, which is skipped and built at runtime. This script never exits non-zero for a failed item.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
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
const read = (file: string) => Promise.resolve(readFileSync(path.join(pub, file)).buffer as ArrayBuffer);

type Task = { key: string; label: string; make: () => Float32Array | null | Promise<Float32Array | null> };
const tasks: Task[] = [];
const seen = new Set<string>();
const add = (t: Task) => { if (!seen.has(t.key)) { seen.add(t.key); tasks.push(t); } };
for (const t of TEMPLATES) { const { shapes } = buildTemplate(t, normalizeCfg(t, defaultCfg(t))); add({ key: shapesKey(shapes, true), label: `template ${t.id}`, make: () => templateMesh(shapes) }); }
for (const e of EXAMPLES) add({ key: shapesKey(e.shapes, false), label: `example ${e.id}`, make: () => buildMesh(e.shapes) });
for (const p of PARTS) { const s = partShapes(p); add({ key: shapesKey(s, false), label: `part ${p.id}`, make: () => buildMesh(s) }); }
for (const kit of adaptedKits().flatMap((k) => [k, ...(k.variants ?? [])]))
  for (const it of kit.items) add({ key: kitKey(it.templateId, it.config), label: `kit ${it.templateId}`, make: () => kitPartMesh(it.templateId, it.config, read) });

if (process.argv[2] !== undefined) { // child: build one item, write its file
  const t = tasks[Number(process.argv[2])];
  const m = await t.make();
  if (!m) { console.warn(`precompute: ${t.label} did not build, the browser will build it`); process.exit(2); }
  writeFileSync(path.join(out, `${t.key}.bin`), encodeMesh(m));
  process.exit(0);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const runOne = (i: number) => new Promise<void>((resolve) => {
  const t = Date.now();
  const p = spawn(process.execPath, [...process.execArgv, import.meta.filename, String(i)], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 180_000, killSignal: 'SIGKILL' });
  p.on('error', () => resolve());
  p.on('close', (code, sig) => {
    if (code !== 0 && code !== 2) console.warn(`precompute: ${tasks[i].label} crashed or timed out (${sig ?? code}), the browser will build it`);
    if (Date.now() - t > 3000) console.log(`precompute: ${tasks[i].label} ${Date.now() - t} ms`);
    resolve();
  });
});
let next = 0;
await Promise.all(Array.from({ length: Math.max(1, Math.min(4, os.availableParallelism() - 1)) }, async () => { while (next < tasks.length) await runOne(next++); }));

const files = tasks.filter((t) => existsSync(path.join(out, `${t.key}.bin`)));
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(files.map((t) => t.key).sort()));
const bytes = readdirSync(out).reduce((n, f) => n + statSync(path.join(out, f)).size, 0);
console.log(`precompute: ${files.length}/${tasks.length} meshes, ${(bytes / 1048576).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
