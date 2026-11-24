'use client';

// "Build with AI": a chat over the existing design pipeline (/api/design). Each turn returns a shape model with a live preview;
// a follow-up edits the last design (the server re-validates the shapes we send back). Meshy (organic, paid) is the labelled alternative.
// Loaded only on demand (AiChatLauncher, /ai), so none of this or three.js is in any page's first load.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { AI_DRAFT_KEY, CHAT_KEY, EMAIL_KEY, MAX_TEXT, NEW_MARK, addMsg, designFields, draftFor, lastDesign, parseHistory, replyMsg, validEmail, type ChatMsg } from '@/lib/aiChat';

const ExamplePreview = dynamic(() => import('./ExamplePreview'), { ssr: false, loading: () => <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading preview…</p> });
const AiGenerate = dynamic(() => import('./AiGenerate'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p> });

const GENERIC = 'The AI service did not answer. Try again.';
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMG = 5 * 1024 * 1024;
const COMPACT_IDEAS = ['Make it 10 mm taller', 'Add two M3 holes', 'Make it 20% wider'];
const IDEAS = ['A wall hook for a backpack', 'A stand for my phone at 60 degrees', 'A box 80 x 50 x 30 mm with a lid'];
const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-500';
const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
const field = 'w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const store = {
  get: (s: Storage | undefined, k: string) => { try { return s?.getItem(k) ?? null; } catch { return null; } },
  set: (s: Storage | undefined, k: string, v: string) => { try { s?.setItem(k, v); return true; } catch { return false; } },
};
const ss = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);
const ls = () => (typeof window === 'undefined' ? undefined : window.localStorage);
const newId = () => Math.random().toString(36).slice(2, 10);

type Caps = { ai: boolean; meshy: boolean };

/** Builder sidebar mode: the chat edits `base` (the builder's current design); a proposal is previewed Before / After and only `onApply` changes the design. */
type Shape = NonNullable<ChatMsg['shapes']>[number];
export type Compact = { base: Shape[]; onApply: (shapes: Shape[]) => void };

