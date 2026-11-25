'use client';
// Parts to build with: printable templates, bought parts (enquiry only) and basic shapes. Every item can be dragged onto the canvas
// (native HTML5 drag) or tapped: shapes and templates then land at once, a bought part waits for a tap on the bed.
import { useState } from 'react';
import Icon from '../Icon';
import { TEMPLATES } from '@/lib/templateDefs';
import { MOTORS } from '@/lib/motors';
import { MASS_PARTS } from '@/lib/flight/layout';
import { KINDS, LABEL, type Kind } from '@/lib/playground';
import type { Placing } from './PlaygroundScene';

export type DragItem = { t: 'tpl'; id: string } | { t: 'shape'; id: Kind } | { t: 'part'; placing: Placing };
export const DRAG_TYPE = 'application/x-printpro3d-part';

const RANK: Record<string, number> = { drone: 0, robotics: 1 }; // drone and robotics templates first
const TPLS = [...TEMPLATES].sort((a, b) => (RANK[a.category] ?? 2) - (RANK[b.category] ?? 2));

const item = 'flex min-h-10 w-full cursor-grab items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';

export default function Palette({ disabled, armed, spin, onShape, onTemplate, onPart, onDragStart, onDragEnd }: {
  disabled: boolean; armed: Placing | null; spin: 'cw' | 'ccw';
  onShape: (k: Kind) => void; onTemplate: (id: string) => void; onPart: (p: Placing) => void;
  onDragStart: (d: DragItem) => void; onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false); // the mobile bottom sheet
  const drag = (d: DragItem) => ({
    draggable: !disabled,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(d)); e.dataTransfer.effectAllowed = 'copy'; onDragStart(d); },
    onDragEnd,
  });
  const isArmed = (p: Placing) => !!armed && armed.kind === p.kind && (p.kind === 'motor' ? (armed as typeof p).motorId === p.motorId : (armed as typeof p).name === p.name);
  const group = (title: string, note?: string) => (
    <div className="mt-3 first:mt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
      {note && <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
  const body = (
    <div className="space-y-1.5">
      {group('Printable parts', 'Drag onto the bed, or tap to add.')}
      <ul className="space-y-1.5">
        {TPLS.map((t) => (
          <li key={t.id}>
            <button type="button" disabled={disabled} onClick={() => onTemplate(t.id)} aria-label={`Add ${t.name}`} title={`Add ${t.name}`} className={item} {...drag({ t: 'tpl', id: t.id })}>
              <Icon name="cube" className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" /><span className="line-clamp-2 min-w-0 text-left leading-snug" title={t.name}>{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {group('Bought parts', 'Enquiry only. Drag onto the model, or tap then tap the bed.')}
      <ul className="space-y-1.5">
        {[...MOTORS.map((m): [string, string, Placing] => [m.id, m.name, { kind: 'motor', spin, motorId: m.id }]),
          ...MASS_PARTS.map((n): [string, string, Placing] => [n, n, { kind: 'mass', name: n }])].map(([key, name, p]) => (
          <li key={key}>
            <button type="button" disabled={disabled} aria-pressed={isArmed(p)} onClick={() => { setOpen(false); onPart(p); }} aria-label={`Add ${name}`} title={`Add ${name}`}
              className={`${item} ${isArmed(p) ? 'border-indigo-600 ring-2 ring-indigo-500' : ''}`} {...drag({ t: 'part', placing: p })}>
              <Icon name="bolt" className="h-4 w-4 shrink-0 text-amber-600" /><span className="line-clamp-2 min-w-0 flex-1 text-left leading-snug" title={name}>{name}</span>
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">enquiry only</span>
            </button>
          </li>
        ))}
      </ul>
      {group('Shapes')}
      <ul className="grid grid-cols-2 gap-1.5">
        {KINDS.map((k) => (
          <li key={k}>
            <button type="button" disabled={disabled} onClick={() => onShape(k)} aria-label={`Add ${LABEL[k]}`} title={`Add ${LABEL[k]}`} className={item} {...drag({ t: 'shape', id: k })}>
              <Icon name="plus" className="h-4 w-4 shrink-0" />{LABEL[k]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <>
      <section aria-label="Parts palette" className="hidden rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Parts</h3>
        {body}
      </section>
      <div className="lg:hidden">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={open ? 'Close parts' : 'Open parts'} title={open ? 'Close parts' : 'Open parts'}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <Icon name={open ? 'x' : 'plus'} className="h-4 w-4" />Parts
        </button>
        {open && (
          <section aria-label="Parts palette" className="fixed inset-x-0 bottom-14 z-40 max-h-[55vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 flex items-center">
              <h3 className="mr-auto text-sm font-semibold text-gray-900 dark:text-gray-100">Parts</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close parts" title="Close parts" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="x" className="h-4 w-4" /></button>
            </div>
            {body}
          </section>
        )}
      </div>
    </>
  );
}
