'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import AdminAiSettings from './AdminAiSettings';
import { NOTE_MAX, countBy, filterRecs, needsAction, toCsv } from '@/lib/adminList';

// The admin token lives in sessionStorage only (gone when the tab closes) and goes out as an Authorization header, never in a URL.
const KEY = 'printpro3d.admin';
const read = () => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const write = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch {} };

type Item = { kind?: string; name: string; qty: number; material?: string; config?: string; cfg?: unknown; total?: number | null; unit?: number | null; file?: string; aiPrompt?: string; review?: boolean; reviewReason?: string; project?: string };
type Rec = {
  type: 'order' | 'request';
  id: string;
  createdAt: string;
  status: string;
  total: number | null;
  currency: string;
  unpricedCount: number | null;
  provisional?: boolean;
  ownerNote?: string;
  ownerNoteAt?: string;
  state?: string;
  pin?: string;
  contact: { name: string; email: string; phone: string; address: string; notes: string };
  items: Item[];
  files: string[];
  request?: { category: string; description: string; qtyBand: string; deliver: string; extras: string; budget: string; sizeMm: { l: number | null; w: number | null; h: number | null } | null };
};
type Statuses = Record<'order' | 'request', string[]>;

const when = (iso: string) => (iso ? new Date(iso).toLocaleString() : '');
const pretty = (s: string) => s.replace(/_/g, ' ');

export default function AdminPanel() {
  const [token, setToken] = useState('');
  const [typed, setTyped] = useState('');
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [statuses, setStatuses] = useState<Statuses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async (t: string, offset = 0) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders?offset=${offset}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) write('');
        throw new Error(res.status === 503 ? 'Admin is off: ADMIN_TOKEN is not set on this server.' : d.error || 'Could not load');
      }
      write(t);
      setToken(t);
      setRecords((old) => (offset && old ? [...old, ...d.records] : d.records));
      setTotal(d.total ?? d.records.length);
      setStatuses(d.statuses);
    } catch (e) {
      setToken('');
      setRecords(null);
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const t = read();
    if (t) void load(t);
  }, [load]);

  const shown = records ? filterRecs(records, { type: fType, status: fStatus, q }) : [];
  const lock = () => { write(''); setToken(''); setTyped(''); setRecords(null); };

  if (!token || !records || !statuses) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); void load(typed); }}
        className={`${card} max-w-md`}
      >
        <div>
          <label htmlFor="admin-token" className={label}>Admin token</label>
          <input id="admin-token" type="password" autoComplete="off" required value={typed} onChange={(e) => setTyped(e.target.value)} className={input} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">The admin token is a password you choose. Set it as ADMIN_TOKEN in Vercel → Project → Settings → Environment Variables (and in .env.local for local runs), then redeploy. Enter the same value here.</p>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={busy || !typed} className={submitBtn}>{busy ? 'Checking' : 'Open'}</button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void load(token)} disabled={busy} className={secondaryBtn}><Icon name="reset" />{busy ? 'Loading' : 'Refresh'}</button>
        <button type="button" onClick={lock} className={secondaryBtn}><Icon name="lock" />Lock</button>
        <p className="text-sm text-gray-600 dark:text-gray-300">{records.length} of {total} loaded, newest first</p>
      </div>
      <AdminAiSettings token={token} />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <Controls records={records} fType={fType} setFType={setFType} fStatus={fStatus} setFStatus={setFStatus} q={q} setQ={setQ} shown={shown} />
      {shown.map((r) => (
        <Row key={`${r.type}-${r.id}`} r={r} token={token} statuses={statuses} onChange={(patch) => setRecords((all) => all && all.map((x) => (x === r ? { ...x, ...patch } : x)))} />
      ))}
      {shown.length === 0 && <p className="text-gray-600 dark:text-gray-300">{records.length ? 'Nothing matches.' : 'Nothing yet.'}</p>}
      {records.length < total && (
        <button type="button" onClick={() => void load(token, records.length)} disabled={busy} className={secondaryBtn}>{busy ? 'Loading' : `Load more (${total - records.length} older)`}</button>
      )}
    </div>
  );
}

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-200'}`;
const dim = 'text-gray-500 dark:text-gray-400';

