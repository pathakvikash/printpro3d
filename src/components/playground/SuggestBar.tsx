'use client';

import { useState } from 'react';
import { chipLabel, describeAngle, KIND_LABEL, NUDGE_MM, type SuggestItem } from '@/lib/suggest/plan';
import type { Placement } from '@/lib/suggest/placement';
import type { PartKind } from '@/lib/suggest/validate';

// small stroke icons, decorative: the label carries the meaning
const ICON: Record<PartKind, string> = {
  motor: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v4M12 18v4M2 12h4M18 12h4',
  esc: 'M4 4h16v16H4zM9 9h6v6H9zM2 9h2M2 15h2M20 9h2M20 15h2',
  battery: 'M2 8h17v8H2zM19 11h3v2h-3zM6 11v2M10 11v2',
  fc: 'M5 5h14v14H5zM9 9h6v6H9z',
  camera: 'M3 8h4l2-3h6l2 3h4v11H3zM12 16a3 3 0 100-6 3 3 0 000 6z',
  payload: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 8L12 13l8.7-5M12 22V13',
};
const Svg = ({ d }: { d: string }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d={d} /></svg>
);

const chip = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors';
const idle = 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
const armedCls = 'bg-indigo-600 text-white border-indigo-600';
const small = 'rounded-lg border px-2.5 py-1 text-sm font-medium bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';

/** The slim "Suggested next" bar: one chip per missing part (rule order, or the AI's), the top reason underneath. Render nothing when there is nothing to suggest. */
export default function SuggestBar({ items, armed, aiRanked, onPick, onDismiss }: { items: SuggestItem[]; armed: PartKind | null; aiRanked: boolean; onPick: (k: PartKind) => void; onDismiss: () => void }) {
  const [peek, setPeek] = useState<PartKind | null>(null);
  if (!items.length) return null;
  const shown = items.find((i) => i.kind === (peek ?? armed)) ?? items[0];
  return (
    <div role="region" aria-label="Suggested next" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggested next</span>
          {aiRanked && <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:text-indigo-200">AI-ranked</span>}
          {items.map((i) => (
            <button
              key={i.kind} type="button" aria-pressed={armed === i.kind} title={i.reason}
              onClick={() => onPick(i.kind)} onMouseEnter={() => setPeek(i.kind)} onMouseLeave={() => setPeek(null)} onFocus={() => setPeek(i.kind)} onBlur={() => setPeek(null)}
              className={`${chip} ${armed === i.kind ? armedCls : idle}`}
            >
              <Svg d={ICON[i.kind]} />{chipLabel(i)}
            </button>
          ))}
        </div>
        <button type="button" onClick={onDismiss} aria-label="Hide suggestions" className="shrink-0 rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate" title={shown.reason}>{shown.reason}</p>
    </div>
  );
}

/** The armed suggestion: why this spot and angle, with accept / nudge / ignore. place null means no spot fits (only Ignore). */
export function ArmedPanel({ kind, place, reason, note, onAccept, onNudge, onIgnore }: {
  kind: PartKind; place: Placement | null; reason: string; note: string | null;
  onAccept: () => void; onNudge: (d: { dx?: number; dy?: number; dYaw?: number }) => void; onIgnore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const angle = place ? describeAngle(place, kind) : '';
  return (
    <div role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-sm text-emerald-900 dark:text-emerald-200 space-y-2">
      <p><span className="font-semibold">{KIND_LABEL[kind]}:</span> {reason}{angle ? ` Angle: ${angle}.` : ''}</p>
      {note && <p className="text-amber-800 dark:text-amber-300">{note}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        {place && <button type="button" onClick={onAccept} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-sm font-semibold">Accept</button>}
        {place && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={small}>Nudge</button>}
        <button type="button" onClick={onIgnore} className={small}>Ignore</button>
        {place && open && (
          <span className="flex flex-wrap gap-1.5" role="group" aria-label="Nudge the suggested spot">
            <button type="button" aria-label={`Move left ${NUDGE_MM} mm`} onClick={() => onNudge({ dx: -NUDGE_MM })} className={small}>←</button>
            <button type="button" aria-label={`Move right ${NUDGE_MM} mm`} onClick={() => onNudge({ dx: NUDGE_MM })} className={small}>→</button>
            <button type="button" aria-label={`Move forward ${NUDGE_MM} mm`} onClick={() => onNudge({ dy: NUDGE_MM })} className={small}>↑</button>
            <button type="button" aria-label={`Move back ${NUDGE_MM} mm`} onClick={() => onNudge({ dy: -NUDGE_MM })} className={small}>↓</button>
            {kind !== 'motor' && <button type="button" aria-label="Turn 90 degrees" onClick={() => onNudge({ dYaw: 90 })} className={small}>Turn 90°</button>}
          </span>
        )}
      </div>
    </div>
  );
}
