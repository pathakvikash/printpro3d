// RoutePages is a 'use client' module shared by /build, /ai and /draw: a client module is shipped whole, so one static
// import of a heavy component (ShopOrder pulls three + three-bvh-csg) lands in every one of those routes' first load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
