'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Icon from './Icon';
import { card, input, label, secondaryBtn, submitBtn } from './ContactFields';

// Owner AI settings: provider, preset, model, base URL. Keys are server env vars; this form never sends or shows one.
type Preset = { label: string; baseUrl: string; keyless: boolean; note: string };
type Effective = { provider: string | null; model: string | null; preset: string | null; baseUrl: string | null };
type Settings = { provider: string; preset?: string; model?: string; baseUrl?: string };
type Info = { stored: Settings | null; effective: Effective; keys: Record<string, boolean>; presets: Record<string, Preset>; cliAllowed: boolean; auto: { provider: string | null; model: string | null; label: string } };
type Model = { id: string; name?: string; vision: string };

export default function AdminAiSettings({ token }: { token: string }) {
  const id = useId();
  const [info, setInfo] = useState<Info | null>(null);
  const [provider, setProvider] = useState('auto');
  const [preset, setPreset] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState<Model[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(async (method: string, body?: unknown) => {
    const res = await fetch('/api/admin/ai', {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || `Failed (${res.status})`);
    return d;
  }, [token]);

  const fill = (s: Settings | null) => {
    setProvider(s?.provider ?? 'auto');
    setPreset(s?.preset ?? '');
    setModel(s?.model ?? '');
    setBaseUrl(s?.baseUrl ?? '');
  };

  useEffect(() => {
    call('GET').then((d: Info) => { setInfo(d); fill(d.stored); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [call]);

  const draft = (): Settings => provider === 'openai'
    ? { provider, ...(preset ? { preset } : {}), ...(model.trim() ? { model: model.trim() } : {}), ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}) }
    : { provider, ...(provider !== 'auto' && model.trim() ? { model: model.trim() } : {}) };

  const run = async (what: string, f: () => Promise<void>) => {
    setBusy(what);
    setMsg(null);
    try { await f(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(null); }
  };
  const save = () => run('save', async () => {
    const d = await call('PUT', draft());
    setInfo((i) => i && { ...i, stored: d.stored, effective: d.effective });
    setMsg({ ok: true, text: d.stored ? 'Saved. AI routes use this from the next request.' : 'Cleared. Env vars decide again.' });
  });
  const listModels = () => run('models', async () => {
    const d = await call('POST', { action: 'models', ...(provider === 'auto' ? {} : { settings: draft() }) });
    if (!d.ok) throw new Error(d.error);
    setModels(d.models);
    setMsg({ ok: true, text: `${d.models.length} model(s) listed.` });
  });
  const test = () => run('test', async () => {
    const d = await call('POST', { action: 'test', ...(provider === 'auto' ? {} : { settings: draft() }) });
    if (!d.ok) throw new Error(`Test failed: ${d.error}`);
    setMsg({ ok: true, text: `OK: ${d.provider} / ${d.model} answered in ${d.ms} ms.` });
  });

  if (!info) return msg ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{msg.text}</p> : null;
  const e = info.effective;
  const p = preset ? info.presets[preset] : null;

  return (
    <section aria-labelledby={`${id}-h`} className={card}>
      <h2 id={`${id}-h`} className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI settings</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        In effect: <strong>{e.provider ?? 'none (AI off)'}</strong>{e.model ? ` / ${e.model}` : ''}{e.baseUrl ? ` at ${e.baseUrl}` : ''}. {info.stored ? 'From these saved settings.' : 'From env vars.'}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300">Auto → <strong>{info.auto.label}</strong>. Auto tries Anthropic, then an OpenAI-compatible endpoint, then the Claude Code CLI (local only).</p>
      <ul className="flex flex-wrap gap-2 text-xs" aria-label="Server keys">
        {Object.entries(info.keys).map(([k, v]) => (
          <li key={k} className={`rounded-full px-2 py-1 font-mono ${v ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
            {k}: {v ? 'set' : 'missing'}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-prov`} className={label}>Provider</label>
          <select id={`${id}-prov`} value={provider} onChange={(ev) => { setProvider(ev.target.value); setModels(null); }} className={input}>
            <option value="auto">Auto (pick the first available)</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI-compatible</option>
            {info.cliAllowed && <option value="claude-cli">Claude Code CLI (local only)</option>}
          </select>
        </div>
        {provider === 'openai' && (
          <div>
            <label htmlFor={`${id}-preset`} className={label}>Preset</label>
            <select id={`${id}-preset`} value={preset} onChange={(ev) => { setPreset(ev.target.value); setModels(null); }} className={input}>
              <option value="">None (use base URL or env)</option>
              {Object.entries(info.presets).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {p && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{p.baseUrl}. {p.note}</p>}
          </div>
        )}
        {provider === 'openai' && (
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-url`} className={label}>Base URL override (optional)</label>
            <input id={`${id}-url`} type="url" inputMode="url" value={baseUrl} onChange={(ev) => setBaseUrl(ev.target.value)} placeholder="https://host/v1" className={input} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Production needs https on a public host. The key comes from AI_API_KEY.</p>
          </div>
        )}
        {provider !== 'auto' && (
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-model`} className={label}>Model</label>
            <div className="flex flex-wrap gap-2">
              {models && models.length > 0 && (
                <select aria-label="Pick a listed model" value={models.some((m) => m.id === model) ? model : ''} onChange={(ev) => ev.target.value && setModel(ev.target.value)} className={`${input} sm:max-w-xs`}>
                  <option value="">Pick from the list</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.id}{m.vision === 'yes' ? ' (vision)' : ''}</option>)}
                </select>
              )}
              <input id={`${id}-model`} value={model} onChange={(ev) => setModel(ev.target.value)} maxLength={120} placeholder="Type a model id, or leave empty for the default" className={`${input} min-w-0 flex-1`} />
              {provider !== 'claude-cli' && (
                <button type="button" onClick={() => void listModels()} disabled={!!busy} aria-label="List models" title="List models" className={secondaryBtn}><Icon name="search" />{busy === 'models' ? 'Listing' : 'List'}</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} disabled={!!busy} aria-label="Save AI settings" title="Save AI settings" className={submitBtn}><Icon name="save" />{busy === 'save' ? 'Saving' : 'Save'}</button>
        <button type="button" onClick={() => void test()} disabled={!!busy} aria-label="Test with one tiny real call" title="Test with one tiny real call" className={secondaryBtn}><Icon name="play" />{busy === 'test' ? 'Testing' : 'Test'}</button>
        <button type="button" onClick={() => fill(info.stored)} disabled={!!busy} aria-label="Undo unsaved changes" title="Undo unsaved changes" className={secondaryBtn}><Icon name="undo" />Undo</button>
      </div>
      <p role="status" aria-live="polite" className={`text-sm ${msg?.ok === false ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{msg?.text}</p>
    </section>
  );
}
