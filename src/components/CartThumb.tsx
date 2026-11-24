'use client';
// Small flat picture of a cart line's part. The silhouette is built after the page shows (lib/cartThumb.ts pulls the mesh builders),
// so neither /cart nor the drawer carries three in its first load. Uploads and designs show an icon tile.
import { useEffect, useState } from 'react';
import type { CartLine } from '@/lib/cart';
import Icon, { type IconName } from './Icon';

const FALLBACK: Record<CartLine['kind'], IconName> = { shop: 'tag', tpl: 'wrench', kit: 'cube', model: 'upload', design: 'edit' };

export default function CartThumb({ line, size = 64 }: { line: CartLine; size?: number }) {
  const [t, setT] = useState<{ d: string; vb: string } | null>(null);
  useEffect(() => {
    let on = true;
    if (line.kind !== 'model' && line.kind !== 'design') void import('@/lib/cartThumb').then((m) => m.lineThumb(line)).then((r) => on && setT(r));
    return () => { on = false; };
  }, [line]);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ebe8e1] ring-1 ring-black/5 dark:bg-[#141a2b] dark:ring-white/10" style={{ width: size, height: size }}>
      {t ? (
        <svg viewBox={t.vb} width={size} height={size} className="fill-gray-500 stroke-gray-500 dark:fill-gray-400 dark:stroke-gray-400" strokeWidth=".4" strokeLinejoin="round"><path d={t.d} /></svg>
      ) : (
        <span className="text-gray-400 dark:text-gray-500"><Icon name={FALLBACK[line.kind]} className="h-1/2 w-1/2" /></span>
      )}
    </span>
  );
}
