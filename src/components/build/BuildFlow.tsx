'use client';
// The Build page: Plan > Approve > Build > Order for a design project, or the free-form builder when there is none.
// The project id lives in localStorage so a reload resumes it. The server is the source of truth for status; this only mirrors it.
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '../Icon';
import { secondaryBtn } from '../ContactFields';
import {
  PROJECT_KEY, STEP_LABEL, currentRevision, defaultStep, mapError, parseStoredId, prefillPrompt, settleStep, stepAllowed, stepViews,
  type Caps, type ProjectView, type Step, type UiError,
} from '@/lib/buildFlow';
import { DESIGNS_KEY, parseDesigns, removeDesign, upsertDesign, type DesignEntry } from '@/lib/designList';
import type { MeshStats } from '@/lib/quote';
import { ApiError, api } from './api';
import Stepper from './Stepper';
import StartPanel from './StartPanel';
import { ErrorNote } from './ui';

const Note = ({ t }: { t: string }) => <p role="status" className="text-center text-sm text-gray-500 dark:text-gray-400">{t}</p>;
const note = (t: string) => function Loading() { return <Note t={t} />; };
const PlanStep = dynamic(() => import('./PlanStep'), { ssr: false, loading: note('Loading the plan…') });
const ApproveStep = dynamic(() => import('./FinishSteps').then((m) => m.ApproveStep), { ssr: false, loading: note('Loading…') });
const BuildStep = dynamic(() => import('./FinishSteps').then((m) => m.BuildStep), { ssr: false, loading: note('Loading the builder…') });
const OrderStep = dynamic(() => import('./FinishSteps').then((m) => m.OrderStep), { ssr: false, loading: note('Loading…') });
const Playground = dynamic(() => import('../Playground'), { ssr: false, loading: note('Loading the builder…') });

const readId = () => { try { return parseStoredId(localStorage.getItem(PROJECT_KEY)); } catch { return null; } };
// PROJECT_KEY points at the design this browser reopens; DESIGNS_KEY lists every design it has opened (the old single id is migrated into it).
const readList = () => { try { return parseDesigns(localStorage.getItem(DESIGNS_KEY), localStorage.getItem(PROJECT_KEY)); } catch { return []; } };
const writeList = (l: DesignEntry[]) => { try { localStorage.setItem(DESIGNS_KEY, JSON.stringify(l)); } catch {} };
const writeId = (id: string | null, title = '') => {
  try {
    if (id) { localStorage.setItem(PROJECT_KEY, id); writeList(upsertDesign(readList(), id, title)); } else localStorage.removeItem(PROJECT_KEY); // dropping the pointer keeps the list entry
  } catch {}
};
const OFF: Caps = { ai: false, meshy: false, tier: '', revisions: 0 };

