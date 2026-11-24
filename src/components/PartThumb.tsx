// A tiny flat silhouette of a part's reference model (no WebGL, so a list can show many). Decorative: the row text names the part.
import { useMemo } from 'react';
import { partById } from '@/lib/parts';
import { partThumb } from '@/lib/partModels';

export default function PartThumb({ id, size = 28 }: { id: string; size?: number }) {
  const t = useMemo(() => { const p = partById(id); return p ? partThumb(p) : null; }, [id]);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#ebe8e1] dark:bg-[#141a2b]" style={{ width: size, height: size }}>
      {t && <svg viewBox={t.vb} width={size} height={size} className="fill-gray-500 stroke-gray-500 dark:fill-gray-400 dark:stroke-gray-400" strokeWidth=".4" strokeLinejoin="round"><path d={t.d} /></svg>}
    </span>
  );
}
