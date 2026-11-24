'use client';

import Icon from './Icon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { describeStatus, ORDER_STAGES, ORDER_STATUSES, REQUEST_STAGES, type TrackType } from '@/lib/tracking';
import { card, input, label, money, secondaryBtn, submitBtn } from './ContactFields';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TrackItem = { name: string; qty: number };
type Result = {
  type: TrackType;
  status: string;
  createdAt: string;
  total: number | null;
  items: TrackItem[];
  unpricedCount?: number;
};

// Demo data never leaves the browser: the demo has no id in the database and no API call.
const DEMO_ID = 'DEMO0000';
const DEMO_START_STAGE = 4; // Printing
const DEMO_ITEMS: TrackItem[] = [
  { name: 'Chess-style pawn', qty: 2 },
  { name: 'Your 3D model', qty: 1 },
];

// the first order status that maps to a stage, so each stage button shows a real status
const stageStatus = (stage: number) => Object.keys(ORDER_STATUSES).find((s) => ORDER_STATUSES[s].stage === stage) ?? 'pending_review';

const pill = (on: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    on
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:border-indigo-500'
  }`;

function OrderView({ id, data }: { id: string; data: Result }) {
  const view = describeStatus(data.type, data.status);
  const created = new Date(data.createdAt);
  const unpriced = data.unpricedCount ?? 0;
  const typeLabel = data.type === 'order' ? 'Order' : 'Design request';

  return (
    <div className={`${card} text-sm text-gray-700 dark:text-gray-200`}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {typeLabel} {id.slice(0, 8)}
        </h3>
        <p className="mt-1 text-gray-800 dark:text-gray-100">{view.sentence}</p>
      </div>

      {view.cancelled ? (
        <div role="status" className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-4 font-semibold text-red-800 dark:text-red-200">
          Cancelled
        </div>
      ) : (
        <ol aria-label="Progress" className="ml-3 space-y-4 border-l-2 border-gray-200 dark:border-gray-700">
          {view.stages.map((name, i) => {
            const done = i < view.current;
            const now = i === view.current;
            return (
              <li key={name} aria-current={now ? 'step' : undefined} className="relative pl-6">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    done
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : now
                        ? 'border-indigo-600 bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                >
                  {done && (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5l3 3 7-7" />
                    </svg>
                  )}
                  {now && <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                </span>
                <p className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      now
                        ? 'font-semibold text-gray-900 dark:text-white'
                        : done
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                    }
                  >
                    {name}
                  </span>
                  {now && (
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Now</span>
                  )}
                  <span className="sr-only">{done ? '(done)' : now ? '(current stage)' : '(not yet)'}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">Items</p>
        <ul className="mt-1 space-y-1">
          {data.items.map((it, i) => (
            <li key={`${i}-${it.name}`}>
              {it.name} × {it.qty}
            </li>
          ))}
        </ul>
      </div>

      {!Number.isNaN(created.getTime()) && (
        <p>
          <span className="font-semibold">Created:</span> {created.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
        </p>
      )}
      <p>
        <span className="font-semibold">Estimated total:</span>{' '}
        {data.total != null ? money.format(data.total) : 'we will quote these items'}
        {data.total != null && unpriced > 0 && ` plus ${unpriced} ${unpriced === 1 ? 'item' : 'items'} we will quote`}
      </p>
      <p className="text-gray-600 dark:text-gray-400">We update this page by hand, so check back with your order id.</p>
    </div>
  );
}

export default function TrackOrder() {
  const searchParams = useSearchParams();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; data: Result } | null>(null);
  const [demoStatus, setDemoStatus] = useState<string | null>(null); // non-null while the demo is open
  const autoRan = useRef(false);

  const run = useCallback(async (raw: string) => {
    const value = raw.trim();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(value)}`);
      if (res.status === 404) throw new Error('We could not find that id. Check it and try again.');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error('Something went wrong. Try again.');
      setResult({ id: value, data: data as Result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  // the cart's "Track this order" link carries ?id=: prefill and look up once
  useEffect(() => {
    const q = searchParams.get('id')?.trim() ?? '';
    if (autoRan.current || !UUID.test(q)) return;
    autoRan.current = true;
    setId(q);
    void run(q);
  }, [run, searchParams]);

  if (demoStatus !== null) {
    const demo: Result = {
      type: 'order',
      status: demoStatus,
      createdAt: '2026-11-18T10:00:00.000Z',
      total: 547,
      items: DEMO_ITEMS,
      unpricedCount: 0,
    };
    return (
      <div className="space-y-5">
        <div role="note" className="rounded-xl border border-amber-500 dark:border-amber-600 bg-amber-100 dark:bg-amber-950/60 px-4 py-3 text-sm font-semibold text-amber-900 dark:text-amber-100">
          Demo only — not a real order.
        </div>
        <div className={card}>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Preview stage:</p>
            <div role="group" aria-label="Preview stage" className="flex flex-wrap gap-2">
              {ORDER_STAGES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={demoStatus === stageStatus(i)}
                  onClick={() => setDemoStatus(stageStatus(i))}
                  className={pill(demoStatus === stageStatus(i))}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={demoStatus === 'cancelled'}
                onClick={() => setDemoStatus('cancelled')}
                className={pill(demoStatus === 'cancelled')}
              >
                Show cancelled
              </button>
            </div>
          </div>
        </div>
        <OrderView id={DEMO_ID} data={demo} />
        <button type="button" onClick={() => setDemoStatus(null)} className={`${secondaryBtn} w-full`}>
          Close demo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(id);
        }}
        className={card}
      >
        <div>
          <label htmlFor="track-id" className={label}>Order or request id</label>
          <input id="track-id" value={id} onChange={(e) => setId(e.target.value)} required maxLength={64} className={input} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={busy || !id.trim()} className={submitBtn}><Icon name="search" />{busy ? 'Looking...' : 'Track'}</button>
      </form>
      <button
        type="button"
        onClick={() => setDemoStatus(stageStatus(DEMO_START_STAGE))}
        className={`${secondaryBtn} w-full`}
      >
        <Icon name="play" />See a demo order
      </button>
      {result && <OrderView id={result.id} data={result.data} />}
      {!result && (
        <div className={`${card} text-sm text-gray-700 dark:text-gray-200`}>
          <p className="font-semibold text-gray-900 dark:text-white">Order stages</p>
          <ol className="flex flex-wrap gap-x-2 gap-y-1">
            {ORDER_STAGES.map((n, i) => (
              <li key={n}>{i > 0 && <span aria-hidden className="mr-2 text-gray-400">→</span>}{n}</li>
            ))}
          </ol>
          <p className="font-semibold text-gray-900 dark:text-white">Idea request stages</p>
          <ol className="flex flex-wrap gap-x-2 gap-y-1">
            {REQUEST_STAGES.map((n, i) => (
              <li key={n}>{i > 0 && <span aria-hidden className="mr-2 text-gray-400">→</span>}{n}</li>
            ))}
          </ol>
          <p className="text-gray-600 dark:text-gray-400">Where is my id? Enter the order id from your confirmation.</p>
        </div>
      )}
    </div>
  );
}
