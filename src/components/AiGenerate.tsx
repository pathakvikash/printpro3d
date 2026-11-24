'use client';

import { useEffect, useState } from 'react';
import ModelViewer from './ModelViewer';
import QuoteOrder from './QuoteOrder';
import Icon from './Icon';
import { ContactFields, card, input, label, submitBtn } from './ContactFields';
import { BED_MM, type MeshStats } from '@/lib/quote';

const POLL_MS = 5000;
const GIVE_UP_MS = 10 * 60 * 1000;
const MAX_IMG = 5 * 1024 * 1024;
const MAX_MM = Math.max(BED_MM.x, BED_MM.y, BED_MM.z);
const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap py-2.5 px-5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:border-indigo-500';

type Phase = 'form' | 'working' | 'failed' | 'ready' | 'quote';
type Sized = { url: string; file: string; stats: MeshStats | null };

/** onModel: the Build page's Plan step takes the sized model as a scale-only project instead of quoting it here. */
export default function AiGenerate({ onDesigner, onModel }: { onDesigner: () => void; onModel?: (file: string) => void }) {
  const [phase, setPhase] = useState<Phase>('form');
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState<{ file: string; url: string } | null>(null);
  const [mm, setMm] = useState(80);
  const [sized, setSized] = useState<Sized | null>(null);

  // poll while working; the cleanup stops it on unmount, cancel and back
  useEffect(() => {
    if (phase !== 'working' || !jobId) return;
    const ctl = new AbortController();
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const fail = (m: string) => { setError(m); setPhase('failed'); };
    const tick = async () => {
      if (Date.now() - start > GIVE_UP_MS) return fail('This is taking too long. Please try again.');
      try {
        const res = await fetch(`/api/generate/${jobId}`, { signal: ctl.signal });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return fail(d.error || 'Something went wrong. Please try again.');
        if (d.state === 'ready') { setModel({ file: d.file, url: d.url }); return setPhase('ready'); }
        if (d.state === 'failed') return fail(d.message || 'We could not make that model.');
        setProgress(Number(d.progress) || 0);
      } catch {
        if (ctl.signal.aborted) return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [phase, jobId]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const body = new FormData(e.currentTarget);
    const img = body.get('image');
    if (mode === 'image' && img instanceof File && (!/\.(png|jpe?g|webp)$/i.test(img.name) || img.size > MAX_IMG)) {
      return setError('The photo must be png, jpg or webp, up to 5MB.');
    }
    if (mode === 'text') body.delete('image'); else body.delete('prompt');
    setBusy(true);
    try {
      const res = await fetch('/api/generate', { method: 'POST', body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || (res.status === 413 ? 'The photo is too large to send. Try a smaller one.' : res.statusText || 'Request failed'));
      setJobId(d.id);
      setProgress(0);
      setPhase('working');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const useSize = async () => {
    if (!jobId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/generate/${jobId}/size`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longestMm: mm }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || res.statusText || 'Could not resize');
      setSized({ url: d.url, file: d.file, stats: d.stats });
      setPhase('quote');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resize');
    } finally {
      setBusy(false);
    }
  };

  const again = () => { setPhase('form'); setError(null); setModel(null); setSized(null); setJobId(null); };
  const validMm = Number.isFinite(mm) && mm >= 10 && mm <= MAX_MM;

  return (
    <div className="space-y-6">
      {/* kept mounted (hidden) so typed values survive Try again */}
      <form onSubmit={submit} className={card} hidden={phase !== 'form'}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Generate a 3D model with AI</h3>

        <fieldset>
          <legend className={label}>Start from</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {([['text', 'A description'], ['image', 'A photo']] as const).map(([v, l]) => (
              <label key={v} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'text' ? (
          <div>
            <label htmlFor="prompt" className={label}>Describe your model</label>
            <textarea id="prompt" name="prompt" required minLength={3} maxLength={400} rows={4} className={input}
              placeholder="A small dragon sitting on a rock" />
          </div>
        ) : (
          <div>
            <label htmlFor="image" className={label}>Photo (png, jpg or webp, up to 5MB)</label>
            <input id="image" name="image" type="file" required accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className={input} />
          </div>
        )}

        <ContactFields address={false} notes={false} />

        <p className="text-sm text-gray-600 dark:text-gray-300">
          AI models are a starting point. We check every model before printing and may suggest changes. Don&apos;t request weapons or characters and brands you don&apos;t own.
        </p>
        {phase === 'form' && error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={busy} aria-label="Generate model" title="Generate model" className={submitBtn}><Icon name="bolt" />{busy ? 'Starting' : 'Generate'}</button>
      </form>

      {phase === 'working' && (
        <div className={card}>
          <p role="status" className="font-medium text-gray-900 dark:text-gray-100">
            Generating your model… {progress > 0 ? `${progress}%` : 'waiting in the queue'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">This usually takes a minute or two. Keep this page open.</p>
          <button type="button" onClick={again} className={secondary}><Icon name="x" />Cancel</button>
        </div>
      )}

      {phase === 'failed' && (
        <div className={card}>
          <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { setPhase('form'); setError(null); }} aria-label="Try again" title="Try again" className={secondary}><Icon name="reset" />Retry</button>
            <button type="button" onClick={onDesigner} aria-label="Send this to our designer instead" title="Send this to our designer instead" className={secondary}><Icon name="user" />Designer</button>
          </div>
        </div>
      )}

      {phase === 'ready' && model && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your model</h3>
          <div className="h-[400px] rounded-xl overflow-hidden"><ModelViewer url={model.url} /></div>
          <div className={card}>
            <label htmlFor="longest" className={label}>Longest side (mm)</label>
            <input id="longest" type="number" min={10} max={MAX_MM} step="any" value={Number.isNaN(mm) ? '' : mm}
              onChange={(e) => setMm(e.target.valueAsNumber)} className={input} />
            <p className="text-sm text-gray-500 dark:text-gray-400">Between 10 and {MAX_MM} mm. Preparing the model can take a few minutes.</p>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={useSize} disabled={busy || !validMm} aria-label="Use this size" title="Use this size" className={`${submitBtn} sm:w-auto`}>
                <Icon name="check" />{busy ? 'Preparing' : 'Apply'}
              </button>
              <button type="button" onClick={again} aria-label="Generate another" title="Generate another" className={secondary}><Icon name="reset" />Again</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'quote' && sized && (
        <div className="space-y-4">
          <div className="h-[400px] rounded-xl overflow-hidden"><ModelViewer url={sized.url} /></div>
          {onModel ? (
            <button type="button" onClick={() => onModel(sized.file)} aria-label="Plan with this model" title="Plan with this model" className={`${submitBtn} sm:w-auto`}><Icon name="arrow" />Plan</button>
          ) : (
            <QuoteOrder key={sized.file} file={sized.file} stats={sized.stats} label="AI-generated model" />
          )}
          <button type="button" onClick={again} aria-label="Generate another" title="Generate another" className={secondary}><Icon name="reset" />Again</button>
        </div>
      )}
    </div>
  );
}