export default function BuildFlow() {
  const sp = useSearchParams();
  const prefill = prefillPrompt(sp.get('prompt'));
  const asked = !!prefill || !!sp.get('example') || sp.get('from') === 'ai'; // a link that says what to start from beats the saved design
  // latched: ?step= and the builder's own replaceState drop ?example=/?prompt=, and boot must not then rerun and swap in the saved design
  const [intent, setIntent] = useState(asked);
  if (asked && !intent) setIntent(true);
  const router = useRouter();
  const pathname = usePathname();
  const urlStep = sp.get('step');
  const [caps, setCaps] = useState<Caps | null>(null);
  const [capsErr, setCapsErr] = useState<UiError | null>(null);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [stats, setStats] = useState<MeshStats | null>(null);
  const [step, setStep] = useState<Step>('plan');
  const [booting, setBooting] = useState(true);
  const [resumeErr, setResumeErr] = useState<UiError | null>(null);
  const [pending, setPending] = useState<string | null>(null); // a saved design waiting while a ?prompt= / ?example= start is shown
  const [designs, setDesigns] = useState<DesignEntry[]>([]);
  const [listNote, setListNote] = useState('');
  const top = useRef<HTMLDivElement>(null);
  const live = useRef({ step, project }); // read by the URL effect without re-running it
  live.current = { step, project };

  const adopt = useCallback((p: ProjectView, s?: MeshStats | null, to?: Step) => {
    setProject(p);
    setStats((old) => (s !== undefined ? s : old));
    writeId(p.id, currentRevision(p).blueprint.title);
    setStep((cur) => settleStep(to ?? cur, p.status));
  }, []);

  const boot = useCallback((signal: AbortSignal) => {
    setBooting(true);
    setCapsErr(null);
    setResumeErr(null);
    const id = readId();
    const wantResume = id && !intent;
    if (id && intent) setPending(id);
    setDesigns(readList());
    void api.caps(signal).then(setCaps, (e) => { if (e?.name === 'AbortError') return; setCaps(OFF); setCapsErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(0)); });
    if (!wantResume) { setBooting(false); return; }
    api.get(id, signal).then(
      (r) => { adopt(r.project, r.stats ?? null, defaultStep(r.project.status)); setBooting(false); },
      (e) => {
        if (e?.name === 'AbortError') return;
        const u = e instanceof ApiError ? mapError(e.status, e.message) : mapError(0);
        if (u.kind === 'missing') writeId(null); // gone from the server (pruned): forget it
        else setResumeErr(u);
        setBooting(false);
      },
    );
  }, [adopt, intent]);

  useEffect(() => {
    const ctl = new AbortController();
    boot(ctl.signal);
    return () => ctl.abort();
  }, [boot]);

  // each step is its own history entry (?step=), so the browser Back button walks the steps before leaving the builder
  const show = (s: Step) => {
    setStep(s);
    router.push(`${pathname}?mode=build&step=${s}`, { scroll: false });
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const go = (s: Step) => {
    if (!project || !stepAllowed(s, project.status)) return;
    show(s);
  };
  // browser Back/Forward changed ?step=
  useEffect(() => {
    const { step: cur, project: p } = live.current;
    if (!p || !urlStep || urlStep === cur || !(urlStep in STEP_LABEL) || !stepAllowed(urlStep as Step, p.status)) return;
    setStep(urlStep as Step);
  }, [urlStep]);
  // a project just opened (new or resumed): record its step in the URL without adding a history entry
  const projectId = project?.id;
  useEffect(() => {
    if (projectId) router.replace(`${pathname}?mode=build&step=${live.current.step}`, { scroll: false });
  }, [projectId, pathname, router]);
  const back = () => { if (window.history.length > 1) router.back(); else router.push('/shop'); };
  const fresh = () => { router.replace(`${pathname}?mode=build`, { scroll: false }); writeId(null); setDesigns(readList()); setListNote(''); setProject(null); setStats(null); setStep('plan'); setPending(null); };
  const newDesign = () => {
    if (project && project.status !== 'ordered' && !window.confirm('Leave this design? It is not deleted: you can reopen it from My designs.')) return;
    fresh();
  };
  const resume = async () => {
    if (!pending) return;
    try { const r = await api.get(pending); adopt(r.project, r.stats ?? null, defaultStep(r.project.status)); setPending(null); } catch (e) { setResumeErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(0)); }
  };

  const openDesign = async (id: string) => {
    setListNote('');
    try { const r = await api.get(id); adopt(r.project, r.stats ?? null, defaultStep(r.project.status)); setPending(null); } catch (e) {
      const u = e instanceof ApiError ? mapError(e.status, e.message) : mapError(0);
      if (u.kind === 'missing') { const l = removeDesign(readList(), id); writeList(l); setDesigns(l); setListNote('That design is no longer on the server, so it was removed from the list.'); } else setResumeErr(u);
    }
  };
  const removeEntry = (d: DesignEntry) => {
    if (!window.confirm('Remove this design from the list? It stays on the server; only this browser forgets it.')) return;
    const l = removeDesign(readList(), d.id); writeList(l); setDesigns(l);
    if (pending === d.id) setPending(null);
    try { if (parseStoredId(localStorage.getItem(PROJECT_KEY)) === d.id) localStorage.removeItem(PROJECT_KEY); } catch {}
  };

  if (booting || !caps) return <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;

  if (!project) {
  const designsEl = (
  (designs.length > 0 || listNote) && (
    <section aria-labelledby="my-designs" className="space-y-2">
      <h2 id="my-designs" className="text-sm font-semibold text-gray-900 dark:text-gray-100">My designs</h2>
      {listNote && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{listNote}</p>}
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {designs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">{d.title || 'Untitled design'}<span className="ml-2 font-normal text-gray-500 dark:text-gray-400">{new Date(d.updatedAt).toLocaleDateString()}</span></span>
            <button type="button" onClick={() => openDesign(d.id)} className={`${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="arrow" />Open</button>
            <button type="button" onClick={() => removeEntry(d)} className={`${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="undo" />Remove</button>
          </li>
        ))}
      </ul>
    </section>
  )
  );

  const startEl = <StartPanel caps={caps} initialPrompt={prefill} onProject={(p) => adopt(p, null, 'plan')} />;
    return (
      <div className="space-y-8">
        <ErrorNote err={capsErr} />
        {resumeErr && (
          <div className="space-y-2">
            <ErrorNote err={resumeErr} />
            <button aria-label="Try again" title="Try again" type="button" onClick={() => { const c = new AbortController(); boot(c.signal); }} className={secondaryBtn}><Icon name="undo" />Retry</button>
          </div>
        )}
        {pending && (
          <p className="flex flex-wrap items-center gap-3 rounded-xl bg-indigo-50 px-4 py-2 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            You have a design in progress.
            <button aria-label="Resume the design" title="Resume the design" type="button" onClick={resume} className="whitespace-nowrap min-h-10 inline-flex items-center gap-1 font-semibold underline hover:no-underline"><Icon name="arrow" />Resume</button>
          </p>
        )}
        {intent ? (
          <>
            <Playground />
            <details className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-gray-100">Start something else</summary>
              <div className="mt-4 space-y-8">
                {designsEl}
                {startEl}
              </div>
            </details>
          </>
        ) : (
          <>
            {designsEl}
            {startEl}
            <div className="space-y-2">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">Or build freely, with no plan: add shapes yourself and get a price.</p>
              <Playground />
            </div>
          </>
        )}
      </div>
    );
  }

  const send = (p: ProjectView, s?: MeshStats | null) => adopt(p, s);
  return (
    <div ref={top} className="scroll-mt-20 space-y-6">
      <div className="space-y-2">
        <Stepper steps={stepViews(project.status, step)} onGo={go} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={back} className={`${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="undo" />Back</button>
          <button aria-label="New design" title="New design" type="button" onClick={newDesign} className={`whitespace-nowrap min-h-10 ${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="plus" />New</button>
        </div>
      </div>
      <p className="sr-only" role="status">{STEP_LABEL[step]} step</p>
      {step === 'plan' && <PlanStep p={project} caps={caps} onProject={send} onNext={() => go('approve')} />}
      {step === 'approve' && <ApproveStep p={project} onProject={(p) => adopt(p, undefined)} onGo={show} />}
      {step === 'build' && <BuildStep p={project} onProject={(p, s) => adopt(p, s)} onGo={show} />}
      {step === 'order' && <OrderStep p={project} stats={stats} onNew={fresh} />}
    </div>
  );
}
