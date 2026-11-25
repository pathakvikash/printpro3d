'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';
import AdminAiSettings from './AdminAiSettings';

// The admin token lives in sessionStorage only (gone when the tab closes) and goes out as an Authorization header, never in a URL.
const KEY = 'printpro3d.admin';
const read = () => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const write = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch {} };

type Item = { name: string; qty: number; material?: string; total?: number | null; file?: string; aiPrompt?: string; review?: boolean };
type Rec = {
  type: 'order' | 'request';
  id: string;
  createdAt: string;
  status: string;
  total: number | null;
  currency: string;
  unpricedCount: number | null;
  provisional?: boolean;
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

  const load = useCallback(async (t: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) write('');
        throw new Error(res.status === 503 ? 'Admin is off: ADMIN_TOKEN is not set on this server.' : d.error || 'Could not load');
      }
      write(t);
      setToken(t);
      setRecords(d.records);
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
        <p className="text-sm text-gray-600 dark:text-gray-300">{records.length} record(s), newest first</p>
      </div>
      <AdminAiSettings token={token} />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {records.map((r) => (
        <Row key={`${r.type}-${r.id}`} r={r} token={token} statuses={statuses} onSaved={(status) => setRecords((all) => all && all.map((x) => (x === r ? { ...x, status } : x)))} />
      ))}
      {records.length === 0 && <p className="text-gray-600 dark:text-gray-300">Nothing yet.</p>}
    </div>
  );
}

function Row({ r, token, statuses, onSaved }: { r: Rec; token: string; statuses: Statuses; onSaved: (status: string) => void }) {
  const [status, setStatus] = useState(r.status);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const options = statuses[r.type].includes(r.status) ? statuses[r.type] : [r.status, ...statuses[r.type]]; // an unknown stored status stays selectable

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, status, type: r.type }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save');
      onSaved(status);
      setMsg({ ok: true, text: d.emailed ? 'Saved. The customer was emailed.' : 'Saved. No email sent.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

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
  return (
    <article className={card} aria-label={`${r.type} ${r.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          {r.type === 'order' ? 'Order' : 'Design request'} <code className="break-all text-sm font-normal">{r.id}</code>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{when(r.createdAt)}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={sid} className={label}>Status</label>
          <select id={sid} value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            {options.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => void save()} disabled={busy || status === r.status} aria-label="Save status" title="Save status" className={secondaryBtn}><Icon name="save" />{busy ? 'Saving' : 'Save'}</button>
      </div>
      <p role="status" className={`text-sm ${msg?.ok === false ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{msg?.text}</p>

      <dl className="grid gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-200 sm:grid-cols-[8rem_1fr]">
        <dt className="text-gray-500 dark:text-gray-400">Customer</dt><dd>{c.name}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Email</dt><dd className="break-all">{c.email}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Phone</dt><dd>{c.phone}</dd>
        {c.address && <><dt className="text-gray-500 dark:text-gray-400">Address</dt><dd className="whitespace-pre-line">{c.address}</dd></>}
        {c.notes && <><dt className="text-gray-500 dark:text-gray-400">Notes</dt><dd className="whitespace-pre-line">{c.notes}</dd></>}
        {r.request && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">Request</dt>
            <dd className="whitespace-pre-line">
              {r.request.category}, {r.request.qtyBand}, deliver as {r.request.deliver}
              {r.request.budget ? `, budget ${r.request.budget}` : ''}
              {r.request.extras ? `\nMoving parts or electronics: ${r.request.extras}` : ''}
              {`\n${r.request.description}`}
            </dd>
          </>
        )}
      </dl>

      {r.items.length > 0 && (
        <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
          {r.items.map((it, i) => (
            <li key={i}>
              {it.qty} x {it.name}{it.material ? `, ${it.material}` : ''}:{' '}
              {it.review ? 'PRICE ON REVIEW: price by hand' : typeof it.total === 'number' ? money.format(it.total) : 'needs a manual quote'}
              {it.aiPrompt ? ` (AI prompt: "${it.aiPrompt}")` : ''}
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
    </article>
  );
}
