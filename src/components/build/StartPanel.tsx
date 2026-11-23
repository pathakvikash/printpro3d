'use client';
// Plan, first part: how the project starts. AI prompt (with one round of questions), template, STL upload (scale only) or Meshy (only when the site has it).
import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon, { type IconName } from '../Icon';
import { card, input, label, secondaryBtn, submitBtn } from '../ContactFields';
import { EXAMPLES } from '@/lib/examples';
import { defaultCfg, TEMPLATES, templateById } from '@/lib/templateDefs';
import { EMAIL_KEY, PROMPT_MAX, mapError, validEmail, type Caps, type ProjectView, type UiError } from '@/lib/buildFlow';
import { ApiError, api, type Created } from './api';
import { ErrorNote } from './ui';

const AiGenerate = dynamic(() => import('../AiGenerate'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p> });

type Tab = 'ai' | 'template' | 'upload' | 'meshy';
const TAB_LABEL: Record<Tab, [string, IconName]> = { ai: ['Plan with AI', 'bolt'], template: ['Start from template', 'grid'], upload: ['Upload a model', 'upload'], meshy: ['AI 3D model', 'cube'] };

const readEmail = () => { try { return localStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; } };

export default function StartPanel({ caps, initialPrompt, onProject }: { caps: Caps; initialPrompt: string; onProject: (p: ProjectView) => void }) {
  const id = useId();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(caps.ai ? 'ai' : 'template');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [email, setEmail] = useState(readEmail); // this tree is client-only (ssr: false), so reading storage in the initializer is safe
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState('');
  const [tpl, setTpl] = useState(TEMPLATES[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<UiError | null>(null);

  const run = async (go: () => Promise<Created>) => {
    setBusy(true);
    setErr(null);
    try {
      const out = await go();
      if (out.kind === 'questions') setQuestions(out.questions);
      else if (out.project) onProject(out.project);
    } catch (e) {
      setErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(500));
    } finally {
      setBusy(false);
    }
  };
  const remember = () => { try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch {} };
  const plan = (extra: Record<string, unknown> = {}) => { remember(); return run(() => api.create({ source: 'prompt', email: email.trim(), prompt: prompt.trim(), ...extra })); };
  const promptOk = prompt.trim().length >= 3 && validEmail(email);

  const fromModel = (file: string, origin?: 'meshy') => run(() => api.create({ source: 'mesh', file, ...(origin ? { origin } : {}) }));
  const tabs = (['ai', 'template', 'upload', 'meshy'] as Tab[]).filter((t) => (t === 'ai' ? caps.ai : t === 'meshy' ? caps.meshy : true));

  return (
    <section aria-labelledby={`${id}-h`} className={card}>
      <div>
        <h2 id={`${id}-h`} className="text-xl font-bold text-gray-900 dark:text-white">Start a design</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">We draw a plan first. You check the sizes, change what you want, approve it, and only then do we build the print file.</p>
      </div>

      <div role="group" aria-label="How to start" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => { setTab(t); setErr(null); }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${tab === t ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'}`}>
            <Icon name={TAB_LABEL[t][1]} />{TAB_LABEL[t][0]}
          </button>
        ))}
      </div>

      {!caps.ai && (
        <p className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          AI planning is not set up on this site. <Link href="/request" className="font-medium text-indigo-600 underline hover:no-underline dark:text-indigo-400">Describe your idea</Link> and we will review it and send you a quote.
        </p>
      )}

      {tab === 'ai' && caps.ai && !questions && (
        <form onSubmit={(e) => { e.preventDefault(); if (promptOk && !busy) void plan(); }} className="space-y-4">
          <div>
            <label htmlFor={`${id}-p`} className={label}>Describe the part</label>
            <textarea id={`${id}-p`} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={PROMPT_MAX} rows={4} required minLength={3} className={input}
              placeholder="A wall hook for a 20 mm pipe, two screw holes, 60 mm tall" aria-describedby={`${id}-c`} />
            <p id={`${id}-c`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{prompt.length} / {PROMPT_MAX} characters. Sizes in mm help.</p>
          </div>
          <div>
            <label htmlFor={`${id}-e`} className={label}>Your email (we send the quote here)</label>
            <input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" className={input} />
          </div>
          <ErrorNote err={err} />
          <button type="submit" disabled={!promptOk || busy} className={submitBtn}><Icon name="bolt" />{busy ? 'Planning…' : 'Plan with AI'}</button>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI can get sizes wrong. That is why you approve the plan before anything is built.</p>
        </form>
      )}

      {tab === 'ai' && caps.ai && questions && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">A few questions before we draw it:</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">{questions.map((q) => <li key={q}>{q}</li>)}</ol>
          <div>
            <label htmlFor={`${id}-a`} className={label}>Your answers</label>
            <textarea id={`${id}-a`} value={answers} onChange={(e) => setAnswers(e.target.value)} maxLength={PROMPT_MAX} rows={3} className={input} />
          </div>
          <ErrorNote err={err} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" disabled={busy || answers.trim().length < 3} onClick={() => plan({ answers: answers.trim() })} className={`${submitBtn} sm:w-auto`}><Icon name="check" />{busy ? 'Planning…' : 'Send answers'}</button>
            <button type="button" disabled={busy} onClick={() => plan({ skip: true })} className={secondaryBtn}><Icon name="arrow" />Skip, use your best guess</button>
            <button type="button" disabled={busy} onClick={() => { setQuestions(null); setErr(null); }} className={secondaryBtn}><Icon name="undo" />Edit my description</button>
          </div>
        </div>
      )}

      {tab === 'template' && (
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-t`} className={label}>Template</label>
            <select id={`${id}-t`} value={tpl} onChange={(e) => setTpl(e.target.value)} className={input}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{templateById(tpl)?.blurb}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">It starts with the default settings. You change sizes in the next step.</p>
          </div>
          <ErrorNote err={err} />
          <button type="button" disabled={busy || !templateById(tpl)} onClick={() => run(() => api.create({ source: 'template', template: tpl, cfg: defaultCfg(templateById(tpl)!) }))} className={submitBtn}>
            <Icon name="grid" />{busy ? 'Starting…' : 'Start from this template'}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Or open an example in the free builder:{' '}
            {EXAMPLES.slice(0, 4).map((x, i) => (
              <span key={x.id}>{i > 0 && ', '}<Link href={`/build?example=${x.id}`} className="underline hover:no-underline">{x.title}</Link></span>
            ))}.
          </p>
        </div>
      )}

      {tab === 'upload' && (
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-f`} className={label}>STL file</label>
            <input id={`${id}-f`} type="file" accept=".stl,model/stl" disabled={busy} className={input}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(async () => api.create({ source: 'mesh', file: await api.upload(f) }));
                e.target.value = '';
              }} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">An uploaded model can only be scaled, not redrawn. Other file types: use <Link href="/quote" className="underline hover:no-underline">Get a quote</Link>.</p>
          </div>
          {busy && <p role="status" className="text-sm text-indigo-700 dark:text-indigo-300">Uploading…</p>}
          <ErrorNote err={err} />
        </div>
      )}

      {tab === 'meshy' && caps.meshy && (
        <div className="space-y-3">
          <ErrorNote err={err} />
          <AiGenerate onDesigner={() => router.push('/request')} onModel={(file) => void fromModel(file, 'meshy')} />
        </div>
      )}
    </section>
  );
}
