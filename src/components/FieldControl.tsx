'use client';
// The product settings panel shared by kit and template pages: one card, labelled fields with dividers, a small header row
// with Reset and AI. Behaviour (values, validation, AI panel) stays with the caller.

import { useId, useState, type ReactNode } from 'react';
import type { Cfg, Field } from '@/lib/templateDefs';
import Icon from './Icon';

type Val = number | string | boolean;
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
const box = `rounded-lg border border-gray-300 bg-white text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${focus}`;
const hintCls = 'text-xs leading-snug text-gray-500 dark:text-gray-400';

// "Duct size (motor to motor wheelbase)" -> short label + muted hint
const split = (label: string): [string, string] => {
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(label);
  return m ? [m[1], m[2]] : [label, ''];
};

function Num({ f, v, onChange }: { f: Extract<Field, { type: 'range' }>; v: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null); // free typing; commits live while the number is in range
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input type="number" inputMode="decimal" aria-label={split(f.label)[0]} min={f.min} max={f.max} step={f.step} value={draft ?? v}
        onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && n >= f.min && n <= f.max) onChange(n); }}
        onBlur={() => setDraft(null)} className={`${box} h-8 w-16 px-2 text-right font-mono tabular-nums`} />
      {f.unit && <span className={hintCls}>{f.unit}</span>}
    </span>
  );
}

export function FieldControl({ f, value, onChange }: { f: Field; value: Val; onChange: (v: Val) => void }) {
  const id = useId();
  const [name, hint] = split(f.label);
  const labelCls = 'text-sm font-semibold text-gray-900 dark:text-gray-100';
  const note = [hint, f.help].filter(Boolean).join('. ');
  const noteEl = note && <p className={hintCls}>{note}</p>;
  if (f.type === 'bool') {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5"><label htmlFor={id} className={labelCls}>{name}</label>{noteEl}</div>
        <button id={id} type="button" role="switch" aria-checked={value === true} onClick={() => onChange(value !== true)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${focus} ${value === true ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value === true ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    );
  }
  if (f.type === 'select') {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className={`block ${labelCls}`}>{name}</label>
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${box} block h-10 w-full min-w-0 px-2.5`}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {noteEl}
      </div>
    );
  }
  const v = value as number;
  const unit = f.unit ? ` ${f.unit}` : '';
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`block ${labelCls}`}>{name}</label>
      <div className="flex items-center gap-3">
        <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={v} aria-valuetext={`${v}${unit}`} onChange={(e) => onChange(Number(e.target.value))}
          className={`h-8 min-w-0 flex-1 accent-indigo-600 ${focus}`} />
        <Num f={f} v={v} onChange={onChange} />
      </div>
      <div className={`flex justify-between ${hintCls} text-[11px] opacity-80`} aria-hidden><span>{f.min}{unit}</span><span>{f.max}{unit}</span></div>
      {noteEl}
    </div>
  );
}

const hdrBtn = `inline-flex h-8 items-center justify-center gap-1 rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${focus}`;

export function SettingsPanel({ id, title, fields, cfg, onField, changed, onReset, aiOpen, onAi, bare, children }: {
  id: string; title: string; fields: Field[]; cfg: Cfg; onField: (key: string, v: Val) => void; changed: boolean; onReset: () => void;
  aiOpen: boolean; onAi: () => void; bare?: boolean; children?: ReactNode;
}) {
  return (
    <fieldset id={id} className={`min-w-0 scroll-mt-24 ${bare ? '' : 'rounded-xl border border-gray-200 p-4 dark:border-gray-700'}`}>
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h2>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onAi} aria-pressed={aiOpen} aria-label="Customise with AI" title="Customise with AI" className={`${hdrBtn} px-3 ${aiOpen ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : ''}`}><Icon name="spark" />AI</button>
          <button type="button" disabled={!changed} onClick={onReset} aria-label="Reset settings to defaults" title="Reset" className={`${hdrBtn} w-8`}><Icon name="reset" /></button>
        </div>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
        {fields.map((f) => <FieldControl key={f.key} f={f} value={cfg[f.key]} onChange={(v) => onField(f.key, v)} />)}
        {children}
      </div>
    </fieldset>
  );
}
