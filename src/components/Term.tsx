'use client';
// Jargon with a plain-language tooltip. A button so it works on tap and keyboard; Esc or an outside tap closes it.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { GLOSSARY, type TermKey } from '@/lib/glossary';

export default function Term({ k, children }: { k: TermKey; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  // Keep the tooltip inside the viewport: a term near the right edge on a phone would otherwise push the page sideways.
  useLayoutEffect(() => {
    if (!open || !tip.current) return setShift(0);
    const r = tip.current.getBoundingClientRect();
    setShift(Math.min(0, document.documentElement.clientWidth - 8 - (r.right - shift)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', esc);
    document.addEventListener('pointerdown', away);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {children}
      </button>
      {open && (
        <span ref={tip} id={id} role="tooltip" style={{ left: shift }} className="absolute left-0 top-full z-50 mt-1 block w-64 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white p-2 text-left text-xs font-normal normal-case leading-snug text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {GLOSSARY[k]}
        </span>
      )}
    </span>
  );
}
