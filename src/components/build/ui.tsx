// Small shared bits for the Build flow.
import type { UiError } from '@/lib/buildFlow';

const HINT: Partial<Record<UiError['kind'], string>> = {
  rate_limit: 'You can still edit by hand, or start from a template.',
  ai_off: 'You can still start from a template or edit by hand.',
  network: '',
};

/** One plain error line. 429 and "AI not configured" get their own look so they are not mistaken for a mistake in the input. */
export function ErrorNote({ err }: { err: UiError | null }) {
  if (!err) return null;
  const soft = err.kind === 'rate_limit' || err.kind === 'ai_off';
  return (
    <p role="alert" className={`rounded-xl px-4 py-2 text-sm ${soft ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>
      {err.text}{HINT[err.kind] && !err.text.includes(HINT[err.kind]!) ? ` ${HINT[err.kind]}` : ''}
    </p>
  );
}

export const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
export const td = 'px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
export const sectionH = 'text-base font-semibold text-gray-900 dark:text-gray-100';
export const subtle = 'text-sm text-gray-600 dark:text-gray-300';