function Controls({ records, shown, fType, setFType, fStatus, setFStatus, q, setQ }: { records: Rec[]; shown: Rec[]; fType: string; setFType: (v: string) => void; fStatus: string; setFStatus: (v: string) => void; q: string; setQ: (v: string) => void }) {
  const counts = countBy(records);
  const todo = records.filter(needsAction).length;
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `printpro3d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  return (
    <div className="space-y-3">
      {todo > 0 && <p role="status" className="rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{todo} need action (pending review, needs quote or new)</p>}
      <div className="flex flex-wrap gap-2">
        {[['', 'All'], ['order', 'Orders'], ['request', 'Requests']].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={fType === v} onClick={() => setFType(v)} className={chip(fType === v)}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={fStatus === ''} onClick={() => setFStatus('')} className={chip(fStatus === '')}>Any status ({records.length})</button>
        {Object.entries(counts).map(([st, n]) => (
          <button key={st} type="button" aria-pressed={fStatus === st} onClick={() => setFStatus(fStatus === st ? '' : st)} className={chip(fStatus === st)}>{pretty(st)} ({n})</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" aria-label="Search" placeholder="Search id, name, phone, email, city, PIN, item" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} min-w-0 flex-1`} />
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className={secondaryBtn}><Icon name="download" />Download CSV ({shown.length})</button>
      </div>
    </div>
  );
}

