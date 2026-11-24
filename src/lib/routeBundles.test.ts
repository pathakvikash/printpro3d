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

// the static import graph of a route's entry files (type-only imports and import() calls are not followed) must never reach three,
// the CSG or the modules that build meshes
function heavyReached(entries: string[]) {
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
  for (const f of entries) walk(join(src, f));
  return { bad, seen };
}

test('/shop static import graph never reaches three, the CSG or a mesh builder', () => {
  const { bad, seen } = heavyReached(['ShopRoute', 'ShopOrder', 'ShopCards', 'ShopParts', 'MotorShelf', 'HomeShop', 'HomeKits'].map((f) => `components/${f}.tsx`));
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 8, 'the walk found the graph');
});

// the layout loads CartDrawer on every page, so it counts too
test('/cart (page, drawer, thumbnails) first load never reaches three, the CSG or a mesh builder', () => {
  const { bad, seen } = heavyReached(['app/cart/page.tsx', 'components/CartPage.tsx', 'components/CartDrawer.tsx', 'components/CartThumb.tsx']);
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 8, 'the walk found the graph');
});

// the AI panels are lazy: no AI or three code in the first load of /, /shop or /cart, and product pages and the builder load them through next/dynamic only
test('AI customise panels load only through next/dynamic', () => {
  for (const [f, mod] of [['Playground', './AiChat'], ['TemplateShop', './AiConfigPanel'], ['KitShop', './AiConfigPanel']] as const) {
    const src = readFileSync(new URL(`../components/${f}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, new RegExp(`^import[^;]*from\\s+'${mod.replace('.', '\\.')}'`, 'm'), f);
    assert.match(src, new RegExp(`import\\('${mod.replace('.', '\\.')}'\\)`), f);
  }
  const { bad } = heavyReached(['ShopRoute', 'ShopOrder', 'ShopCards', 'ShopParts', 'MotorShelf', 'HomeShop', 'HomeKits'].map((f) => `components/${f}.tsx`));
  assert.deepEqual(bad, []);
});

// Prerender (next build, static generation of /shop/[id], /shop/part/[id], /blueprint/[id]) must never run the CSG: it timed out
// the Vercel build on 2 cores. Meshes are built in a worker after mount; server code and render bodies only read cheap metadata.
test('no server page or product-page component builds a mesh while rendering', () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const builders = /\b(buildMesh|templateMesh|partMesh|partBlueprint|meshOf|specOf|kitPartMesh)\(/;
  for (const f of ['app/shop/[id]/page.tsx', 'app/shop/part/[id]/page.tsx', 'app/blueprint/[id]/page.tsx', 'app/page.tsx', 'app/shop/page.tsx', 'app/playground/page.tsx', 'components/ProductDetail.tsx', 'components/ShopItem.tsx', 'components/PartDetail.tsx', 'components/ExampleBlueprint.tsx']) {
    assert.doesNotMatch(read(f), builders, f);
  }
  const tpl = read('components/TemplateShop.tsx');
  assert.doesNotMatch(tpl, /useMemo\(\(\) => compute\(/); // the configurator's mesh comes from buildOffThread in an effect
  assert.doesNotMatch(tpl, /\btemplateMesh\b/);
  assert.match(tpl, /buildOffThread\(shapes, true\)/);
});
