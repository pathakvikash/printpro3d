// Pick a part > Adjust > Order. Compact, sticky-friendly (no margins of its own). Step 3 wording is from How it works.
import Link from 'next/link';

const STEPS = [
  { key: 'pick', label: 'Pick a part', href: '/shop' },
  { key: 'adjust', label: 'Adjust', href: null }, // a step on the part's own page, not a place to go
  { key: 'order', label: 'Order', href: '/quote' },
] as const;

export default function FlowStrip({ current }: { current: 'pick' | 'adjust' | 'order' }) {
  return (
    <nav aria-label="Steps" className="rounded-xl border border-gray-200 bg-white/90 px-2 py-1.5 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <ol className="flex items-center gap-1 text-xs sm:gap-2 sm:text-sm">
        {STEPS.map((s, i) => {
          const on = s.key === current;
          const cls = `flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200'} ${s.href && !on ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : ''}`;
          const body = <><span aria-hidden>{i + 1}</span><span className="truncate">{s.label}</span></>;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              {s.href ? <Link href={s.href} aria-current={on ? 'step' : undefined} className={cls}>{body}</Link> : <span aria-current={on ? 'step' : undefined} className={cls}>{body}</span>}
              {i < STEPS.length - 1 && <span aria-hidden className="text-gray-400">›</span>}
            </li>
          );
        })}
      </ol>
      <p className="px-2 pt-0.5 text-center text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">We review your order, then send a payment link.</p>
    </nav>
  );
}
