'use client';
// Pieces shared by the shop grid cards and the product pages.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from './Icon';

export const chipClass = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    on
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  }`;

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduce;
}

export function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const h = setTimeout(() => setD(v), ms);
    return () => clearTimeout(h);
  }, [v, ms]);
  return d;
}

export function BackToShop() {
  return (
    <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
      <span aria-hidden>←</span>Back to Shop
    </Link>
  );
}

// One grid card. The title link is stretched over the whole card (so a click anywhere opens the product page);
// the actions row sits above it and stays clickable.
export function CardFrame({ href, category, name, blurb, rows, preview, previewRef, actions, save }: {
  href: string; category: string; name: string; blurb: string; rows: [string, string][];
  preview: React.ReactNode; previewRef?: React.Ref<HTMLDivElement>; actions: React.ReactNode; save?: React.ReactNode;
}) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500">
      <div ref={previewRef} className="h-48 bg-[#ebe8e1] dark:bg-[#141a2b]" aria-hidden>{preview}</div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{category}</span>
            <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">{name}</Link>
            </h3>
          </div>
          {save && <div className="relative z-10">{save}</div>}
        </div>
        <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{blurb}</p>
        <dl className="divide-y divide-gray-100 border-y border-gray-100 text-sm dark:divide-gray-800 dark:border-gray-800">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1">
              <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="text-right font-mono text-gray-900 dark:text-gray-100">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="relative z-10 mt-auto flex items-center gap-3 pt-2">{actions}</div>
      </div>
    </li>
  );
}

export function SpecRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-gray-200 border-y border-gray-200 text-sm dark:divide-gray-700 dark:border-gray-700">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5">
          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className="text-right font-mono text-gray-900 dark:text-gray-100">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const addBtn = 'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-indigo-600 px-4 font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';

export function AddLabel({ added }: { added: boolean }) {
  return added ? <><Icon name="check" />Added</> : <><Icon name="cart" />Add to cart</>;
}

export function useAdded() {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const h = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(h);
  }, [added]);
  return [added, setAdded] as const;
}

export const previewBox = 'h-72 overflow-hidden rounded-xl bg-[#ebe8e1] dark:bg-[#141a2b] sm:h-96';
