'use client';

import { useEffect, useRef, useState } from 'react';
import { KIT_METAS } from '@/lib/kitMeta';
import { KitCardLight } from './ShopCards';

// the complete kits; the card swaps to the full one (assembled picture, Add / Build) once KitShop loads, which happens only when the grid nears the viewport
export default function HomeKits() {
  const box = useRef<HTMLUListElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const kits = KIT_METAS.filter((k) => k.hasAssembly).slice(0, 6);
  return (
    <ul ref={box} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {near ? kits.map((k) => <KitCardLight key={k.id} kit={k} />) : kits.map((k) => <li key={k.id} aria-hidden className="h-[34rem] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />)}
    </ul>
  );
}
