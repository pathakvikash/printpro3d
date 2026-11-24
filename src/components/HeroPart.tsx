'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// three.js loads only after the page is idle, and not for visitors who prefer reduced motion
const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false, loading: () => null });

// Slowly turning torus knot beside the hero text.
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
      {/* static fallback: always there, so the right half is never blank (no WebGL, reduced motion, before idle) */}
      <svg viewBox="0 0 200 200" className="absolute right-[8%] top-1/2 hidden h-[26rem] w-[26rem] -translate-y-1/2 text-indigo-600/40 dark:text-indigo-300/40 lg:block" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 100h200M100 0v200" strokeDasharray="6 3 1 3" strokeWidth=".5" />
        <rect x="35" y="35" width="130" height="130" rx="10" strokeWidth="2" />
        <circle cx="100" cy="100" r="22" strokeWidth="2" />
        {[[50, 50], [150, 50], [50, 150], [150, 150]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" strokeWidth="2" />)}
        <path d="M35 182h130M35 177v10M165 177v10" strokeWidth=".75" />
        <text x="100" y="196" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">Drone plate, one of our shop parts</text>
      </svg>
      {ready && <HeroScene />}
    </div>
  );
}
