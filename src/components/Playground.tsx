'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import UploadForm from './UploadForm';
import Icon from './Icon';
import PlaygroundScene, { type Placing, type Pose, type SimView, type Tool } from './playground/PlaygroundScene';
import { MOTORS, type PropMotor } from '@/lib/motors';
import { MAX_COMPONENTS, MAX_MASS_G, MAX_MOTORS, MAX_POS_MM, typicalMass } from '@/lib/flight/components';
import { meshBody, printedDensity, type Body, type Vec3 } from '@/lib/flight/mass';
import { trim } from '@/lib/flight/trim';
import { propDiameterMm } from '@/lib/flight/rotor';
import {
  MASS_PARTS, NO_PARTS, PARTS_KEY, addMass, addMotor, loadParts, makeQuad, mountPoints, nextSpin, patchMass, patchMotor, pushHistory, redoHistory,
  removePart, savedParts, undoHistory, type History, type Parts,
} from '@/lib/flight/layout';
import { BED_MM, fitsBed, meshStats } from '@/lib/quote';
import { exampleById } from '@/lib/examples';
import { buildOffThread } from '@/lib/buildOffThread';
import {
  DEFAULT_SIZE, KINDS, LABEL, MAX_SHAPES, MIN_SIZE, clampCoord, minZ, parseDesign, solidsSize, toStl,
  type Kind, type Shape, type V3,
} from '@/lib/playground';

const KEY = 'printpro3d.playground.v1';
const AI_KEY = 'printpro3d.aidesign.v1'; // written by the Draw it with AI form
const PROP_MOTOR = MOTORS.find((m): m is PropMotor => m.kind === 'prop')!;
const FlightHud = dynamic(() => import('./playground/FlightHud'), { ssr: false });
const clampPos = (v: number) => Math.max(-MAX_POS_MM, Math.min(MAX_POS_MM, v));
const asV3 = (p: Vec3): V3 => ({ x: p[0], y: p[1], z: p[2] });

const btnBase = 'rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnIdle = 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
const btn = `${btnBase} ${btnIdle}`;
const on = 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600';
// active replaces the idle colours instead of adding to them, so only one background and text colour applies
const btnOn = (active: boolean) => `${btnBase} ${active ? on : btnIdle}`;
const primary =
  'rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-5 py-3 transition-all duration-200';
const panel = 'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3';
const heading = 'text-sm font-semibold text-gray-900 dark:text-gray-100';

function NumField({ label, value, onChange, min }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  // keep what the user is typing ("0." on the way to "0.5") until they leave the field
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      step="any"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && (min === undefined || v >= min)) onChange(clampCoord(v));
      }}
      onBlur={() => setDraft(null)}
      className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  );
}

