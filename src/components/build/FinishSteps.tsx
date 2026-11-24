'use client';
// Approve (freeze), Build (the frozen blueprint in the editor, read-only, then Finalize) and Order (price per material, place order).
import { useId, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Icon from '../Icon';
import QuoteOrder from '../QuoteOrder';
import ModelWithBlueprint from '../ModelWithBlueprint';
import { card, secondaryBtn, submitBtn } from '../ContactFields';
import { blueprintToShapes } from '@/lib/designBlueprint';
import { canPlaceOrder, currentRevision, mapError, type ProjectView, type UiError } from '@/lib/buildFlow';
import type { MeshStats } from '@/lib/quote';
import { ApiError, api } from './api';
import { PlanSummary } from './PlanStep';
import { useMesh } from './useMesh';
import { ErrorNote, sectionH, subtle } from './ui';

const Playground = dynamic(() => import('../Playground'), { ssr: false, loading: () => <p className="text-sm text-gray-500 dark:text-gray-400">Loading the builder…</p> });

/** The revision a frozen project is about: the approved one, or the current draft. */
export const frozenRevision = (p: ProjectView) => p.revisions.find((r) => r.n === (p.finalRev ?? p.approvedRev ?? p.current)) ?? currentRevision(p);

type Done = (p: ProjectView, stats?: MeshStats | null) => void;

function useAct(onDone: Done) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<UiError | null>(null);
  const run = async (go: () => Promise<{ project: ProjectView; stats?: MeshStats | null }>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await go();
      onDone(r.project, r.stats);
      return true;
    } catch (e) {
      setErr(e instanceof ApiError ? mapError(e.status, e.message) : mapError(500));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

export function ApproveStep({ p, onProject, onGo }: { p: ProjectView; onProject: Done; onGo: (s: 'plan' | 'build') => void }) {
  const { busy, err, run } = useAct(onProject);
  const rev = p.status === 'draft' ? currentRevision(p) : frozenRevision(p);
  return (
    <div className="space-y-6">
      <section className={card}>
        <PlanSummary p={{ ...p, current: rev.n }} bp={rev.blueprint} />
      </section>
      <section className={card}>
        {p.status === 'draft' ? (
          <>
            <h3 className={sectionH}>Approve this plan</h3>
            <p className={subtle}>Approving freezes revision v{rev.n}: no more changes, by AI or by hand. Next we show it as a 3D model and build the print file. Check the sizes and assumptions first.</p>
            <ErrorNote err={err} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={busy} onClick={async () => { if (await run(() => api.approve(p.id))) onGo('build'); }} className={`${submitBtn} sm:w-auto`}><Icon name="check" />{busy ? 'Approving…' : 'Approve and freeze'}</button>
              <button type="button" onClick={() => onGo('plan')} className={secondaryBtn}><Icon name="edit" />Back to the plan</button>
            </div>
          </>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400"><Icon name="lock" />Approved as revision v{rev.n}. It is frozen.</p>
        )}
      </section>
    </div>
  );
}

export function BuildStep({ p, onProject, onGo }: { p: ProjectView; onProject: Done; onGo: (s: 'order') => void }) {
  const { busy, err, run } = useAct(onProject);
  const rev = frozenRevision(p);
  const shapes = useMemo(() => blueprintToShapes(rev.blueprint), [rev]);
  const finalized = p.status === 'finalized' || p.status === 'ordered';
  const id = useId();
  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`} className={sectionH}>Your approved design, revision v{rev.n}</h2>
        <p className={subtle}>This is the 3D model of what you approved. It is read-only. Turn it with the mouse to check it.</p>
        <Playground key={`${p.id}:${rev.n}`} project={{ initialShapes: shapes, readOnly: true }} />
      </section>
      <section className={card}>
        {finalized ? (
          <>
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400"><Icon name="check" />The print file is built.</p>
            <button type="button" onClick={() => onGo('order')} className={`${submitBtn} sm:w-auto`}><Icon name="cart" />Go to Order</button>
          </>
        ) : (
          <>
            <h3 className={sectionH}>Build the print file</h3>
            <p className={subtle}>We build the print file on our server from your approved plan, then show the price in each material. This takes a few seconds.</p>
            <ErrorNote err={err} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={busy} onClick={async () => { if (await run(() => api.finalize(p.id))) onGo('order'); }} className={`${submitBtn} sm:w-auto`}><Icon name="cube" />{busy ? 'Building the file…' : 'Finalize and get the price'}</button>
              <button type="button" disabled title="Finalize the design first" className={`${secondaryBtn} cursor-not-allowed opacity-50`}><Icon name="cart" />Place order</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function OrderStep({ p, stats, onNew }: { p: ProjectView; stats: MeshStats | null; onNew: () => void }) {
  const rev = frozenRevision(p);
  const shapes = useMemo(() => (p.source === 'mesh' ? null : blueprintToShapes(rev.blueprint)), [p.source, rev]);
  const { tris } = useMesh(shapes);
  const [meshPos, setMeshPos] = useState<Float32Array | null>(null); // mesh projects: what the viewer loaded from the finished file
  const positions = p.source === 'mesh' ? meshPos : tris;
  if (p.status === 'ordered') {
    return (
      <section className={card}>
        <p role="status" className="text-lg font-semibold text-gray-900 dark:text-gray-100">This design has been ordered.</p>
        <p className={subtle}>We review every order before printing. You can follow it on the <Link href="/track" className="text-indigo-600 underline hover:no-underline dark:text-indigo-400">track page</Link>.</p>
        <button type="button" onClick={onNew} className={secondaryBtn}><Icon name="plus" />Start a new design</button>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      <p role="status" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><Icon name="lock" />{rev.blueprint.title}, revision v{rev.n}: finalized and read-only.</p>
      {p.finalFile && (p.source === 'mesh' ? <ModelWithBlueprint url={`/api/upload/${p.finalFile}`} name={rev.blueprint.title} onPositions={setMeshPos} /> : tris && <ModelWithBlueprint positions={tris} name={rev.blueprint.title} />)}
      {canPlaceOrder(p.status) && p.finalFile && <QuoteOrder key={p.id} project={p.id} file={p.finalFile} stats={stats} positions={positions} label={rev.blueprint.title} onAnother={onNew} />}
    </div>
  );
}