function Row({ r, token, statuses, onChange }: { r: Rec; token: string; statuses: Statuses; onChange: (patch: Partial<Rec>) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.ownerNote ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const options = statuses[r.type].includes(r.status) ? statuses[r.type] : [r.status, ...statuses[r.type]]; // an unknown stored status stays selectable

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, type: r.type, ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save');
      return d as { emailed?: boolean };
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' });
      return null;
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const d = await patch({ status });
    if (d) { onChange({ status }); setMsg({ ok: true, text: d.emailed ? 'Saved. The customer was emailed.' : 'Saved. No email sent.' }); }
  };
  const saveNote = async () => {
    if (await patch({ note })) { onChange({ ownerNote: note }); setMsg({ ok: true, text: 'Note saved.' }); }
  };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t).then(() => setMsg({ ok: true, text: 'Copied.' }), () => setMsg({ ok: false, text: 'Copy failed' })); };

  const download = async (name: string) => {
    try {
      const res = await fetch(`/api/admin/files/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setMsg({ ok: false, text: `Could not download ${name}` });
    }
  };

  const c = r.contact;
  const sid = `st-${r.id}`;
  const digits = c.phone.replace(/\D/g, '');
  const wa = digits.length === 10 ? `91${digits}` : digits; // India: bare 10-digit numbers get +91
  const act = needsAction(r);
  return (
    <article className={`${card} ${act ? 'border-l-4 border-l-amber-500' : ''}`} aria-label={`${r.type} ${r.id}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-left">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {r.type === 'order' ? 'Order' : 'Request'} <code className="text-sm font-normal">{r.id.slice(0, 8)}</code> {c.name}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {act && <span className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-black">NEEDS ACTION</span>}
          <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-900 dark:bg-gray-700 dark:text-gray-100">{pretty(r.status)}</span>
          {r.type === 'order' && <span className="text-gray-800 dark:text-gray-200">{r.total === null ? 'quote' : money.format(r.total)}</span>}
          {r.ownerNote && <span title="Has an owner note">note</span>}
          <span className={dim}>{when(r.createdAt)}</span>
        </span>
      </button>
      <p role="status" className={`text-sm ${msg?.ok === false ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{msg?.text}</p>

      {open && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={sid} className={label}>Status</label>
              <select id={sid} value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
                {options.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => void save()} disabled={busy || status === r.status} aria-label="Save status" title="Save status" className={secondaryBtn}><Icon name="save" />{busy ? 'Saving' : 'Save'}</button>
            <button type="button" onClick={() => copy(r.id)} className={secondaryBtn}>Copy id</button>
          </div>

          <dl className="grid gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-200 sm:grid-cols-[8rem_1fr]">
            <dt className={dim}>Id</dt><dd className="break-all">{r.id}</dd>
            <dt className={dim}>Created</dt><dd>{when(r.createdAt)}</dd>
            <dt className={dim}>Customer</dt><dd>{c.name}</dd>
            <dt className={dim}>Email</dt><dd className="break-all">{c.email}</dd>
            <dt className={dim}>Phone</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {c.phone}
              {digits && <>
                <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="underline">Call</a>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>
                <button type="button" onClick={() => copy(c.phone)} className="underline">Copy</button>
              </>}
            </dd>
            {(c.address || r.state || r.pin) && <><dt className={dim}>Address</dt><dd className="whitespace-pre-line">{[c.address, r.state, r.pin].filter(Boolean).join('\n')}</dd></>}
            {c.notes && <><dt className={dim}>Customer notes</dt><dd className="whitespace-pre-line">{c.notes}</dd></>}
            {r.request && (
              <>
                <dt className={dim}>Request</dt>
                <dd className="whitespace-pre-line">
                  {r.request.category}, {r.request.qtyBand}, deliver as {r.request.deliver}
                  {r.request.budget ? `, budget ${r.request.budget}` : ''}
                  {r.request.sizeMm ? `, size ${r.request.sizeMm.l ?? '?'} x ${r.request.sizeMm.w ?? '?'} x ${r.request.sizeMm.h ?? '?'} mm` : ''}
                  {r.request.extras ? `\nMoving parts or electronics: ${r.request.extras}` : ''}
                  {`\n${r.request.description}`}
                </dd>
              </>
            )}
          </dl>

          {r.items.length > 0 && (
            <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
              {r.items.map((it, i) => (
                <li key={i} className="rounded border border-gray-200 p-2 dark:border-gray-700">
                  <div className="font-medium">{it.qty} x {it.name}{it.kind ? <span className={`font-normal ${dim}`}> ({it.kind})</span> : null}{it.material ? `, ${it.material}` : ''}</div>
                  <div>
                    {it.review ? <strong>PRICE ON REVIEW: price by hand{it.reviewReason ? ` (${it.reviewReason})` : ''}</strong> : typeof it.total === 'number' ? `${money.format(it.unit ?? it.total)} each, line total ${money.format(it.total)}` : 'needs a manual quote'}
                  </div>
                  {it.config && <div className="whitespace-pre-line">Config: {it.config}</div>}
                  {it.cfg ? <div className="break-all font-mono text-xs">{JSON.stringify(it.cfg)}</div> : null}
                  {it.project && <div className={dim}>Design project {it.project}</div>}
                  {it.aiPrompt && <div>AI prompt: &quot;{it.aiPrompt}&quot;</div>}
                </li>
              ))}
            </ul>
          )}
          {r.type === 'order' && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Total: {r.total === null ? 'manual quote needed' : money.format(r.total)}{r.provisional ? ' (provisional)' : ''}
              {r.unpricedCount ? ` (${r.unpricedCount} line(s) still need a quote)` : ''}
            </p>
          )}

          {r.files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.files.map((f, i) => (
                <button key={f} type="button" onClick={() => void download(f)} className={secondaryBtn} aria-label={`Download file ${i + 1}: ${f}`} title={`Download file ${i + 1}: ${f}`}>
                  <Icon name="download" />File {i + 1}
                </button>
              ))}
            </div>
          )}

          <div>
            <label htmlFor={`note-${r.id}`} className={label}>Owner note (private, never shown to the customer)</label>
            <textarea id={`note-${r.id}`} rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => void saveNote()} disabled={busy || note === (r.ownerNote ?? '')} className={secondaryBtn}><Icon name="save" />Save note</button>
              <span className={`text-xs ${dim}`}>{note.length}/{NOTE_MAX}{r.ownerNoteAt ? `, saved ${when(r.ownerNoteAt)}` : ''}</span>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
