'use client';
// One page, two modes: Inspect (the viewer: 3D, blueprint, kits assembled) and Build & simulate (the design flow and shape builder).
// ?mode=build selects Build; its own params (example, sim, step, prompt, from) are read by the builder untouched.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ModelPlayground from './ModelPlayground';
import { BuildRoute } from './RoutePages';

const TABS = [
  { mode: 'inspect', href: '/playground', label: 'Inspect' },
  { mode: 'build', href: '/playground?mode=build', label: 'Build' },
] as const;

export default function PlaygroundHub() {
  const mode = useSearchParams().get('mode') === 'build' ? 'build' : 'inspect';
  return (
    <div className="space-y-6">
      <nav aria-label="Playground mode" className="flex w-fit overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
        {TABS.map((t) => (
          <Link key={t.mode} href={t.href} aria-current={mode === t.mode ? 'page' : undefined} className={`border-r border-gray-300 px-4 py-2 text-sm font-medium last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-600 ${mode === t.mode ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white text-gray-800 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100'}`}>{t.label}</Link>
        ))}
      </nav>
      {mode === 'build' ? <BuildRoute /> : <ModelPlayground />}
    </div>
  );
}