function VecRow({ title, unit, value, onChange, min, labels }: {
  title: string; unit: string; value: V3; onChange: (axis: keyof V3, v: number) => void; min?: number; labels?: [string, string, string];
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{title} ({unit})</legend>
      <div className="grid grid-cols-3 gap-2">
        {(['x', 'y', 'z'] as const).map((a, i) => (
          <div key={a} className={`flex gap-1 min-w-0 ${labels ? 'flex-col' : 'items-center'}`}>
            <span aria-hidden className={labels ? 'text-xs text-gray-500 dark:text-gray-400 truncate' : 'text-xs font-semibold uppercase text-gray-500 dark:text-gray-400'}>
              {labels ? labels[i] : a}
            </span>
            <NumField label={`${title} ${labels ? labels[i] : a.toUpperCase()} (${unit})`} value={value[a]} min={min} onChange={(v) => onChange(a, v)} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function loadPartsSaved(): Parts {
  try { return loadParts(localStorage.getItem(PARTS_KEY)); } catch { return NO_PARTS; }
}

function PosRow({ value, onChange }: { value: Vec3; onChange: (p: Vec3) => void }) {
  return (
    <VecRow title="Position" unit="mm" value={asV3(value)} onChange={(a, v) => onChange(value.map((o, i) => (['x', 'y', 'z'][i] === a ? clampPos(v) : o)) as Vec3)} />
  );
}

function load(): Shape[] {
  try {
    return parseDesign(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

const fmt = (n: number) => n.toFixed(1);

type AiDraft = { title: string; notes: string; source: 'photo' | 'description'; shapes: Shape[] };

/** A drawn design handed over by the AI form. sessionStorage is untrusted: validate everything, strip control characters. */
function loadAiDraft(): AiDraft | null {
  try {
    const p: unknown = JSON.parse(sessionStorage.getItem(AI_KEY) ?? 'null');
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    if (!Array.isArray(o.shapes)) return null;
    const shapes = parseDesign(JSON.stringify(o.shapes));
    if (!shapes.length) return null;
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
    return { title: clean(o.title, 60), notes: clean(o.notes, 300), source: o.source === 'photo' ? 'photo' : 'description', shapes };
  } catch {
    return null;
  }
}

/** Project mode (initialShapes given): the shapes of a design project's blueprint. No localStorage, no price or upload; `onSave` turns edits into a new
 * revision (resolves to an error text, or null on success) and `readOnly` freezes the canvas. Without props this is the free-form builder. */
export type PlaygroundProject = { initialShapes: Shape[]; readOnly?: boolean; onSave?: (shapes: Shape[]) => Promise<string | null> };

export default function Playground({ project }: { project?: PlaygroundProject } = {}) {
  const params = useSearchParams();
  const example = project ? null : exampleById(params.get('example'));
  // captured once; the key is removed after mount (StrictMode runs initializers twice)
  const [aiDraft] = useState<AiDraft | null>(() => (!project && typeof window !== 'undefined' && params.get('from') === 'ai' ? loadAiDraft() : null));
  const wantSim = params.get('sim') === '1';
  const [h, setH] = useState<History>(() => ({
    past: [], future: [],
    now: {
      shapes: project ? structuredClone(project.initialShapes) : example ? structuredClone(example.shapes) : aiDraft ? structuredClone(aiDraft.shapes) : load(),
      parts: project || example || aiDraft ? NO_PARTS : loadPartsSaved(),
    },
  }));
  const loadedExample = useRef(example?.id ?? null);
  const touched = useRef(false); // an untouched example never overwrites the saved design
  const editor = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('translate');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ file: File; key: number } | null>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const scrollToOffer = useCallback(() => offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);
  const autoPriced = useRef(false);
  const shapes = h.now.shapes;
  const parts = h.now.parts;
  const [partSel, setPartSel] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(() => (wantSim && !h.now.parts.motors.length ? { kind: 'motor', spin: 'ccw', motorId: PROP_MOTOR.id } : null));
  const [simulate, setSimulate] = useState(() => wantSim && h.now.parts.motors.length > 0);
  const [estimated, setEstimated] = useState<string[]>([]);
  const [frame, setFrame] = useState<{ of: Shape[]; body: Body | null } | null>(null);
  const locked = simulate || !!project?.readOnly;
  const [saving, setSaving] = useState(false);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const sel = shapes.find((s) => s.id === selectedId) ?? null;
  const size = solidsSize(shapes);
  const hasSolid = size !== null;

  // every change is one snapshot; repeated edits of the same field within a second share one (typing "25")
  const commitDoc = useCallback((next: (d: History['now']) => History['now'], key?: string) => {
    touched.current = true;
    setH((p) => pushHistory(p, next(p.now), key, Date.now()));
  }, []);
  const commit = useCallback((next: (s: Shape[]) => Shape[], key?: string) => commitDoc((d) => ({ ...d, shapes: next(d.shapes) }), key), [commitDoc]);
  const commitParts = useCallback((next: (p: Parts) => Parts, key?: string) => commitDoc((d) => ({ ...d, parts: next(d.parts) }), key), [commitDoc]);
  const undo = useCallback(() => { if (!locked) setH(undoHistory); }, [locked]);
  const redo = useCallback(() => { if (!locked) setH(redoHistory); }, [locked]);

  const patch = (id: string, f: (s: Shape) => Shape, key?: string) => commit((all) => all.map((s) => (s.id === id ? f(s) : s)), key);
  const remove = useCallback((id: string) => { commit((all) => all.filter((s) => s.id !== id)); setSelectedId(null); }, [commit]);
  const removeP = useCallback((id: string) => { commitParts((p) => removePart(p, id)); setPartSel(null); }, [commitParts]);
  const selectShape = useCallback((id: string | null) => { setSelectedId(id); setPartSel(null); }, []);
  const selectPart = useCallback((id: string) => { setPartSel(id); setSelectedId(null); }, []);
  const motor = parts.motors.find((m) => m.id === partSel) ?? null;
  const mass = parts.components.find((c) => c.id === partSel) ?? null;
  const mounts = useMemo(() => mountPoints(shapes), [shapes]);
  const startPlace = (p: Placing) => {
    if (locked) return;
    if (p.kind === 'motor' && parts.motors.length >= MAX_MOTORS) { setNote(`That is the limit: ${MAX_MOTORS} motors.`); return; }
    if (p.kind === 'mass' && parts.components.length >= MAX_COMPONENTS) { setNote(`That is the limit: ${MAX_COMPONENTS} parts.`); return; }
    setPlacing((cur) => (cur?.kind === p.kind && (p.kind === 'motor' || (cur as Placing & { name: string }).name === p.name) ? null : p));
    setSelectedId(null); setPartSel(null);
  };
  const place = (pos: Vec3) => {
    if (!placing) return;
    const out = placing.kind === 'motor' ? addMotor(parts, pos, placing.motorId) : addMass(parts, placing.name, pos);
    if (out.id) { commitParts(() => out.parts); setPartSel(out.id); }
    setPlacing(null);
  };
  const movePart = useCallback((id: string, pos: Vec3) => {
    const c = pos.map(clampPos) as Vec3;
    commitParts((p) => ({ motors: patchMotor(p, id, (m) => ({ ...m, pos: c })).motors, components: patchMass(p, id, (m) => ({ ...m, pos: c })).components }));
  }, [commitParts]);


  const full = () => {
    if (shapes.length < MAX_SHAPES) return false;
    setNote(`That is the limit: ${MAX_SHAPES} shapes per model. Delete one to add another.`);
    return true;
  };
  const add = (kind: Kind) => {
    if (full()) return;
    const sz = DEFAULT_SIZE[kind];
    const id = Math.random().toString(36).slice(2, 10);
    const n = shapes.length;
    // sits on the plate, staggered so new shapes do not hide each other
    commit((all) => [...all, { id, kind, mode: 'solid', position: { x: ((n * 25 + 75) % 150) - 75, y: 0, z: sz.z / 2 }, rotation: { x: 0, y: 0, z: 0 }, size: { ...sz } }]);
    setSelectedId(id);
  };
  const duplicate = () => {
    if (!sel || full()) return;
    const id = Math.random().toString(36).slice(2, 10);
    commit((all) => [...all, { ...sel, id, position: { ...sel.position, x: sel.position.x + 10, y: sel.position.y + 10 }, rotation: { ...sel.rotation }, size: { ...sel.size } }]);
    setSelectedId(id);
  };
  const clearAll = () => {
    if (shapes.length && window.confirm('Remove all shapes? You can still undo this.')) { commit(() => []); setSelectedId(null); }
  };

  // changing the design invalidates any price or file made from the old one
  useEffect(() => { setOffer(null); setNote(null); }, [shapes]);
  // the example link can change while the builder is open
  useEffect(() => {
    if (example && example.id !== loadedExample.current) {
      loadedExample.current = example.id;
      touched.current = false;
      setH({ past: [], now: { shapes: structuredClone(example.shapes), parts: NO_PARTS }, future: [] });
      setSelectedId(null); setPartSel(null); setSimulate(false);
    }
  }, [example]);
  // after undoing an add, the selection may point at nothing
  useEffect(() => { if (selectedId && !shapes.some((s) => s.id === selectedId)) setSelectedId(null); }, [shapes, selectedId]);

  useEffect(() => { if (!project) try { sessionStorage.removeItem(AI_KEY); } catch {} }, [project]);

  useEffect(() => { if (partSel && !parts.motors.some((m) => m.id === partSel) && !parts.components.some((c) => c.id === partSel)) setPartSel(null); }, [parts, partSel]);
  useEffect(() => { if (simulate && !parts.motors.length) setSimulate(false); }, [simulate, parts.motors.length]);
  // frame mass from the built mesh (uniform fill: an estimate), only while simulating
  useEffect(() => {
    if (!simulate) return;
    let live = true;
    const of = shapes;
    buildOffThread(of).then((tris) => { if (live) setFrame({ of, body: tris ? meshBody(tris, null, printedDensity('PLA')) : null }); }, () => { if (live) setFrame({ of, body: null }); });
    return () => { live = false; };
  }, [simulate, shapes]);

  // autosave (private windows can throw; the editor works without it)
  useEffect(() => {
    if (project || ((example || aiDraft) && !touched.current)) return; // a project's edits are saved as revisions, never to the free-form slot
    try {
      localStorage.setItem(KEY, JSON.stringify(shapes));
      const sp = savedParts(parts); // no motors: the parser needs one, so the key is cleared (mass parts alone are not kept)
      if (sp) localStorage.setItem(PARTS_KEY, sp); else localStorage.removeItem(PARTS_KEY);
    } catch {}
  }, [shapes, parts, example, aiDraft, project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
      if (typing && !editor.current?.contains(el)) return; // the order form keeps its own undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (typing) (el as HTMLElement).blur(); // let the field show the restored value
        if (e.shiftKey) redo(); else undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && !locked && (selectedId || partSel)) {
        e.preventDefault();
        if (partSel) removeP(partSel); else if (selectedId) remove(selectedId);
      } else if (e.key === 'Escape') setPlacing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, remove, removeP, selectedId, partSel, locked]);

  const build = async () => {
    setBusy(true);
    setNote(null);
    const snapshot = shapesRef.current;
    try {
      const tris = await buildOffThread(snapshot);
      if (shapesRef.current !== snapshot) return null; // edited meanwhile: the result is stale
      if (!tris) setNote('Nothing is left to print. A hole may be removing every solid.');
      return tris;
    } catch {
      if (shapesRef.current === snapshot) setNote("We'll quote this one manually: we could not combine these shapes automatically. You can still describe it as an idea, or move or resize a shape slightly and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const price = async () => {
    const snapshot = shapesRef.current;
    const tris = await build();
    if (!tris || shapesRef.current !== snapshot) return;
    const file = new File([toStl(tris) as BlobPart], 'playground.stl', { type: 'model/stl' });
    if (!meshStats(tris)) setNote("We'll quote this one manually: the combined shape is not a clean closed solid.");
    setOffer({ file, key: Date.now() });
    setTimeout(() => offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const save = async () => {
    if (!project?.onSave) return;
    setSaving(true);
    const err = await project.onSave(shapesRef.current).catch(() => 'The change could not be saved. Try again.');
    setSaving(false);
    if (err) setNote(err);
  };
  const download = async () => {
    const tris = await build();
    if (!tris) return;
    const url = URL.createObjectURL(new Blob([toStl(tris) as BlobPart], { type: 'model/stl' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playground.stl';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ?price=1 with a valid example (the gallery's "Get a price"): price it once, after the design is in place
  useEffect(() => {
    if (autoPriced.current || !example || params.get('price') !== '1' || !hasSolid) return;
    autoPriced.current = true;
    void price();
  });

  const pose = useCallback((id: string, p: Pose) => commit((all) => all.map((s) => (s.id === id ? { ...s, ...p } : s))), [commit]);
  const names = shapes.map((s, i) => `${LABEL[s.kind]} ${shapes.slice(0, i + 1).filter((o) => o.kind === s.kind).length}`);
  const fits = size ? fitsBed(size) : false;
  const frameReady = frame?.of === shapes;
  const sim = useMemo<SimView | null>(() => {
    if (!simulate || parts.motors.length < 3 || !frameReady) return null;
    try {
      const t = trim({ motors: parts.motors, components: parts.components, frame: frame?.body ?? undefined });
      return { cg: [t.cgMm[0], t.cgMm[1], t.cgMm[2]], arrows: parts.motors.map((m, i) => ({ pos: m.pos, thrustN: t.motors[i].thrustN, maxN: t.motors[i].maxThrustN })) };
    } catch { return null; }
  }, [simulate, parts, frame, frameReady]);
  const spinNow = nextSpin(parts.motors);

  return (
    <div className="space-y-6">
      {!project && <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Build it myself</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add shapes, move and resize them, and mark some as holes to cut them out. Everything is in millimetres; the flat grid is the print plate.
        </p>
      </div>}

      {example && (
        <p className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
          Started from the example &lsquo;{example.title}&rsquo;. Your changes are saved only in this browser.
        </p>
      )}

      {aiDraft && (
        <p role="status" className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
          Drawn by AI from your {aiDraft.source}{aiDraft.title ? `: "${aiDraft.title}"` : ''}.{aiDraft.notes ? ` ${aiDraft.notes}` : ''} AI can get sizes wrong. Check them before you order.
        </p>
      )}

      <div ref={editor} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Add a shape">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => add(k)} disabled={locked} className={btn}>+ {LABEL[k]}</button>
            ))}
          </div>
          {!project && <div className="flex flex-wrap gap-2" role="group" aria-label="Add a motor or part">
            <button type="button" aria-pressed={placing?.kind === 'motor'} disabled={locked} onClick={() => startPlace({ kind: 'motor', spin: spinNow, motorId: PROP_MOTOR.id })} className={btnOn(placing?.kind === 'motor')}>+ Motor</button>
            {MASS_PARTS.map((n) => {
              const act = placing?.kind === 'mass' && placing.name === n;
              return <button key={n} type="button" aria-pressed={act} disabled={locked} onClick={() => startPlace({ kind: 'mass', name: n })} className={btnOn(act)}>+ {n === 'Flight controller' ? 'FC' : n}</button>;
            })}
          </div>}
          {placing && (
            <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
              {placing.kind === 'motor'
                ? 'Move over the model and click to place the motor. It snaps to a mount point (top of a cylinder or a hole) within 8 mm. Press Esc to cancel.'
                : `Move over the model and click to place the ${placing.name}. Press Esc to cancel.`}
            </p>
          )}

          <div className={`relative h-[55vh] min-h-[320px] lg:h-[560px] rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 ${placing ? 'cursor-crosshair' : ''}`}>
            <PlaygroundScene
              shapes={shapes} selectedId={sel?.id ?? null} tool={tool} onSelect={selectShape} onPose={pose}
              parts={parts} partSel={partSel} onSelectPart={selectPart} onMovePart={movePart}
              placing={placing} mounts={mounts} onPlace={place} locked={locked} sim={sim} estimated={estimated}
            />
            {simulate && (
              <FlightHud motors={parts.motors} components={parts.components} frame={frame?.body ?? null} frameMm={size ? { x: size.x, y: size.y } : null} frameState={frameReady ? 'ready' : 'building'} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2" role="group" aria-label="Transform mode">
              {([['translate', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']] as const).map(([t, text]) => (
                <button key={t} type="button" aria-pressed={tool === t} disabled={locked} onClick={() => setTool(t)} className={btnOn(tool === t)}>{text}</button>
              ))}
              {!project && parts.motors.length > 0 && (
                <button type="button" aria-pressed={simulate} onClick={() => { setSimulate(!simulate); setPlacing(null); setSelectedId(null); setPartSel(null); }} className={btnOn(simulate)}>Simulate</button>
              )}
            </div>
            <button type="button" onClick={undo} disabled={locked || !h.past.length} className={btn}>Undo</button>
            <button type="button" onClick={redo} disabled={locked || !h.future.length} className={btn}>Redo</button>
            <button type="button" onClick={duplicate} disabled={locked || !sel} className={btn}>Duplicate</button>
            <button type="button" onClick={() => (partSel ? removeP(partSel) : sel && remove(sel.id))} disabled={locked || (!sel && !partSel)} className={btn}>Delete</button>
            <button type="button" onClick={clearAll} disabled={locked || !shapes.length} className={btn}>Clear all</button>
          </div>
        </div>

        <aside className="space-y-4 min-w-0">
          <div className={panel}>
            <h3 className={heading}>Shapes</h3>
            {shapes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nothing yet. Add a shape to start.</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {shapes.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={s.id === sel?.id}
                      onClick={() => !locked && selectShape(s.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-left ${s.id === sel?.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                      <span className="min-w-0">
                        <span className="block">{names[i]}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">L {fmt(s.size.x)} × W {fmt(s.size.y)} × H {fmt(s.size.z)} mm</span>
                      </span>
                      <span className={`text-xs ${s.mode === 'hole' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{s.mode === 'hole' ? 'Hole' : 'Solid'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(motor || mass) && !locked && (
            <div className={panel}>
              {motor && (
                <>
                  <h3 className={heading}>Motor {motor.id}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{MOTORS.find((x) => x.id === motor.motorId)?.name}, {propDiameterMm(PROP_MOTOR.prop).toFixed(0)} mm prop. Not part of the printed model.</p>
                  <div className="flex gap-2" role="group" aria-label="Spin direction">
                    {(['cw', 'ccw'] as const).map((d) => (
                      <button key={d} type="button" aria-pressed={motor.spin === d} onClick={() => commitParts((p) => patchMotor(p, motor.id, (m) => ({ ...m, spin: d })))} className={`${btnOn(motor.spin === d)} flex-1`}>
                        Spin {d === 'cw' ? 'CW' : 'CCW'}
                      </button>
                    ))}
                  </div>
                  <PosRow value={motor.pos} onChange={(pos) => commitParts((p) => patchMotor(p, motor.id, (m) => ({ ...m, pos })), `mp${motor.id}`)} />
                  <button type="button" onClick={() => commitParts((p) => makeQuad(p, motor.id))} className={`${btn} w-full`}>Make 4 (quad-X)</button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quad-X copies this motor&rsquo;s distance from the centre to all four corners and replaces the motors you have.</p>
                </>
              )}
              {mass && (
                <>
                  <h3 className={heading}>{mass.name}</h3>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Mass (g), blank until you type it
                    <input
                      type="number" step="any" min={0} max={MAX_MASS_G} value={mass.massG ?? ''} placeholder="not set"
                      aria-label={`${mass.name} mass in grams`}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        setEstimated((x) => x.filter((i) => i !== mass.id));
                        commitParts((p) => patchMass(p, mass.id, (c) => ({ ...c, massG: Number.isFinite(v) ? Math.max(0, Math.min(MAX_MASS_G, v)) : null })), `mm${mass.id}`);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>
                  {typicalMass(mass.name) && (
                    <button type="button" onClick={() => { const t = typicalMass(mass.name)!; setEstimated((x) => [...x, mass.id]); commitParts((p) => patchMass(p, mass.id, (c) => ({ ...c, massG: t.massG }))); }} className={`${btn} w-full`}>
                      Use typical value
                    </button>
                  )}
                  {estimated.includes(mass.id) && <p className="text-xs text-amber-700 dark:text-amber-300">ESTIMATE: typical {mass.name}, real parts vary widely. Weigh yours.</p>}
                  <PosRow value={mass.pos} onChange={(pos) => commitParts((p) => patchMass(p, mass.id, (c) => ({ ...c, pos })), `cp${mass.id}`)} />
                </>
              )}
            </div>
          )}

          {sel && !locked && (
            <div className={panel}>
              <h3 className={heading}>{names[shapes.indexOf(sel)]}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {LABEL[sel.kind]} · length {fmt(sel.size.x)} mm, width {fmt(sel.size.y)} mm, height {fmt(sel.size.z)} mm
              </p>
              <div className="flex gap-2" role="group" aria-label="Solid or hole">
                {(['solid', 'hole'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={sel.mode === m} onClick={() => patch(sel.id, (s) => ({ ...s, mode: m }))} className={`${btnOn(sel.mode === m)} flex-1`}>
                    {m === 'solid' ? 'Solid' : 'Hole'}
                  </button>
                ))}
              </div>
              <VecRow title="Position" unit="mm" value={sel.position} onChange={(a, v) => patch(sel.id, (s) => ({ ...s, position: { ...s.position, [a]: v } }), `p${a}${sel.id}`)} />
              <VecRow title="Rotation" unit="degrees" value={sel.rotation} onChange={(a, v) => patch(sel.id, (s) => ({ ...s, rotation: { ...s.rotation, [a]: v } }), `r${a}${sel.id}`)} />
              <VecRow title="Size" unit="mm" value={sel.size} min={MIN_SIZE} labels={['Length (X)', 'Width (Y)', 'Height (Z)']} onChange={(a, v) => patch(sel.id, (s) => ({ ...s, size: { ...s.size, [a]: v } }), `s${a}${sel.id}`)} />
              <button type="button" onClick={() => patch(sel.id, (s) => ({ ...s, position: { ...s.position, z: s.position.z - minZ(s) } }))} className={`${btn} w-full`}>
                Drop to plate
              </button>
            </div>
          )}

          <div className={panel} aria-live="polite">
            <h3 className={heading}>Your model</h3>
            {size ? (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {fmt(size.x)} × {fmt(size.y)} × {fmt(size.z)} mm <span className="text-gray-500 dark:text-gray-400">(length × width × height)</span>
                </p>
                <p className={`text-sm font-medium ${fits ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {fits ? 'Fits our print area.' : `Too big for our ${BED_MM.x}×${BED_MM.y}×${BED_MM.z} mm print area; we can still quote it manually.`}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Add at least one solid shape to see its size.</p>
            )}
          </div>
        </aside>
      </div>

      {project ? (
        project.onSave && !project.readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={!h.past.length || !hasSolid || saving} className={`${primary} inline-flex items-center gap-2`}>
              <Icon name="check" />{saving ? 'Saving…' : 'Save as a new revision'}
            </button>
            {!h.past.length && <p className="text-sm text-gray-500 dark:text-gray-400">Change something to save a revision.</p>}
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={price} disabled={!hasSolid || busy} className={primary}>{busy ? 'Building…' : 'Get a price'}</button>
          {busy && <span role="status" className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Building your model…</span>}
          <button type="button" onClick={download} disabled={!hasSolid || busy} className={`${btn} py-3`}>Download STL</button>
          {!hasSolid && <p className="text-sm text-gray-500 dark:text-gray-400">Add at least one solid shape first.</p>}
        </div>
      )}
      {note && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}

      <div ref={offerRef} className="scroll-mt-20">
        {offer && <UploadForm key={offer.key} initialFile={offer.file} onQuote={scrollToOffer} />}
      </div>
    </div>
  );
}
