'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { label, secondaryBtn, submitBtn } from './ContactFields';

const MAX_TEXT = 600;
const MAX_IMG = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const STORE_KEY = 'printpro3d.aidesign.v1';
const GENERIC = 'The AI service did not answer. Try again.';
const panel = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-6 space-y-5';
const field =
  'w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type Phase = 'form' | 'busy' | 'failed';

export default function AiDesign({ onDesigner }: { onDesigner: () => void }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);

  const urlRef = useRef<string | null>(null); // the live thumbnail URL, revoked on change and unmount
  useEffect(() => () => {
    ctl.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const setFile = (f: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setPhoto(f && urlRef.current ? { file: f, url: urlRef.current } : null);
  };
  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };
  const pick = (f: File | undefined) => {
    setFileError(null);
    if (!f) return clearFile();
    if (!TYPES.includes(f.type)) { clearFile(); return setFileError('The photo must be png, jpg or webp.'); }
    if (f.size > MAX_IMG) { clearFile(); return setFileError('The photo must be 5 MB or smaller.'); }
    setFile(f);
  };

  const fail = (m: string) => { setError(m); setPhase('failed'); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase !== 'form') return;
    const file = photo?.file ?? null;
    const prompt = text.trim();
    if (!prompt && !file) return setError('Describe your part or add a photo.');
    if (!validEmail(email)) return setError('Enter a valid email address.');
    setError(null);

    const fd = new FormData();
    fd.append('email', email.trim());
    const trap = new FormData(e.currentTarget).get('website');
    if (typeof trap === 'string' && trap) fd.append('website', trap);
    if (prompt) fd.append('prompt', prompt);
    if (file) fd.append('image', file);
    const c = new AbortController();
    ctl.current = c;
    setPhase('busy');
    try {
      const res = await fetch('/api/design', { method: 'POST', body: fd, signal: c.signal });
      const d: unknown = await res.json().catch(() => null);
      if (c.signal.aborted) return setPhase('form'); // Cancel after the body was read: stay on the form
      const body = d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
      if (!res.ok) return fail(typeof body.error === 'string' && body.error ? body.error : res.status === 413 ? 'The photo is too large to send. Try a smaller one.' : GENERIC);
      if (!Array.isArray(body.shapes)) return fail(GENERIC);
      const payload = {
        title: typeof body.title === 'string' ? body.title : '',
        notes: typeof body.notes === 'string' ? body.notes : '',
        shapes: body.shapes,
        source: file ? 'photo' : 'description',
      };
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(payload));
      } catch {
        return fail('We could not open the builder in this browser. Try again, or send your idea to our designer.');
      }
      router.push('/build?from=ai'); // stays busy until the page changes
    } catch {
      if (!c.signal.aborted) fail(GENERIC); // an abort (Cancel or unmount) is silent
    }
  };

  const cancel = () => { ctl.current?.abort(); setPhase('form'); };
  const retry = () => { setError(null); setPhase('form'); };
  const canSend = (text.trim() !== '' || photo !== null) && email.trim() !== '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Draw it with AI</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Describe the part, add a photo, or both. We draw a simple 3D model in the builder so you can check, edit and price it.
        </p>
      </div>

      <p className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        AI drawings are a starting point for simple parts: brackets, cases, stands, toy heads. They are not for characters or organic shapes. Check every size before you order. No weapons.
      </p>

      {/* kept mounted (hidden) so typed values and the chosen photo survive Cancel and Try again */}
      <form onSubmit={submit} noValidate hidden={phase !== 'form'} className={panel}>
        {/* honeypot: people never see or fill it, form-filling bots do; the server then drops the submission */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={`${id}-website`}>Leave this field empty</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${id}-text`} className={label}>Describe the part (optional if you add a photo)</label>
          <textarea
            id={`${id}-text`}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            maxLength={MAX_TEXT}
            rows={4}
            aria-describedby={`${id}-count`}
            className={field}
          />
          <p id={`${id}-count`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{text.length} / {MAX_TEXT}</p>
        </div>

        <div>
          <label htmlFor={`${id}-img`} className={label}>Photo of the part (optional)</label>
          <input
            ref={fileInput}
            id={`${id}-img`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => pick(e.target.files?.[0])}
            aria-describedby={`${id}-imghint`}
            className={`${field} text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-gray-800 dark:file:bg-gray-800 dark:file:text-gray-100`}
          />
          <p id={`${id}-imghint`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">png, jpg or webp, up to 5 MB.</p>
          {fileError && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{fileError}</p>}
          {photo && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div
                role="img"
                aria-label="Preview of your photo"
                style={{ backgroundImage: `url("${photo.url}")` }}
                className="h-24 w-32 max-w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-contain bg-center bg-no-repeat"
              />
              <button type="button" onClick={clearFile} className={secondaryBtn}>Remove photo</button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-email`} className={label}>Email for your quote</label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={!canSend} className={submitBtn}>Draw it</button>
      </form>

      {phase === 'busy' && (
        <div className={panel}>
          <p role="status" className="font-medium text-gray-900 dark:text-gray-100">Drawing your model… this takes up to a minute</p>
          <button type="button" onClick={cancel} className={secondaryBtn}>Cancel</button>
        </div>
      )}

      {phase === 'failed' && (
        <div className={panel}>
          <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={retry} className={secondaryBtn}>Try again</button>
            <button type="button" onClick={onDesigner} className={secondaryBtn}>Send this to our designer instead</button>
          </div>
        </div>
      )}
    </div>
  );
}
