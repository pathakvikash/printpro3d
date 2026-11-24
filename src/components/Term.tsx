'use client';
// Jargon with a plain-language tooltip. A button so it works on tap and keyboard; Esc or an outside tap closes it.
import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY, type TermKey } from '@/lib/glossary';

export default function Term({ k, children }: { k: TermKey; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
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
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {children}
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full z-50 mt-1 block w-64 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-2 text-left text-xs font-normal normal-case leading-snug text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {GLOSSARY[k]}
        </span>
      )}
    </span>
  );
}
