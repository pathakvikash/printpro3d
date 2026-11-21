'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// three.js loads only after the page is idle, and not for visitors who prefer reduced motion
const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false, loading: () => null });

// Animated glass torus knot + particles behind the hero text (all screen sizes).
export default function HeroPart() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = () => setReady(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-1000 lg:opacity-100">
      {ready && <HeroScene />}
    </div>
  );
}
