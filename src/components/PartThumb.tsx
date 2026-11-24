// A tiny flat silhouette of a part's reference model (no WebGL, so a list can show many). Decorative: the row text names the part.
import { useEffect, useState } from 'react';
import { partById } from '@/lib/parts';

export default function PartThumb({ id, size = 28 }: { id: string; size?: number }) {
  // partModels pulls three and the CSG (through playground.ts): loaded after the page shows, so /shop's first load stays light
  const [t, setT] = useState<{ d: string; vb: string } | null>(null);
  useEffect(() => {
    let on = true;
    const p = partById(id);
    if (p) void import('@/lib/partModels').then((m) => on && setT(m.partThumb(p)));
    return () => { on = false; };
  }, [id]);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#ebe8e1] dark:bg-[#141a2b]" style={{ width: size, height: size }}>
      {t && <svg viewBox={t.vb} width={size} height={size} className="fill-gray-500 stroke-gray-500 dark:fill-gray-400 dark:stroke-gray-400" strokeWidth=".4" strokeLinejoin="round"><path d={t.d} /></svg>}
    </span>
  );
}
