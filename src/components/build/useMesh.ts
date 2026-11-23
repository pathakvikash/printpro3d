'use client';
// The built solid of a blueprint's shapes, made in the browser (worker). `shapes` must be a stable reference (memoise it).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildOffThread } from '@/lib/buildOffThread';
import type { Shape } from '@/lib/playground';
import { meshStats, type MeshStats } from '@/lib/quote';

export function useMesh(shapes: Shape[] | null) {
  const [got, setGot] = useState<{ of: Shape[]; tris: Float32Array | null } | null>(null);
  useEffect(() => {
    if (!shapes) return;
    let live = true;
    buildOffThread(shapes).then((tris) => live && setGot({ of: shapes, tris }), () => live && setGot({ of: shapes, tris: null }));
    return () => { live = false; };
  }, [shapes]);
  const ready = !!shapes && got?.of === shapes;
  const tris = ready ? got!.tris : null;
  const stats = useMemo<MeshStats | null>(() => (tris ? meshStats(tris) : null), [tris]);
  return { tris, stats, ready };
}

const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
