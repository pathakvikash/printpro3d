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
