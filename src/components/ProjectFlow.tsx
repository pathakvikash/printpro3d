'use client';

import { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

// Each step loads only when it is chosen, so the chooser alone ships little code.
// The steps that show 3D models (upload, shop) pull in three.js, so they stay out of the home page's first load.
const placeholder = () => <div aria-hidden className="h-96 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />;

const UploadForm = dynamic(() => import('./UploadForm'), { loading: placeholder });
const IdeaRequest = dynamic(() => import('./IdeaRequest'), { loading: placeholder });
const ShopOrder = dynamic(() => import('./ShopOrder'), { loading: placeholder });
const TrackOrder = dynamic(() => import('./TrackOrder'), { loading: placeholder });

// three's editor code stays out of the initial bundle
const Playground = dynamic(() => import('./Playground'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading the builder…</p>,
});

const AiGenerate = dynamic(() => import('./AiGenerate'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>,
});

const AiDesign = dynamic(() => import('./AiDesign'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>,
});

const CHOICES = [
  { id: 'file', label: 'I have a 3D file', hint: 'Upload it and get a price.' },
  { id: 'idea', label: 'I have an idea', hint: 'Describe it and we design it.' },
  { id: 'ai', label: 'Generate with AI', hint: 'Describe it or add a photo.' },
  { id: 'design', label: 'Draw it with AI', hint: 'Describe it or add a photo; we draw a 3D model you can edit.' },
  { id: 'shop', label: 'Show me what you make', hint: 'Pick a ready item.' },
  { id: 'track', label: 'Track my order', hint: 'Check status with your id.' },
  { id: 'build', label: 'Build it myself', hint: 'Make a simple model from shapes.' },
] as const;
type Step = (typeof CHOICES)[number]['id'];

export default function ProjectFlow({ aiEnabled = false, designEnabled = false }: { aiEnabled?: boolean; designEnabled?: boolean }) {
  const router = useRouter();
  const param = useSearchParams().get('start');
  const choices = CHOICES.filter((c) => (c.id !== 'ai' || aiEnabled) && (c.id !== 'design' || designEnabled)); // ?start=ai or design while off shows the chooser
  const step = choices.find((c) => c.id === param)?.id ?? null;
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  // the URL is the state, so back and shared links work; scroll when the step changes, and move focus into the new step
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (step === null ? heading.current : back.current)?.focus({ preventScroll: true });
  }, [step]);

  const go = useCallback((s: Step | null) => router.push(s ? `/?start=${s}#start` : '/#start'), [router]);

  return (
    <section id="start" ref={root} className="scroll-mt-16 py-16 bg-gray-50 dark:bg-gray-900">
      <div className={`${step === 'build' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 space-y-6`}>
        {step === null ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="text-3xl font-bold text-gray-900 dark:text-white text-center focus:outline-none">What do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go(c.id)}
                  className="text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-6 hover:border-indigo-500 hover:shadow-lg transition-all"
                >
                  <span className="block text-lg font-semibold text-gray-900 dark:text-white">{c.label}</span>
                  <span className="block mt-1 text-sm text-gray-500 dark:text-gray-400">{c.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button ref={back} type="button" onClick={() => go(null)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Back to options
            </button>
            {step === 'file' && <UploadForm />}
            {step === 'idea' && <IdeaRequest />}
            {step === 'ai' && <AiGenerate onDesigner={() => go('idea')} />}
            {step === 'design' && <AiDesign onDesigner={() => go('idea')} />}
            {step === 'shop' && <ShopOrder onWholesale={() => go('idea')} />}
            {step === 'build' && <Playground />}
            {step === 'track' && <TrackOrder />}
          </>
        )}
      </div>
    </section>
  );
}
