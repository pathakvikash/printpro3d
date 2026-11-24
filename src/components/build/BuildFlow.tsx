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
  PROJECT_KEY, STEP_LABEL, defaultStep, mapError, parseStoredId, prefillPrompt, settleStep, stepAllowed, stepViews,
  type Caps, type ProjectView, type Step, type UiError,
} from '@/lib/buildFlow';
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
const writeId = (id: string | null) => { try { if (id) localStorage.setItem(PROJECT_KEY, id); else localStorage.removeItem(PROJECT_KEY); } catch {} };
const OFF: Caps = { ai: false, meshy: false, tier: '', revisions: 0 };

export default function BuildFlow() {
  const sp = useSearchParams();
  const prefill = prefillPrompt(sp.get('prompt'));
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
  const [pending, setPending] = useState<string | null>(null); // a saved design waiting while a ?prompt= start is shown
  const top = useRef<HTMLDivElement>(null);
  const live = useRef({ step, project }); // read by the URL effect without re-running it
  live.current = { step, project };

  const adopt = useCallback((p: ProjectView, s?: MeshStats | null, to?: Step) => {
    setProject(p);
    setStats((old) => (s !== undefined ? s : old));
    writeId(p.id);
    setStep((cur) => settleStep(to ?? cur, p.status));
  }, []);

  const boot = useCallback((signal: AbortSignal) => {
    setBooting(true);
    setCapsErr(null);
    setResumeErr(null);
    const id = readId();
    const wantResume = id && !prefill;
    if (id && prefill) setPending(id);
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
  }, [adopt, prefill]);

  useEffect(() => {
    const ctl = new AbortController();
    boot(ctl.signal);
    return () => ctl.abort();
  }, [boot]);

  // each step is its own history entry (?step=), so the browser Back button walks the steps before leaving /build
  const show = (s: Step) => {
    setStep(s);
    router.push(`${pathname}?step=${s}`, { scroll: false });
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
    if (projectId) router.replace(`${pathname}?step=${live.current.step}`, { scroll: false });
  }, [projectId, pathname, router]);
  const back = () => { if (window.history.length > 1) router.back(); else router.push('/shop'); };
  const fresh = () => { router.replace(pathname, { scroll: false }); writeId(null); setProject(null); setStats(null); setStep('plan'); setPending(null); };
  const newDesign = () => {
    if (project && project.status !== 'ordered' && !window.confirm('Leave this design? It is not deleted, but this browser will stop reopening it.')) return;
    fresh();
  };
  const resume = async () => {
    if (!pending) return;
    try { const r = await api.get(pending); adopt(r.project, r.stats ?? null, defaultStep(r.project.status)); setPending(null); } catch (e) { setResumeErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(0)); }
  };

  if (booting || !caps) return <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;

  if (!project) {
    return (
      <div className="space-y-8">
        <ErrorNote err={capsErr} />
        {resumeErr && (
          <div className="space-y-2">
            <ErrorNote err={resumeErr} />
            <button type="button" onClick={() => { const c = new AbortController(); boot(c.signal); }} className={secondaryBtn}><Icon name="undo" />Try again</button>
          </div>
        )}
        {pending && (
          <p className="flex flex-wrap items-center gap-3 rounded-xl bg-indigo-50 px-4 py-2 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            You have a design in progress.
            <button type="button" onClick={resume} className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"><Icon name="arrow" />Resume it</button>
          </p>
        )}
        <StartPanel caps={caps} initialPrompt={prefill} onProject={(p) => adopt(p, null, 'plan')} />
        <div className="space-y-2">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">Or build freely, with no plan: add shapes yourself and get a price.</p>
          <Playground />
        </div>
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
          <Link href="/shop" className={`${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="arrow" />Back to Shop</Link>
          <button type="button" onClick={newDesign} className={`${secondaryBtn} px-3 py-1.5 text-sm`}><Icon name="plus" />New design</button>
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
