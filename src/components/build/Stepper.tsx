'use client';
// Plan > Approve > Build > Order. A step is a button; locked ones stay focusable (aria-disabled) so a screen reader says why not.
import { useRef } from 'react';
import Icon from '../Icon';
import { type Step, type StepView } from '@/lib/buildFlow';

const WHY: Record<Step, string> = { plan: '', approve: '', build: 'Approve the design to unlock Build.', order: 'Finalize the design to unlock Order.' };

export default function Stepper({ steps, onGo }: { steps: StepView[]; onGo: (s: Step) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    refs.current[e.key === 'Home' ? 0 : e.key === 'End' ? steps.length - 1 : (i + d + steps.length) % steps.length]?.focus();
  };
  return (
    <nav aria-label="Design steps">
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((s, i) => (
          <li key={s.step} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <button
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              aria-current={s.current ? 'step' : undefined}
              aria-disabled={!s.allowed}
              title={s.allowed ? undefined : WHY[s.step]}
              onClick={() => s.allowed && onGo(s.step)}
              onKeyDown={(e) => key(e, i)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:justify-start sm:px-3 ${
                s.current
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : s.allowed
                    ? 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
                    : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500'
              }`}
            >
              {s.done && !s.current ? <Icon name="check" className="h-4 w-4 text-green-600 dark:text-green-400" /> : !s.allowed ? <Icon name="lock" className="h-3.5 w-3.5" /> : <span aria-hidden className="text-xs">{i + 1}</span>}
              <span className="truncate">{s.label}</span>
              {s.done && <span className="sr-only">, done</span>}
              {!s.allowed && <span className="sr-only">, locked</span>}
            </button>
            {i < steps.length - 1 && <Icon name="arrow" className="hidden h-3.5 w-3.5 text-gray-400 sm:block" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
