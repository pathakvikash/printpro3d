'use client';

import { useEffect, useState } from 'react';
import { card, input, label, submitBtn } from './ContactFields';
import AdminAiSettings from './AdminAiSettings';

// Same token slot as /admin. Outside production the API needs no token, so the first probe (no header) opens the settings; in production it returns 401 and we ask for the token.
const KEY = 'printpro3d.admin';
const read = () => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const write = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch {} };

export default function AiSettingsAccess() {
  const [token, setToken] = useState<string | null>(null); // null = not unlocked
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const probe = async (t: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai', { cache: 'no-store', headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 401) write('');
        throw new Error(res.status === 503 ? 'Admin is off: ADMIN_TOKEN is not set on this server.' : t || res.status !== 401 ? d.error || 'Could not open' : '');
      }
      if (t) write(t);
      setToken(t);
    } catch (e) {
      setToken(null);
      setError(e instanceof Error && e.message ? e.message : null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void probe(read()); }, []);

  if (token !== null) return <AdminAiSettings token={token} />;
  if (busy) return <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Loading</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void probe(typed); }} className={`${card} max-w-md`}>
      <div>
        <label htmlFor="ai-admin-token" className={label}>Admin token</label>
        <input id="ai-admin-token" type="password" autoComplete="off" required value={typed} onChange={(e) => setTyped(e.target.value)} className={input} />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">AI settings need the admin token on the live site (the same one as /admin).</p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy || !typed} className={submitBtn}>Open</button>
    </form>
  );
}
