import { useId } from 'react';
import type { MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

// Wraps a material chip/option with a CSS-only tooltip (hover, keyboard focus, or tap-to-focus).
// Pass focusable for plain spans/divs so touch and keyboard users can reach it; buttons and inputs already are.
export default function MaterialTip({ k, children, className = '', focusable = false }: { k: MaterialKey; children: React.ReactNode; className?: string; focusable?: boolean }) {
  const id = useId();
  const m = MATERIAL_INFO[k];
  return (
    <span className={`group relative ${className}`} aria-describedby={id} tabIndex={focusable ? 0 : undefined}>
      {children}
      <span
        id={id} role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-2 w-max max-w-[16rem] space-y-0.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-gray-600"
      >
        <strong className="block font-semibold">{m.label} · {m.full}</strong>
        <span className="block">Plastic type: {m.type}</span>
        <span className="block">Best for: {m.use}</span>
        <span className="block">Strength · Flex · Heat: {m.strength} · {m.flexibility} · {m.heat}</span>
      </span>
    </span>
  );
}
