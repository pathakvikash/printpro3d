'use client';

// "Customise with AI" on a template or kit page, the safe path: the AI proposes new settings, the server validates them against the product's
// own schema (and this component never applies anything it did not get back validated), the page re-renders the preview and the new price from
// the proposal, and only Accept adds it to the cart. A request that needs new geometry offers the builder with a copy instead.
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { CHANGE_MAX, cfgDiff, customLabel, type ConfigChange } from '@/lib/aiCustomise';
import type { Cfg, Field } from '@/lib/templateDefs';
import { EMAIL_KEY, validEmail } from '@/lib/aiChat';

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50';
const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
const field = 'w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const stored = () => { try { return localStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; } };

export type Proposal = { cfg: Cfg; changes: ConfigChange[]; notes: string; geometry: boolean };

export default function AiConfigPanel({ kind, id, name, fields, current, priceNow, priceNew, ready, onProposal, onAccept, onBuilder, onClose }: {
  kind: 'template' | 'kit'; id: string; name: string; fields: Field[]; current: Cfg;
  priceNow: string; priceNew: string | null; ready: boolean;
  onProposal: (cfg: Cfg | null) => void; onAccept: (cfg: Cfg) => void;
  onBuilder: (() => string | null) | null; // makes the sandbox copy and returns the builder URL, or null when the browser blocked storage
  onClose: () => void;
}) {
  const uid = useId();
  const [text, setText] = useState('');
  const [email, setEmail] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [off, setOff] = useState<boolean | null>(null);
  const [prop, setProp] = useState<Proposal | null>(null);
  const [trap, setTrap] = useState('');

  useEffect(() => {
    fetch('/api/designs').then((r) => r.json()).then((d) => setOff(!d.ai)).catch(() => setOff(false));
    return () => onProposal(null);
  }, [onProposal]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (text.trim().length < 3) return setNote('Say what to change.');
    if (!validEmail(email)) return setNote('Enter your email first: we use it for the daily AI limit.');
    setBusy(true); setNote(null); setProp(null); onProposal(null);
    try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch {}
    try {
      const res = await fetch('/api/design/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), kind, id, cfg: current, prompt: text.trim(), website: trap }) });
      const d = (await res.json().catch(() => ({}))) as Partial<Proposal> & { error?: string };
      if (!res.ok) return setNote(d.error || 'The AI service did not answer. Try again.');
      // the server already validated; the diff is recomputed here from our own schema, so what is shown is what is applied
      const cfg = d.cfg && typeof d.cfg === 'object' ? d.cfg : null;
      const changes = cfg ? cfgDiff(fields, current, cfg) : [];
      const notes = typeof d.notes === 'string' ? d.notes.slice(0, 300) : '';
      const geometry = d.geometry === true;
      if (!cfg || (!changes.length && !geometry)) return setNote(notes || 'The AI proposed no change.');
      setProp({ cfg, changes, notes, geometry });
      onProposal(changes.length ? cfg : null);
    } catch { setNote('The AI service did not answer. Try again.'); } finally { setBusy(false); }
  };
  const discard = () => { setProp(null); onProposal(null); };
  const builder = () => { const u = onBuilder?.(); if (u) window.location.assign(u); else setNote('This browser blocked storage, so the builder cannot open the copy.'); };

  return (
    <section aria-label="Customise with AI" className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold text-gray-900 dark:text-white">Customise with AI</h3>
        <button type="button" onClick={onClose} aria-label="Close the AI panel" title="Close the AI panel" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="x" className="h-4 w-4" /></button>
      </div>
      {off ? (
        <p role="status" className="text-sm text-gray-700 dark:text-gray-200">AI is not set up yet. You can still change the settings by hand.</p>
      ) : (
        <form onSubmit={send} noValidate className="space-y-2">
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label htmlFor={`${uid}-w`}>Leave this field empty</label><input id={`${uid}-w`} type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></div>
          <p className="text-xs text-gray-600 dark:text-gray-300">Say what to change on {name}. The AI only moves the settings above, and you see the difference and the new price before anything is added.</p>
          {!validEmail(stored()) && (
            <div><label htmlFor={`${uid}-e`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Email for the daily AI limit</label>
              <input id={`${uid}-e`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></div>
          )}
          <label htmlFor={`${uid}-t`} className="sr-only">What should change?</label>
          <textarea id={`${uid}-t`} rows={2} value={text} maxLength={CHANGE_MAX} onChange={(e) => setText(e.target.value)} placeholder="e.g. make it a bit wider and thicker" className={field} />
          {note && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{note}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || off === null} aria-label="Propose settings" title="Propose settings" className={primary}><Icon name="spark" className="h-4 w-4" />{busy ? 'Thinking' : 'Propose'}</button>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">A few AI tries per day.</span>
          </div>
        </form>
      )}
      {prop && (
        <div className="space-y-2 rounded-lg bg-white p-3 text-sm dark:bg-gray-900" aria-live="polite">
          <p className="font-semibold text-gray-900 dark:text-white">{prop.changes.length ? `Proposed: ${customLabel(name)}` : 'This needs a different shape'}</p>
          {prop.notes && <p className="text-gray-700 dark:text-gray-300">{prop.notes}</p>}
          {prop.changes.length > 0 && (
            <ul className="space-y-1">
              {prop.changes.map((c) => <li key={c.key} className="text-gray-800 dark:text-gray-200"><span className="font-medium">{c.label}:</span> <span className="text-gray-500 line-through dark:text-gray-400">{c.from}</span> → {c.to}</li>)}
            </ul>
          )}
          {prop.changes.length > 0 && <p className="font-mono text-gray-900 dark:text-gray-100">{priceNow} → {priceNew ?? '…'}</p>}
          {prop.geometry && <p className="text-xs text-amber-800 dark:text-amber-200">The settings cannot do all of this. Open a copy in the builder to change the shape itself.</p>}
          <div className="flex flex-wrap gap-2">
            {prop.changes.length > 0 && <button type="button" disabled={!ready} onClick={() => { onAccept(prop.cfg); setProp(null); }} aria-label="Accept and add to cart" title="Accept and add to cart" className={primary}><Icon name="check" className="h-4 w-4" />Accept</button>}
            {prop.changes.length > 0 && <button type="button" onClick={discard} aria-label="Discard this proposal" title="Discard this proposal" className={btn}><Icon name="x" className="h-4 w-4" />Discard</button>}
            {(prop.geometry || !prop.changes.length) && (onBuilder
              ? <button type="button" onClick={builder} aria-label="Open in builder" title="Open in builder" className={btn}><Icon name="edit" className="h-4 w-4" />Open in builder</button>
              : <Link href="/request" className={btn}>Describe your idea</Link>)}
          </div>
        </div>
      )}
    </section>
  );
}
