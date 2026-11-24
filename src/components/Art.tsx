// Small decorative SVG illustrations for text-only sections. All aria-hidden; colours via currentColor / indigo tokens so light and dark both work.
import type { ReactNode } from 'react';

const base = { 'aria-hidden': true, focusable: false, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Rounded indigo tile that holds an icon or illustration; fixed size so nothing shifts. */
export function ArtTile({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20 ${className}`}>{children}</span>;
}

/** Isometric print bed with a cube on it and X / Y / Z dimension arrows. */
export function BedArt() {
  return (
    <svg {...base} viewBox="0 0 64 48" className="h-12 w-16 shrink-0 text-indigo-600 dark:text-indigo-300">
      <path d="M8 34l24-10 24 10-24 10z" className="fill-indigo-100/70 dark:fill-indigo-500/10" />
      <path d="M24 28v-9l8-3.5 8 3.5v9l-8 3.5zM24 19l8 3.5 8-3.5M32 22.5v9" className="fill-indigo-200/70 dark:fill-indigo-400/20" />
      <path d="M8 38l24 10M56 38L32 48" strokeDasharray="1 3" opacity=".6" />
      <path d="M4 32v-14M2.5 20L4 17l1.5 3M2.5 30L4 33l1.5-3" opacity=".8" />
    </svg>
  );
}

/** Three starting points. */
export function StartArt({ kind }: { kind: 'file' | 'idea' | 'part' }) {
  const c = 'h-16 w-24 text-indigo-600 dark:text-indigo-300';
  if (kind === 'file')
    return (
      <svg {...base} viewBox="0 0 96 64" className={c}>
        <path d="M30 6h22l12 12v36a3 3 0 01-3 3H30a3 3 0 01-3-3V9a3 3 0 013-3z" className="fill-indigo-50 dark:fill-indigo-500/10" />
        <path d="M52 6v12h12" />
        <path d="M46 28l10 5v10l-10 5-10-5V33zM36 33l10 5 10-5M46 38v10" className="fill-indigo-200/70 dark:fill-indigo-400/20" />
        <path d="M80 44V24M74 30l6-6 6 6" opacity=".7" />
      </svg>
    );
  if (kind === 'idea')
    return (
      <svg {...base} viewBox="0 0 96 64" className={c}>
        <path d="M48 8a14 14 0 00-8 25.5c1.2.9 2 2.4 2 4v1h12v-1c0-1.6.8-3.1 2-4A14 14 0 0048 8z" className="fill-amber-100 stroke-amber-500 dark:fill-amber-400/15 dark:stroke-amber-300" />
        <path d="M43 47h10M44 52h8" />
        <path d="M48 1v3M30 8l2 2M66 8l-2 2M24 22h3M69 22h3" opacity=".7" />
        <path d="M70 52c4-6 8 2 12-4l4 2" strokeDasharray="2 3" opacity=".7" />
      </svg>
    );
  return (
    <svg {...base} viewBox="0 0 96 64" className={c}>
      <path d="M10 22l10-5 10 5v10l-10 5-10-5zM10 22l10 5 10-5M20 27l-2 4 3 2-2 5" className="fill-gray-100 stroke-gray-500 dark:fill-gray-700/40 dark:stroke-gray-400" />
      <path d="M38 32h18M50 26l6 6-6 6" />
      <path d="M64 22l10-5 10 5v10l-10 5-10-5zM64 22l10 5 10-5M74 27v10" className="fill-indigo-200/70 dark:fill-indigo-400/20" />
    </svg>
  );
}

/** Tiny filament spool: coloured reel with a hole. */
export function Spool({ color }: { color: string }) {
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="7" fill={color} stroke="currentColor" strokeOpacity=".35" />
      <circle cx="8" cy="8" r="2.6" className="fill-white dark:fill-gray-900" stroke="currentColor" strokeOpacity=".35" />
    </svg>
  );
}
