'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { exampleById } from '@/lib/examples';

// three.js loads only when the part is mounted (desktop, not reduced motion, page idle): see the effect below
const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false, loading: () => null });

const part = exampleById('pawn');

// Decorative 3D part for the hero. Nothing 3D loads on phones or for visitors who prefer reduced motion.
export default function HeroPart() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = () => setReady(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 1500);
    return () => clearTimeout(t);
  }, []);

  // the box keeps its size before the canvas arrives, so the page does not shift
  return (
    <div
      aria-hidden
      className="relative hidden aspect-square w-full max-w-md justify-self-center overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 via-slate-800/40 to-cyan-400/10 lg:block"
    >
      {ready && part && (
        <div className="absolute inset-0">
          <ExamplePreview shapes={part.shapes} reduceMotion={false} />
        </div>
      )}
    </div>
  );
}
