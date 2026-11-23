'use client';
// Plan: the draft (parts, size, fit, weight, drawing, assumptions) and how to change it: AI revision, hand edit, undo, compare with the previous revision.
import { useId, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '../Icon';
import { card, input, label, secondaryBtn, submitBtn } from '../ContactFields';
import { blueprint as drawSheet } from '@/lib/blueprint';
import { blueprintToShapes, diffBlueprints, type Blueprint } from '@/lib/designBlueprint';
import {
  BY_LABEL, CHANGE_MAX, EMAIL_KEY, aiUsage, bedFit, canUndo, currentRevision, diffRows, estGrams, fmtSize, isFrozen, mapError, noteItems, partRows, previousRevision,
  reassign, revisionRows, validEmail, type Caps, type ProjectView, type UiError,
} from '@/lib/buildFlow';
import { ApiError, api } from './api';
import { useMesh, useReducedMotion } from './useMesh';
import { ErrorNote, sectionH, subtle, td, th } from './ui';

const BlueprintSheet = dynamic(() => import('../BlueprintSheet'), { ssr: false });
const ExamplePreview = dynamic(() => import('../ExamplePreview'), { ssr: false });
const Playground = dynamic(() => import('../Playground'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading the editor…</p> });

const readEmail = () => { try { return localStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; } };

function Facts({ b, stats }: { b: Blueprint; stats: ReturnType<typeof useMesh>['stats'] }) {
  const fit = bedFit(b);
  const g = estGrams(stats);
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Overall size</dt><dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtSize(b.envelope)}</dd></div>
      <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Print bed</dt><dd className={`text-sm font-semibold ${fit.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{fit.text}</dd></div>
      <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Estimated weight</dt><dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g === null ? 'Working it out…' : `about ${g.toFixed(0)} g in PLA`}</dd></div>
    </dl>
  );
}

/** The plan as the customer should read it: shared by Plan and Approve. */
export function PlanSummary({ p, bp }: { p: ProjectView; bp: Blueprint }) {
  const shapes = useMemo(() => blueprintToShapes(bp), [bp]);
  const { tris, stats, ready } = useMesh(shapes);
  const sheet = useMemo(() => (tris && tris.length >= 9 ? drawSheet(tris, { name: bp.title, material: 'PLA' }) : null), [tris, bp.title]);
  const notes = noteItems(bp.notes);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{bp.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Revision v{currentRevision(p).n} · {BY_LABEL[currentRevision(p).by]}</p>
      </div>
      <Facts b={bp} stats={stats} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[420px]">
          <caption className="sr-only">Parts of this design</caption>
          <thead className="bg-gray-50 dark:bg-gray-800"><tr><th scope="col" className={th}>Part</th><th scope="col" className={th}>Role</th><th scope="col" className={th}>Size (mm)</th></tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {partRows(bp).map((r) => <tr key={r.id}><th scope="row" className={`${td} text-left font-medium`}>{r.name}</th><td className={td}>{r.role}</td><td className={td}>{r.dims}</td></tr>)}
          </tbody>
        </table>
      </div>
      {bp.features.length > 0 && (
        <div>
          <h4 className={sectionH}>Holes and slots</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {bp.features.map((f, i) => <li key={i}>{f.note}{f.dia ? ` (${f.dia} mm wide` : ''}{f.depth ? `${f.dia ? ', ' : ' ('}${f.depth} mm deep` : ''}{f.dia || f.depth ? ')' : ''}</li>)}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Assumptions to check</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      {sheet ? <BlueprintSheet svg={sheet} filename={`plan-v${currentRevision(p).n}`} /> : <p className={subtle}>{ready ? 'We could not draw this one; the sizes above still apply.' : 'Drawing the blueprint…'}</p>}
    </div>
  );
}

function Compare({ p }: { p: ProjectView }) {
  const prev = previousRevision(p);
  const cur = currentRevision(p);
  const reduce = useReducedMotion();
  const diff = useMemo(() => (prev ? diffRows(diffBlueprints(prev.blueprint, cur.blueprint)) : []), [prev, cur]);
  const a = useMemo(() => (prev ? blueprintToShapes(prev.blueprint) : []), [prev]);
  const b = useMemo(() => blueprintToShapes(cur.blueprint), [cur]);
  if (!prev) return null;
  return (
    <section aria-labelledby="cmp-h" className="space-y-3">
      <h4 id="cmp-h" className={sectionH}>What changed from v{prev.n} to v{cur.n}</h4>
      {/* two canvases at most, far below the 6-canvas rule */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[[`Previous (v${prev.n})`, a], [`Current (v${cur.n})`, b]].map(([t, s]) => (
          <figure key={t as string}>
            <div className="h-44 overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950" aria-hidden><ExamplePreview shapes={s as typeof a} reduceMotion={reduce} material="PLA" /></div>
            <figcaption className="mt-1 text-center text-xs text-gray-600 dark:text-gray-300">{t as string}</figcaption>
          </figure>
        ))}
      </div>
      {diff.length === 0 ? <p className={subtle}>No shape changed between these two revisions.</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[420px]">
            <caption className="sr-only">Changes between the two revisions</caption>
            <thead className="bg-gray-50 dark:bg-gray-800"><tr><th scope="col" className={th}>Shape</th><th scope="col" className={th}>Change</th></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {diff.map((r, i) => (
                <tr key={i}>
                  <th scope="row" className={`${td} text-left font-medium`}>{r.what}</th>
                  <td className={td}><span className={r.kind === 'added' ? 'text-green-700 dark:text-green-400' : r.kind === 'removed' ? 'text-red-700 dark:text-red-400' : ''}>{r.detail}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function PlanStep({ p, caps, onProject, onNext }: { p: ProjectView; caps: Caps; onProject: (p: ProjectView) => void; onNext: () => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [email, setEmail] = useState(readEmail);
  const [mm, setMm] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'ai' | 'scale' | 'undo' | null>(null);
  const [err, setErr] = useState<UiError | null>(null);
  const cur = currentRevision(p);
  const bp = cur.blueprint;
  const use = aiUsage(p, caps.revisions);
  const mesh = p.source === 'mesh';
  const needEmail = p.source !== 'prompt'; // a prompt project already has the customer's email on the server
  const canAi = caps.ai && !mesh && !use.exhausted && text.trim().length >= 3 && (!needEmail || validEmail(email));

  const act = async (kind: typeof busy, go: () => Promise<{ project: ProjectView }>) => {
    setBusy(kind);
    setErr(null);
    try {
      const r = await go();
      onProject(r.project);
      return true;
    } catch (e) {
      setErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(500));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const submitAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAi || busy) return;
    if (needEmail) try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch {}
    if (await act('ai', () => api.revise(p.id, text.trim(), needEmail ? email.trim() : undefined))) setText('');
  };

  const initial = useMemo(() => blueprintToShapes(bp), [bp]);
  const rows = revisionRows(p);
  const frozen = isFrozen(p.status);

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${id}-plan`}>
        <h2 id={`${id}-plan`} className="sr-only">Plan</h2>
        {editing ? (
          <div className="space-y-3">
            <h3 className={sectionH}>Edit by hand</h3>
            <p className={subtle}>Change the shapes, then save. A save is a new revision; you can always go back with Undo.</p>
            <Playground
              key={`${p.id}:${p.current}`}
              project={{ initialShapes: initial, onSave: async (shapes) => ((await act('scale', () => api.manualBlueprint(p.id, reassign(bp, shapes)))) ? (setEditing(false), null) : 'That edit was not accepted. See the message above the editor.') }}
            />
            <ErrorNote err={err} />
            <button type="button" onClick={() => { setEditing(false); setErr(null); }} className={secondaryBtn}><Icon name="undo" />Close the editor</button>
          </div>
        ) : (
          <PlanSummary p={p} bp={bp} />
        )}
      </section>

      {frozen && <p role="status" className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200"><Icon name="lock" />This design is {p.status}, so it can no longer be changed.</p>}

      {!editing && !frozen && (
        <section className={card} aria-labelledby={`${id}-chg`}>
          <h3 id={`${id}-chg`} className={sectionH}>Change the plan</h3>

          {mesh ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const v = Number(mm); if (v > 0 && !busy) void act('scale', () => api.manualScale(p.id, v)); }}>
              <p className={subtle}>This is an uploaded model, so it can only be scaled. The box shows its overall size.</p>
              <div>
                <label htmlFor={`${id}-mm`} className={label}>Longest side (mm){cur.longestMm ? `, now ${cur.longestMm}` : ''}</label>
                <input id={`${id}-mm`} type="number" min={1} step="any" value={mm} onChange={(e) => setMm(e.target.value)} className={`${input} sm:max-w-[12rem]`} />
              </div>
              <button type="submit" disabled={!(Number(mm) > 0) || busy !== null} className={`${submitBtn} sm:w-auto`}><Icon name="wrench" />{busy === 'scale' ? 'Scaling…' : 'Rescale'}</button>
            </form>
          ) : caps.ai ? (
            <form onSubmit={submitAi} className="space-y-3">
              <div>
                <label htmlFor={`${id}-req`} className={label}>What should change?</label>
                <textarea id={`${id}-req`} value={text} onChange={(e) => setText(e.target.value)} maxLength={CHANGE_MAX} rows={2} className={input} disabled={use.exhausted}
                  placeholder="Make it 10 mm taller and add a hole in the middle" aria-describedby={`${id}-cnt`} />
                <p id={`${id}-cnt`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{text.length} / {CHANGE_MAX} characters · AI changes: {use.text}</p>
              </div>
              {needEmail && (
                <div>
                  <label htmlFor={`${id}-em`} className={label}>Your email (needed for AI changes)</label>
                  <input id={`${id}-em`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
                </div>
              )}
              {use.exhausted && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">This design has used its {use.cap} AI changes. You can still edit it by hand.</p>}
              <button type="submit" disabled={!canAi || busy !== null} className={`${submitBtn} sm:w-auto`}><Icon name="bolt" />{busy === 'ai' ? 'Changing…' : 'Change with AI'}</button>
            </form>
          ) : (
            <p className={subtle}>AI changes are not set up on this site. You can edit by hand.</p>
          )}

          <ErrorNote err={err} />
          <div className="flex flex-col gap-3 sm:flex-row">
            {!mesh && <button type="button" onClick={() => { setEditing(true); setErr(null); }} className={secondaryBtn}><Icon name="edit" />Edit by hand</button>}
            <button type="button" disabled={!canUndo(p) || busy !== null} onClick={() => void act('undo', () => api.undo(p.id))} className={`${secondaryBtn} disabled:opacity-50`}><Icon name="undo" />{busy === 'undo' ? 'Undoing…' : 'Undo'}</button>
          </div>
        </section>
      )}

      {!editing && <section className={card}><Compare p={p} /></section>}

      <section className={card} aria-labelledby={`${id}-rev`}>
        <h3 id={`${id}-rev`} className={sectionH}>Revisions</h3>
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.n} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{r.label}</span>
              {r.current && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Current</span>}
              {r.approved && <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">Approved</span>}
              <span className="text-gray-500 dark:text-gray-400">{BY_LABEL[r.by]}</span>
              {r.request && <span className="min-w-0 break-words text-gray-700 dark:text-gray-300">“{r.request}”</span>}
            </li>
          ))}
        </ol>
      </section>

      {!editing && !frozen && (
        <div className="flex">
          <button type="button" onClick={onNext} className={`${submitBtn} sm:w-auto`}><Icon name="arrow" />Looks right, go to Approve</button>
        </div>
      )}
    </div>
  );
}