/** The chat itself. `onLeave` runs before navigating away (the dialog closes). */
export function AiChat({ onLeave, titleId, compact }: { onLeave?: () => void; titleId?: string; compact?: Compact }) {
  const router = useRouter();
  const id = useId();
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => (compact ? [] : parseHistory(store.get(ss(), CHAT_KEY))));
  const [text, setText] = useState('');
  const [email, setEmail] = useState(() => store.get(ls(), EMAIL_KEY) ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [caps, setCaps] = useState<Caps | null>(null);
  const [mode, setMode] = useState<'shapes' | 'meshy'>('shapes');
  const [reduce] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ctl = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const trap = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'after' | 'before'>('after');
  const last = lastDesign(msgs);
  const refineShapes = compact ? (last?.shapes ?? compact.base) : last?.shapes;
  const target = compact ? (refineShapes?.length ? (last ?? ({ id: 'base', role: 'assistant', text: '' } as ChatMsg)) : null) : last;

  useEffect(() => { if (!compact) store.set(ss(), CHAT_KEY, JSON.stringify(msgs)); end.current?.scrollIntoView({ block: 'end' }); }, [msgs, compact]);
  useEffect(() => {
    fetch('/api/designs').then((r) => r.json()).then((d) => setCaps({ ai: !!d.ai, meshy: !!d.meshy })).catch(() => setCaps({ ai: true, meshy: false }));
    return () => ctl.current?.abort();
  }, []);

  const pick = (f: File | undefined) => {
    setNote(null);
    if (!f) return setPhoto(null);
    if (!TYPES.includes(f.type) || f.size > MAX_IMG) { if (fileInput.current) fileInput.current.value = ''; return setNote('The photo must be png, jpg or webp, up to 5 MB.'); }
    setPhoto(f);
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const prompt = text.trim();
    if (compact && !refineShapes?.length) return setNote('Add a shape in the builder first.');
    if (!prompt && !photo) return setNote(target ? 'Say what to change.' : 'Describe what you want, or add a photo.');
    if (!validEmail(email)) return setNote('Enter your email first: we use it for your quote and the daily AI limit.');
    setNote(null);
    store.set(ls(), EMAIL_KEY, email.trim());
    const fd = new FormData();
    for (const [k, v] of designFields({ email, prompt, refine: refineShapes, trap: trap.current?.value })) fd.append(k, v);
    if (photo) fd.append('image', photo);
    setView('after');
    setMsgs((m) => addMsg(m, { id: newId(), role: 'user', text: prompt || '(photo)', ...(photo ? { photo: true } : {}) }));
    setText('');
    setPhoto(null);
    if (fileInput.current) fileInput.current.value = '';
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    try {
      const res = await fetch('/api/design', { method: 'POST', body: fd, signal: c.signal });
      const d: unknown = await res.json().catch(() => null);
      setMsgs((m) => addMsg(m, replyMsg(newId(), res.ok, d, res.status === 413 ? 'The photo is too large to send. Try a smaller one.' : GENERIC)));
    } catch {
      if (!c.signal.aborted) setMsgs((m) => addMsg(m, { id: newId(), role: 'assistant', error: true, text: GENERIC }));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const openBuilder = (m: ChatMsg, price: boolean) => {
    if (!store.set(ss(), AI_DRAFT_KEY, draftFor(m, msgs.some((x) => x.photo)))) return setNote('This browser blocked storage, so the builder cannot open the design.');
    onLeave?.();
    router.push(`/playground?mode=build&from=ai${price ? '&price=1' : ''}`);
  };
  const refine = () => { setNote(null); input.current?.focus(); };
  const reset = () => { ctl.current?.abort(); setMsgs((m) => (m.length ? addMsg(m, { id: newId(), role: 'assistant', text: NEW_MARK }) : m)); setText(''); };
  const clearAll = () => { ctl.current?.abort(); setMsgs([]); };
  const apply = (m: ChatMsg) => { if (m.shapes) compact?.onApply(m.shapes); setMsgs([]); };
  const discard = () => { setMsgs([]); setView('after'); };
  const latestId = [...msgs].reverse().find((m) => m.shapes)?.id;

  if (compact && caps && !caps.ai) return <p role="status" className="p-4 text-sm text-gray-700 dark:text-gray-200">AI is not set up yet. The rest of the builder still works.</p>;

  return (
    <div className={compact ? 'flex max-h-[min(60vh,520px)] min-h-0 flex-col' : 'flex h-full min-h-0 flex-col'}>
      {!compact && <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 id={titleId} className="mr-auto text-base font-semibold text-gray-900 dark:text-white">Build with AI</h2>
        <button type="button" onClick={reset} disabled={busy} aria-label="Start a new design" title="Start a new design" className={btn}><Icon name="plus" />New</button>
        <button type="button" onClick={clearAll} disabled={busy || !msgs.length} aria-label="Clear the chat" title="Clear the chat" className={btn}><Icon name="trash" />Clear</button>
      </div>}

      {!compact && caps?.meshy && (
        <div role="tablist" aria-label="How to build" className="flex gap-1 border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
          {(['shapes', 'meshy'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
              className={`rounded-lg px-3 py-1.5 font-medium ${mode === k ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
              {k === 'shapes' ? 'Simple parts (editable)' : 'Organic 3D (Meshy)'}
            </button>
          ))}
        </div>
      )}

      {!compact && mode === 'meshy' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            For organic shapes (figures, animals, sculpted things). It makes a mesh you cannot edit as shapes; each try counts toward the daily AI limit.
          </p>
          <AiGenerate onDesigner={() => { onLeave?.(); router.push('/request'); }} />
        </div>
      ) : (
        <>
          <div role="log" aria-live="polite" aria-relevant="additions" aria-busy={busy} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              {compact ? 'Say what to change on this design, with sizes if you know them. You see a before and after first; nothing changes until you press Apply.' : 'Tell me the part you need, with sizes if you know them, or add a photo. I draw it from simple shapes; you can refine it here, edit it in the builder, then price it.'}
              {caps && !caps.ai && <span className="mt-1 block font-medium">AI drawing is not available right now. <a href="/request" className="underline">Describe your idea</a> and we quote it.</span>}
              {!msgs.length && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {(compact ? COMPACT_IDEAS : IDEAS).map((t) => <button key={t} type="button" onClick={() => { setText(t); input.current?.focus(); }} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">{t}</button>)}
                </span>
              )}
            </div>
            {msgs.map((m) => m.role === 'user' ? (
              <p key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white">{m.photo && <span className="mr-1 text-indigo-200">[photo]</span>}{m.text}</p>
            ) : (
              <div key={m.id} className={`max-w-[95%] space-y-2 rounded-2xl px-3 py-2 text-sm ${m.error ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
                {m.title && <p className="font-semibold">{m.title}</p>}
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.shapes && m.id === latestId && (
                  <div className={`${compact ? 'h-44' : 'h-56'} overflow-hidden rounded-xl bg-white dark:bg-gray-950`}>
                    <ExamplePreview shapes={compact && view === 'before' ? compact.base : m.shapes} reduceMotion={reduce} />
                  </div>
                )}
                {compact && m.shapes && m.id === latestId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div role="group" aria-label="Preview" className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                      {(['before', 'after'] as const).map((v) => (
                        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100'}`}>{v === 'before' ? 'Before' : 'After'}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => apply(m)} aria-label="Apply this change" title="Apply this change" className={primary}><Icon name="check" />Apply</button>
                    <button type="button" onClick={discard} aria-label="Discard this change" title="Discard this change" className={btn}><Icon name="x" />Discard</button>
                  </div>
                )}
                {!compact && m.shapes && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openBuilder(m, false)} aria-label="Open in the builder" title="Open in the builder" className={btn}><Icon name="edit" />Edit</button>
                    {m.id === latestId && <button type="button" onClick={refine} aria-label="Refine this design" title="Refine this design" className={btn}><Icon name="redo" />Refine</button>}
                    <button type="button" onClick={() => openBuilder(m, true)} aria-label="Price it and add to cart" title="Price it and add to cart" className={primary}><Icon name="cart" />Price</button>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div role="status" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                Drawing… this takes up to a minute
                <button type="button" onClick={() => ctl.current?.abort()} aria-label="Cancel" title="Cancel" className={btn}><Icon name="x" />Cancel</button>
              </div>
            )}
            <div ref={end} />
          </div>

          <form onSubmit={send} noValidate className="space-y-2 border-t border-gray-200 p-3 dark:border-gray-800">
            {/* honeypot: people never see or fill it */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={`${id}-website`}>Leave this field empty</label>
              <input ref={trap} id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            {!validEmail(store.get(ls(), EMAIL_KEY) ?? '') && (
              <div>
                <label htmlFor={`${id}-email`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Email for your quote</label>
                <input id={`${id}-email`} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
            )}
            {photo && (
              <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                Photo: <span className="truncate">{photo.name}</span>
                <button type="button" onClick={() => pick(undefined)} aria-label="Remove photo" title="Remove photo" className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><Icon name="x" /></button>
              </p>
            )}
            {note && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{note}</p>}
            <label htmlFor={`${id}-text`} className="sr-only">{target ? 'What should change?' : 'Describe what you want'}</label>
            <textarea
              ref={input} id={`${id}-text`} rows={2} value={text} maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={target ? 'What should change? e.g. make it 20 mm taller' : compact ? 'Add a shape first' : 'Describe the part you need'}
              className={field}
            />
            <div className="flex items-center gap-2">
              <input ref={fileInput} id={`${id}-img`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              {!compact && <label htmlFor={`${id}-img`} aria-label="Attach a photo" title="Attach a photo" className={`${btn} cursor-pointer`}><Icon name="upload" />Photo</label>}
              <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">{text.length}/{MAX_TEXT}</span>
              <button type="submit" disabled={busy || (!text.trim() && !photo)} aria-label={target ? 'Send the change' : 'Send'} title={target ? 'Send the change' : 'Send'} className={primary}><Icon name="arrow" />{target ? 'Refine' : 'Send'}</button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Simple printable parts only, no weapons. Check every size before you order. A few AI tries per day.</p>
          </form>
        </>
      )}
    </div>
  );
}

/** Modal panel (desktop) / full-screen sheet (phone) with a focus trap; Escape or the close button closes and returns focus. */
export default function AiChatDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (box.current?.querySelector<HTMLElement>('textarea') ?? box.current?.querySelector<HTMLElement>('button'))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input:not([tabindex="-1"]), select, label[for], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !box.current.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.(); };
  }, [close]);

  return (
    <div className="fixed inset-0 z-[55]">
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-black/30" />
      <div
        ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="absolute inset-0 flex flex-col bg-white dark:bg-gray-900 md:inset-auto md:bottom-4 md:right-4 md:h-[min(760px,calc(100vh-2rem))] md:w-[440px] md:rounded-2xl md:border md:border-gray-200 md:shadow-2xl md:dark:border-gray-700"
      >
        <button type="button" onClick={close} aria-label="Close the AI chat" title="Close the AI chat"
          className="absolute right-2 top-2 z-10 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="x" className="h-5 w-5" /></button>
        <div className="min-h-0 flex-1 pr-0 [&>div>div:first-child]:pr-12">
          <AiChat onLeave={close} titleId={titleId} />
        </div>
      </div>
    </div>
  );
}
