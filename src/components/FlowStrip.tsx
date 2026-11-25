// Pick a part > Adjust > Order. Compact inline stepper, no margins of its own. Step 3 wording is from How it works.
import Link from 'next/link';
import Icon from './Icon';

const STEPS = [
  { key: 'pick', label: 'Pick a part', href: '/shop' },
  { key: 'adjust', label: 'Adjust', href: null }, // a step on the part's own page, not a place to go
  { key: 'order', label: 'Order', href: '/quote' },
] as const;

export default function FlowStrip({ current }: { current: 'pick' | 'adjust' | 'order' }) {
  const cur = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Steps" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <ol className="flex items-center text-sm">
        {STEPS.map((s, i) => {
          const done = i < cur;
          const on = i === cur;
          const cls = 'flex items-center gap-2 rounded-md py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
          const circle = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-indigo-600 text-white dark:bg-indigo-500' : on ? 'border-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'}`;
          const label = done ? `font-medium text-gray-700 dark:text-gray-300${s.href ? ' hover:text-indigo-600 dark:hover:text-indigo-400' : ''}` : on ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400';
          const body = (
            <>
              <span aria-hidden className={circle}>{done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}</span>
              {done && <span className="sr-only">Completed: </span>}
              <span className={`whitespace-nowrap ${label}`}>{s.label}</span>
            </>
          );
          return (
            <li key={s.key} className="flex items-center">
              {s.href ? <Link href={s.href} aria-current={on ? 'step' : undefined} className={cls}>{body}</Link> : <span aria-current={on ? 'step' : undefined} className={cls}>{body}</span>}
              {i < STEPS.length - 1 && <span aria-hidden className={`mx-2 h-px w-6 sm:mx-3 sm:w-10 ${done ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`} />}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-gray-500 dark:text-gray-400 sm:border-l sm:border-gray-200 sm:pl-4 dark:sm:border-gray-700">We review your order, then send a payment link.</p>
    </nav>
  );
}
