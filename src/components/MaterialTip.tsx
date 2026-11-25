'use client';
import { useId, useState } from 'react';
import type { MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

// Wraps a material chip/option with a CSS-only tooltip (hover, keyboard focus, or tap-to-focus).
// Pass focusable for plain spans/divs so touch and keyboard users can reach it; buttons and inputs already are.
export default function MaterialTip({ k, children, className = '', focusable = false }: { k: MaterialKey; children: React.ReactNode; className?: string; focusable?: boolean }) {
  const id = useId();
  const [right, setRight] = useState(false); // align to the chip's right edge when a left-aligned tip would pass the viewport edge
  const place = (e: React.SyntheticEvent<HTMLElement>) => setRight(e.currentTarget.getBoundingClientRect().left + 256 > window.innerWidth - 8);
  const m = MATERIAL_INFO[k];
  return (
    <span className={`group relative ${className}`} aria-describedby={id} tabIndex={focusable ? 0 : undefined} onMouseEnter={place} onFocus={place}>
      {children}
      <span
        id={id} role="tooltip"
        className={`pointer-events-none absolute bottom-full ${right ? 'right-0' : 'left-0'} z-50 mb-2 hidden w-max max-w-[min(16rem,calc(100vw-1rem))] space-y-0.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white shadow-lg group-focus-within:block group-hover:block dark:border-gray-600`}
      >
        <strong className="block font-semibold">{m.label} · {m.full}</strong>
        <span className="block">Plastic type: {m.type}</span>
        <span className="block">Best for: {m.use}</span>
        <span className="block">Strength · Flex · Heat: {m.strength} · {m.flexibility} · {m.heat}</span>
      </span>
    </span>
  );
}
