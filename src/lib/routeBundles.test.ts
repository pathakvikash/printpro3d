// RoutePages is a 'use client' module shared by /build, /ai and /draw: a client module is shipped whole, so one static
// import of a heavy component (ShopOrder pulls three + three-bvh-csg) lands in every one of those routes' first load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('RoutePages only statically imports next/dynamic and next/navigation', () => {
  const src = readFileSync(new URL('../components/RoutePages.tsx', import.meta.url), 'utf8');
  const froms = [...src.matchAll(/^import[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(froms.sort(), ['next/dynamic', 'next/navigation']);
});

test('UploadForm (/quote) and ModelWithBlueprint load ModelViewer, and three with it, only through next/dynamic', () => {
  for (const f of ['UploadForm', 'ModelWithBlueprint']) {
    const src = readFileSync(new URL(`../components/${f}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /^import[^;]*from\s+'\.\/ModelViewer'/m);
  }
  const src = readFileSync(new URL('../components/ModelWithBlueprint.tsx', import.meta.url), 'utf8');
  assert.match(src, /dynamic\(\(\) => import\('\.\/ModelViewer'\)/);
});

test('ModelPlayground (/playground) imports nothing that statically pulls three', () => {
  const src = readFileSync(new URL('../components/ModelPlayground.tsx', import.meta.url), 'utf8');
  const froms = [...src.matchAll(/^import[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  for (const heavy of ['three', '@react-three/fiber', '@react-three/drei', './PrintMaterial', './ModelViewer', '@/lib/shopProducts', '@/lib/playground', '@/lib/buildOffThread']) {
    assert.ok(!froms.includes(heavy), heavy);
  }
});

// /shop's first load: the static import graph of the page (type-only imports and import() calls are not followed) must never reach
// three, the CSG or the modules that build meshes. The cards load KitShop / TemplateShop / ExamplePreview after the page shows.
test('/shop static import graph never reaches three, the CSG or a mesh builder', () => {
  const src = fileURLToPath(new URL('..', import.meta.url));
  const heavyPkg = /^(three($|\/)|three-bvh-csg|three-stdlib|@react-three\/)/;
  const heavyFile = /^(lib\/(templates|playground|kits|shopProducts|partModels|assemblyBlueprint)\.ts|lib\/kits\/|components\/(PrintMaterial|KitShop|TemplateShop|ExamplePreview|ModelViewer|WebGLCanvas)\.tsx$)/;
  const seen = new Set<string>();
  const bad: string[] = [];
  const walk = (file: string) => {
    const rel = relative(src, file);
    if (seen.has(rel)) return;
    seen.add(rel);
    if (heavyFile.test(rel)) { bad.push(rel); return; }
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm)) {
      const spec = m[1] ?? m[2];
      if (heavyPkg.test(spec)) { bad.push(`${spec} (from ${rel})`); continue; }
      const base = spec.startsWith('@/') ? join(src, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(file), spec) : null;
      const hit = base && ['', '.ts', '.tsx', '/index.ts'].map((e) => base + e).find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  for (const f of ['ShopRoute', 'ShopOrder', 'ShopCards', 'ShopParts', 'MotorShelf', 'HomeShop']) walk(join(src, 'components', `${f}.tsx`));
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 8, 'the walk found the graph');
});
