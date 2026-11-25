'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import UploadForm from './UploadForm';
import Icon from './Icon';
import PlaygroundScene, { type DndApi, type Hint, type Placing, type Pose, type SimView, type Tool } from './playground/PlaygroundScene';
import Palette, { type DragItem } from './playground/Palette';
import Bom from './playground/Bom';
import SuggestBar, { ArmedPanel } from './playground/SuggestBar';
import { MASS_NAME, kindOfMassName, massHalfHeight, mergeAi, nudge, suggestItems, type SuggestItem } from '@/lib/suggest/plan';
import { suggestPlacement, type Placement } from '@/lib/suggest/placement';
import type { PartKind } from '@/lib/suggest/validate';
import { MOTORS, type PropMotor } from '@/lib/motors';
import { cloneShapes, membersOf, moveBy, placeTemplate, rotateZ90, snapGrid, NUDGE_FINE_MM, NUDGE_MM } from '@/lib/buildDnd';
import { defaultCfg, templateById } from '@/lib/templateDefs';
import { DEFAULT_WHEEL_MM, groundAt, groundMassKg, topRun, gearMotor } from '@/lib/flight/ground';
import { MAX_COMPONENTS, MAX_MASS_G, MAX_MOTORS, MAX_POS_MM, motorKind, typicalMass } from '@/lib/flight/components';
import { meshBody, printedDensity, type Body, type Vec3 } from '@/lib/flight/mass';
import { trim } from '@/lib/flight/trim';
import { propDiameterMm } from '@/lib/flight/rotor';
import {
  NO_PARTS, PARTS_KEY, addMass, addMotor, loadParts, makeQuad, mountPoints, nextSpin, roundPos, patchMass, patchMotor, pushHistory, redoHistory,
  removePart, savedParts, snapToMount, undoHistory, type History, type Parts,
} from '@/lib/flight/layout';
import { BED_MM, fitsBed, meshStats } from '@/lib/quote';
import { exampleById } from '@/lib/examples';
import { buildOffThread } from '@/lib/buildOffThread';
import { applyAiShapes, customLabel } from '@/lib/aiCustomise';
import { DESIGNS_KEY, parseDesigns, upsertDesign } from '@/lib/designList';
import { PROJECT_KEY } from '@/lib/buildFlow';
import FlowStrip from '@/components/FlowStrip';
import {
  DEFAULT_SIZE, LABEL, MAX_GROUPED, MAX_SHAPES, MIN_SIZE, clampCoord, minZ, parseDesign, solidsSize, toStl,
  type Kind, type Shape, type V3,
} from '@/lib/playground';

const KEY = 'printpro3d.playground.v1';
const AI_KEY = 'printpro3d.aidesign.v1'; // written by the Draw it with AI form
const PROP_MOTOR = MOTORS.find((m): m is PropMotor => m.kind === 'prop')!;
const AiChat = dynamic(() => import('./AiChat').then((m) => m.AiChat), { ssr: false, loading: () => <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading AI…</p> });
const FlightHud = dynamic(() => import('./playground/FlightHud'), { ssr: false });
const clampPos = (v: number) => Math.max(-MAX_POS_MM, Math.min(MAX_POS_MM, v));
const asV3 = (p: Vec3): V3 => ({ x: p[0], y: p[1], z: p[2] });

const btnBase = 'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnIdle = 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
const btn = `${btnBase} ${btnIdle}`;
const on = 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600';
// active replaces the idle colours instead of adding to them, so only one background and text colour applies
const btnOn = (active: boolean) => `${btnBase} ${active ? on : btnIdle}`;
const primary =
  'min-h-11 whitespace-nowrap rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-5 py-3 transition-all duration-200';
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

type AiDraft = { title: string; notes: string; source: 'photo' | 'description' | 'copy'; shapes: Shape[] };

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
    return { title: clean(o.title, 60), notes: clean(o.notes, 300), source: o.source === 'photo' ? 'photo' : o.source === 'copy' ? 'copy' : 'description', shapes };
  } catch {
    return null;
  }
}

/** Project mode (initialShapes given): the shapes of a design project's blueprint. No localStorage, no price or upload; `onSave` turns edits into a new
 * revision (resolves to an error text, or null on success) and `readOnly` freezes the canvas. Without props this is the free-form builder. */
export type PlaygroundProject = { initialShapes: Shape[]; readOnly?: boolean; onSave?: (shapes: Shape[]) => Promise<string | null> };

export default function Playground({ project }: { project?: PlaygroundProject } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const example = project ? null : exampleById(params.get('example'));
  // captured once; the key is removed after mount (StrictMode runs initializers twice)
  const [aiDraft] = useState<AiDraft | null>(() => (!project && typeof window !== 'undefined' && params.get('from') === 'ai' ? loadAiDraft() : null));
  const wantSim = params.get('sim') === '1';
  const [aiOpen, setAiOpen] = useState(() => !project && params.get('ai') === '1'); // the AI panel, from 'Customise with AI' on a product
  const [aiApplied, setAiApplied] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [h, setH] = useState<History>(() => ({
    past: [], future: [],
    now: {
      shapes: project ? structuredClone(project.initialShapes) : example ? structuredClone(example.shapes) : aiDraft ? structuredClone(aiDraft.shapes) : load(),
      parts: project || example || aiDraft ? NO_PARTS : loadPartsSaved(),
    },
  }));
  const loadedExample = useRef(example?.id ?? null);
  const [from, setFrom] = useState(example); // the example this started from; outlives ?example= once the URL drops it (see autosave)
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
  const [dismissed, setDismissed] = useState(false);
  const [armed, setArmed] = useState<{ kind: PartKind; place: Placement | null; reason: string } | null>(null);
  const [armNote, setArmNote] = useState<string | null>(null);
  const [wheelMm, setWheelMm] = useState(DEFAULT_WHEEL_MM);
  const [aiRes, setAiRes] = useState<{ key: string; items: SuggestItem[] } | null>(null);
  const aiOff = useRef(false); // the server said no AI key: stop asking
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
  const remove = useCallback((id: string) => { commit((all) => { const gone = membersOf(all, id); return all.filter((s) => !gone.includes(s.id)); }); setSelectedId(null); }, [commit]);
  const removeP = useCallback((id: string) => { commitParts((p) => removePart(p, id)); setPartSel(null); }, [commitParts]);
  const selectShape = useCallback((id: string | null) => { setSelectedId(id); setPartSel(null); }, []);
  const selectPart = useCallback((id: string) => { setPartSel(id); setSelectedId(null); }, []);
  const motor = parts.motors.find((m) => m.id === partSel) ?? null;
  const mass = parts.components.find((c) => c.id === partSel) ?? null;
  const mounts = useMemo(() => mountPoints(shapes), [shapes]);
  const startPlace = (p: Placing, toggle = true) => {
    if (locked) return;
    if (p.kind === 'motor' && parts.motors.some((m) => m.motorId !== p.motorId)) { setNote('Do not mix motor models: a design is a drone (propeller motors) or a ground vehicle with one gear motor model. Delete the other motors first.'); return; }
    if (p.kind === 'motor' && parts.motors.length >= MAX_MOTORS) { setNote(`That is the limit: ${MAX_MOTORS} motors.`); return; }
    if (p.kind === 'mass' && parts.components.length >= MAX_COMPONENTS) { setNote(`That is the limit: ${MAX_COMPONENTS} parts.`); return; }
    setPlacing((cur) => (toggle && cur?.kind === p.kind && (p.kind === 'motor' || (cur as Placing & { name: string }).name === p.name) ? null : p));
    setSelectedId(null); setPartSel(null);
  };
  const place = (pos: Vec3) => {
    if (!placing) return;
    const out = placing.kind === 'motor' ? addMotor(parts, pos, placing.motorId) : addMass(parts, placing.name, [pos[0], pos[1], pos[2] + massHalfHeight(placing.name)]); // a part stores its centre: lift it onto the surface it was clicked on
    if (out.id) { commitParts(() => out.parts); setPartSel(out.id); }
    setPlacing(null);
  };
  const movePart = useCallback((id: string, pos: Vec3) => {
    const c = pos.map(clampPos) as Vec3;
    commitParts((p) => ({ motors: patchMotor(p, id, (m) => ({ ...m, pos: c })).motors, components: patchMass(p, id, (m) => ({ ...m, pos: c })).components }));
  }, [commitParts]);


  const uid = () => Math.random().toString(36).slice(2, 10);
  const full = () => {
    if (shapes.filter((s) => !s.group).length < MAX_SHAPES) return false;
    setNote(`That is the limit: ${MAX_SHAPES} shapes per model. Delete one to add another.`);
    return true;
  };
  const add = (kind: Kind, at?: { x: number; y: number }) => {
    if (locked || full()) return;
    const sz = DEFAULT_SIZE[kind];
    const id = uid();
    const n = shapes.length;
    // sits on the plate (a drop lands on the 5 mm grid), staggered so new shapes do not hide each other
    const xy = at ? { x: snapGrid(at.x), y: snapGrid(at.y) } : { x: ((n * 25 + 75) % 150) - 75, y: 0 };
    commit((all) => [...all, { id, kind, mode: 'solid', position: { ...xy, z: sz.z / 2 }, rotation: { x: 0, y: 0, z: 0 }, size: { ...sz } }]);
    setSelectedId(id);
  };
  /** A template at its default config, as grouped shapes. The shapes are built after the drop (client only), never while rendering. */
  const addTemplate = async (tid: string, at?: { x: number; y: number }) => {
    const t = templateById(tid);
    if (!t || locked) return;
    const grouped = () => shapesRef.current.filter((s) => s.group).length;
    if (grouped() >= MAX_GROUPED) { setNote('That is the limit for template parts. Delete one to add another.'); return; }
    let built: Shape[];
    try { built = (await import('@/lib/templates')).buildTemplate(t, defaultCfg(t)).shapes; } catch { setNote('That part could not be added. Try again.'); return; }
    if (grouped() + built.length > MAX_GROUPED) { setNote('That is the limit for template parts. Delete one to add another.'); return; }
    const n = new Set(shapesRef.current.flatMap((s) => (s.group ? [s.group] : []))).size;
    const placed = placeTemplate(built, t.id, uid(), at ?? { x: ((n * 40 + 80) % 160) - 80, y: 0 });
    commit((all) => [...all, ...placed]);
    setSelectedId(placed[0].id);
  };
  const duplicate = () => {
    if (!sel || locked) return;
    const ids = membersOf(shapes, sel.id);
    if (sel.group ? shapes.filter((s) => s.group).length + ids.length > MAX_GROUPED : full()) { setNote('That is the limit. Delete something to duplicate.'); return; }
    const copies = cloneShapes(shapes, ids, { x: 10, y: 10, z: 0 }, uid);
    commit((all) => [...all, ...copies]);
    setSelectedId(copies[ids.indexOf(sel.id)].id);
  };
  const rotate = () => { if (selectedId && !locked) commit((all) => rotateZ90(all, membersOf(all, selectedId))); };
  const nudgeSel = (dx: number, dy: number) => {
    if (locked) return;
    if (partSel) { const cur = motor?.pos ?? mass?.pos; if (cur) movePart(partSel, [cur[0] + dx, cur[1] + dy, cur[2]]); }
    else if (selectedId) commit((all) => moveBy(all, membersOf(all, selectedId), { x: dx, y: dy, z: 0 }), `n${selectedId}`);
  };
  const act = useRef({ rotate, nudge: nudgeSel, dup: duplicate });
  act.current = { rotate, nudge: nudgeSel, dup: duplicate };

  // palette drag: the item is kept here because a drag hides its data from dragover; the canvas raycasts the screen position
  const dnd = useRef<DndApi | null>(null);
  const dragging = useRef<DragItem | null>(null);
  const onDragOver = (e: React.DragEvent) => {
    if (!dragging.current || locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragging.current.t === 'part') dnd.current?.hover(e.clientX, e.clientY);
  };
  const onDrop = (e: React.DragEvent) => {
    const d = dragging.current;
    dragging.current = null;
    dnd.current?.clear();
    if (!d || locked) return;
    e.preventDefault();
    const p = dnd.current?.pick(e.clientX, e.clientY, d.t === 'part');
    if (!p) { setPlacing(null); return; }
    if (d.t === 'tpl') void addTemplate(d.id, { x: p[0], y: p[1] });
    else if (d.t === 'shape') add(d.id, { x: p[0], y: p[1] });
    else place(roundPos(d.placing.kind === 'motor' ? snapToMount(p, mounts).pos : p));
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
      setSelectedId(null); setPartSel(null); setSimulate(false); setFrom(example);
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
    if (example) { // edited example: drop ?example= so a reload reopens the saved work, not the pristine example
      const u = new URL(window.location.href);
      u.searchParams.delete('example'); u.searchParams.delete('price');
      window.history.replaceState(window.history.state, '', u);
      loadedExample.current = null; // following the example link again reloads it
    }
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
      } else if (e.key === 'Escape') { setPlacing(null); setArmed(null); }
      else if (typing || locked || e.altKey) return;
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); act.current.dup(); }
      else if (e.ctrlKey || e.metaKey) return;
      else if (e.key.toLowerCase() === 'r' && selectedId) { e.preventDefault(); act.current.rotate(); }
      else if ((selectedId || partSel) && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const k = e.shiftKey ? NUDGE_FINE_MM : NUDGE_MM;
        act.current.nudge(e.key === 'ArrowLeft' ? -k : e.key === 'ArrowRight' ? k : 0, e.key === 'ArrowDown' ? -k : e.key === 'ArrowUp' ? k : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, remove, removeP, selectedId, partSel, locked]);

  const applyAi = (raw: Shape[]) => {
    const next = applyAiShapes(h, raw);
    if (!next) { setNote('The AI change could not be applied.'); return; }
    touched.current = true;
    setH(next); setSelectedId(null); setAiApplied(true); setSavedNote(null);
  };
  // the sandbox copy becomes a design project (My designs); approving, building and ordering then use the existing safe path
  const copyName = customLabel(from?.title ?? aiDraft?.title ?? 'My design');
  const saveCopy = async () => {
    setSaving(true); setSavedNote(null);
    try {
      const res = await fetch('/api/designs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'shapes', title: copyName, shapes: shapesRef.current }) });
      const d = (await res.json().catch(() => ({}))) as { project?: { id?: string }; error?: string };
      if (!res.ok || !d.project?.id) { setSavedNote(d.error || 'The design could not be saved. Try again.'); return; }
      try {
        localStorage.setItem(PROJECT_KEY, d.project.id);
        localStorage.setItem(DESIGNS_KEY, JSON.stringify(upsertDesign(parseDesigns(localStorage.getItem(DESIGNS_KEY), null), d.project.id, copyName)));
      } catch {}
      router.push('/playground?mode=build');
    } catch { setSavedNote('The design could not be saved. Try again.'); } finally { setSaving(false); }
  };

  const build = async (onlyLoose = false) => {
    setBusy(true);
    setNote(null);
    const snapshot = shapesRef.current;
    try {
      const tris = await buildOffThread(onlyLoose ? snapshot.filter((s) => !s.group) : snapshot);
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
    const tris = await build(true); // template groups are priced on their own, from the BOM
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

  // ?price=1 with a valid example (the gallery's "Get a price") or an AI chat design (its "Price"): price it once, after the design is in place
  useEffect(() => {
    if (autoPriced.current || !(example || aiDraft) || params.get('price') !== '1' || !hasSolid) return;
    autoPriced.current = true;
    void price();
  });

  // a grouped shape only moves, and drags its whole group with it
  const pose = useCallback((id: string, p: Pose) => commit((all) => {
    const c = all.find((s) => s.id === id);
    if (c?.group) return moveBy(all, membersOf(all, id), { x: p.position.x - c.position.x, y: p.position.y - c.position.y, z: p.position.z - c.position.z });
    return all.map((s) => (s.id === id ? { ...s, ...p } : s));
  }), [commit]);
  const loose = useMemo(() => shapes.filter((s) => !s.group), [shapes]);
  const hasLoose = solidsSize(loose) !== null;
  const highlight = sel?.group ? membersOf(shapes, sel.id) : [];
  const groupName = (g: string) => templateById(shapes.find((s) => s.group === g)?.tpl)?.name ?? 'Template';
  const names = shapes.map((s, i) => `${LABEL[s.kind]} ${shapes.slice(0, i + 1).filter((o) => o.kind === s.kind).length}`);
  const fits = size ? fitsBed(size) : false;
  const frameReady = frame?.of === shapes;
  const isGround = parts.motors.length > 0 && parts.motors.every((m) => motorKind(m.motorId) === 'gear');
  const sim = useMemo<SimView | null>(() => {
    if (!simulate || isGround || parts.motors.length < 3 || !frameReady) return null;
    try {
      const t = trim({ motors: parts.motors, components: parts.components, frame: frame?.body ?? undefined });
      return { cg: [t.cgMm[0], t.cgMm[1], t.cgMm[2]], arrows: parts.motors.map((m, i) => ({ pos: m.pos, thrustN: t.motors[i].thrustN, maxN: t.motors[i].maxThrustN })) };
    } catch { return null; }
  }, [simulate, isGround, parts, frame, frameReady]);
  const spinNow = nextSpin(parts.motors);
  const gres = useMemo(() => {
    const gm = isGround ? gearMotor(parts.motors[0].motorId) : null;
    const massKg = groundMassKg(parts.components, frame?.of === shapes ? frame.body : null);
    if (!gm || !(massKg > 0) || !(wheelMm > 0)) return null;
    try { return groundAt({ run: topRun(gm), motors: parts.motors.length, wheelMm, massKg }); } catch { return null; }
  }, [isGround, parts, frame, shapes, wheelMm]);

  // ---- suggestions: rules always, AI re-ranking when the server has a key ----
  const droneish = !isGround && (from?.category === 'drone' || wantSim || parts.motors.length > 0 || parts.components.length > 0); // suggestions are drone-only
  const rules = useMemo(() => (!project && !locked && droneish ? suggestItems(shapes, parts, { category: 'drone' }) : []), [project, locked, droneish, shapes, parts]);
  const designKey = useMemo(() => (rules.length ? JSON.stringify([shapes, parts]) : ''), [rules, shapes, parts]);
  const items = aiRes && aiRes.key === designKey ? aiRes.items : rules;
  useEffect(() => {
    if (!rules.length || aiOff.current) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shapes, parts }), signal: ctl.signal });
        if (!res.ok) return;
        const reply: unknown = await res.json();
        if (reply && typeof reply === 'object' && (reply as { ai?: unknown }).ai === false) { aiOff.current = true; return; }
        const merged = mergeAi(rules, reply, shapes, parts);
        if (merged) setAiRes({ key: designKey, items: merged });
      } catch { /* any failure: the rules stay */ }
    }, 1500);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [rules, designKey, shapes, parts]);
  useEffect(() => { setArmed(null); setArmNote(null); }, [shapes, parts]);

  const commitPlace = (kind: PartKind, place: Placement): boolean => {
    if (locked) return false;
    const out = kind === 'motor' ? addMotor(parts, place.posMm, PROP_MOTOR.id) : addMass(parts, MASS_NAME[kind], place.posMm);
    if (!out.id) { setArmNote(kind === 'motor' ? `That is the limit: ${MAX_MOTORS} motors.` : `That is the limit: ${MAX_COMPONENTS} parts.`); return false; }
    let next = out.parts;
    const id = out.id, spin = place.spin;
    if (kind === 'motor' && spin) next = patchMotor(next, id, (m) => ({ ...m, spin }));
    if (kind !== 'motor' && (place.yawDeg || place.tiltDeg)) next = patchMass(next, id, (c) => ({ ...c, yawDeg: place.yawDeg, tiltDeg: place.tiltDeg })); // saved with the part
    commitParts(() => next);
    setPartSel(id); setSelectedId(null); setPlacing(null);
    return true;
  };
  const armSuggestion = (kind: PartKind) => {
    if (armed?.kind === kind) { setArmed(null); return; }
    const it = items.find((i) => i.kind === kind);
    if (!it) return;
    setPlacing(null); setSelectedId(null); setPartSel(null); setArmNote(null);
    setArmed({ kind, place: it.place.posMm ? it.place : null, reason: it.place.reason });
  };
  const nudgeArmed = (d: { dx?: number; dy?: number; dYaw?: number }) => {
    if (!armed?.place) return;
    const r = nudge(armed.kind, armed.place, d, shapes, parts);
    if (r.ok) { setArmed({ ...armed, place: r.place, reason: r.place.reason }); setArmNote(null); } else setArmNote(r.why);
  };
  // the suggested spot for the part picked with the "+" chips
  const picked = useMemo<{ kind: PartKind; place: Placement } | null>(() => {
    if (!placing || project || locked) return null;
    const kind = placing.kind === 'motor' ? 'motor' : kindOfMassName(placing.name);
    const r = kind ? suggestPlacement(kind, shapes, parts) : null;
    return kind && r?.posMm ? { kind, place: r } : null;
  }, [placing, project, locked, shapes, parts]);
  const glyphOf = (kind: PartKind, place: Placement): Placing => (kind === 'motor' ? { kind: 'motor', spin: place.spin ?? 'ccw', motorId: PROP_MOTOR.id } : { kind: 'mass', name: MASS_NAME[kind] });
  const hints: Hint[] = armed?.place
    ? [{ pos: armed.place.posMm, yawDeg: armed.place.yawDeg, tiltDeg: armed.place.tiltDeg, glyph: glyphOf(armed.kind, armed.place), strong: true }]
    : picked ? [{ pos: picked.place.posMm, yawDeg: picked.place.yawDeg, tiltDeg: picked.place.tiltDeg, glyph: glyphOf(picked.kind, picked.place), strong: false }] : [];

  return (
    <div className="space-y-6">
      {!project && <FlowStrip current="adjust" />}
      {!project && <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Build it myself</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add shapes, move and resize them, and mark some as holes to cut them out. Everything is in millimetres; the flat grid is the print plate.
        </p>
      </div>}

      {from && (
        <p className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
          Started from the example &lsquo;{from.title}&rsquo;. Your changes are saved only in this browser.
        </p>
      )}

      {!project && aiOpen && (from || aiDraft?.source === 'copy') && (
        <p role="status" className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
          Your sandbox copy &lsquo;{copyName}&rsquo;. The original is untouched; apply AI changes here, then save it as a design or price it.
        </p>
      )}

      {aiDraft && aiDraft.source !== 'copy' && (
        <p role="status" className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-200">
          Drawn by AI from your {aiDraft.source}{aiDraft.title ? `: "${aiDraft.title}"` : ''}.{aiDraft.notes ? ` ${aiDraft.notes}` : ''} AI can get sizes wrong. Check them before you order.
        </p>
      )}

      <div ref={editor} className={`grid grid-cols-1 gap-4 ${project ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'lg:grid-cols-[230px_minmax(0,1fr)_340px]'}`}>
        {!project && (
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <Palette
              disabled={locked} armed={placing} spin={spinNow}
              onShape={(k) => add(k)} onTemplate={(id) => void addTemplate(id)}
              onPart={(p) => startPlace(p.kind === 'motor' && motorKind(p.motorId) === 'gear' ? { ...p, spin: 'cw' } : p)}
              onDragStart={(d) => { dragging.current = d; if (d.t === 'part') startPlace(d.placing.kind === 'motor' && motorKind(d.placing.motorId) === 'gear' ? { ...d.placing, spin: 'cw' } : d.placing, false); }}
              onDragEnd={() => { const d = dragging.current; dragging.current = null; dnd.current?.clear(); if (d?.t === 'part') setPlacing(null); }}
            />
          </div>
        )}
        <div className="space-y-3 min-w-0">
          {project && <div className="flex flex-wrap gap-2" role="group" aria-label="Add a shape">
            {(Object.keys(LABEL) as Kind[]).map((k) => (
              <button key={k} type="button" onClick={() => add(k)} disabled={locked} aria-label={`Add ${LABEL[k]}`} title={`Add ${LABEL[k]}`} className={btn}><Icon name="plus" className="h-4 w-4" />{LABEL[k]}</button>
            ))}
          </div>}
          {!project && !locked && !dismissed && <SuggestBar items={items} armed={armed?.kind ?? null} aiRanked={items.some((i) => i.ai)} onPick={armSuggestion} onDismiss={() => { setDismissed(true); setArmed(null); }} />}
          {!project && !locked && dismissed && items.length > 0 && <button type="button" onClick={() => setDismissed(false)} aria-label="Show suggestions" title="Show suggestions" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm text-indigo-700 dark:text-indigo-300 underline"><Icon name="bolt" className="h-4 w-4" />Suggest</button>}
          {armed && <ArmedPanel kind={armed.kind} place={armed.place} reason={armed.reason} note={armNote} onAccept={() => armed.place && commitPlace(armed.kind, armed.place)} onNudge={nudgeArmed} onIgnore={() => setArmed(null)} />}
          {placing && (
            <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
              {placing.kind === 'motor'
                ? `Move over the model and click to place the ${motorKind(placing.motorId) === 'gear' ? 'gear motor (its wheel sits at the motor)' : 'motor'}. It snaps to a mount point (top of a cylinder or a hole) within 8 mm. Press Esc to cancel.`
                : `Move over the model and click to place the ${placing.name}. Press Esc to cancel.`}
              {picked && (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <span>Suggested spot (faint): {picked.place.reason}</span>
                  <button type="button" onClick={() => commitPlace(picked.kind, picked.place)} aria-label="Place at suggested spot" title="Place at suggested spot" className={`${btn} py-1`}><Icon name="check" className="h-4 w-4" />Place</button>
                </span>
              )}
            </p>
          )}

          <div onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => dnd.current?.clear()} className={`relative h-[55vh] min-h-[320px] lg:h-[560px] rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 ${placing ? 'cursor-crosshair' : ''}`}>
            <PlaygroundScene
              shapes={shapes} selectedId={sel?.id ?? null} tool={sel?.group ? 'translate' : tool} highlight={highlight} dndRef={dnd} onSelect={selectShape} onPose={pose}
              parts={parts} partSel={partSel} onSelectPart={selectPart} onMovePart={movePart}
              placing={placing} mounts={mounts} onPlace={place} locked={locked} sim={sim} estimated={estimated} hints={hints} wheelMm={wheelMm} wheelSpin={simulate && gres?.moves ? Math.min(gres.omegaTop, 8) : 0}
            />
            {!project && !locked && (sel || partSel) && (
              <div role="toolbar" aria-label="Selection" className="absolute inset-x-0 bottom-3 flex justify-center gap-2 lg:hidden">
                {([['Rotate', 'reset', rotate, !sel], ['Duplicate', 'copy', duplicate, !sel], ['Delete', 'trash', () => (partSel ? removeP(partSel) : sel && remove(sel.id)), false]] as const).map(([name, icon, fn, off]) => (
                  <button key={name} type="button" onClick={fn} disabled={off} aria-label={name} title={name} className={`${btn} min-w-11 bg-white/90 dark:bg-gray-900/90`}><Icon name={icon} className="h-5 w-5" /></button>
                ))}
              </div>
            )}
            {simulate && (
              <FlightHud ground={isGround ? { res: gres, wheelMm, onWheelMm: setWheelMm, run: topRun(gearMotor(parts.motors[0].motorId)!) } : null} motors={parts.motors} components={parts.components} frame={frame?.body ?? null} frameMm={size ? { x: size.x, y: size.y } : null} frameState={frameReady ? 'ready' : 'building'} />
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
            <button type="button" onClick={undo} disabled={locked || !h.past.length} className={btn}><Icon name="undo" className="h-4 w-4" />Undo</button>
            <button type="button" onClick={redo} disabled={locked || !h.future.length} className={btn}><Icon name="redo" className="h-4 w-4" />Redo</button>
            <button type="button" onClick={duplicate} disabled={locked || !sel} className={btn}><Icon name="copy" className="h-4 w-4" />Duplicate</button>
            <button type="button" onClick={() => (partSel ? removeP(partSel) : sel && remove(sel.id))} disabled={locked || (!sel && !partSel)} className={btn}><Icon name="trash" className="h-4 w-4" />Delete</button>
            <button type="button" onClick={clearAll} disabled={locked || !shapes.length} aria-label="Clear all" title="Clear all" className={btn}><Icon name="x" className="h-4 w-4" />Clear</button>
          </div>
        </div>

        <aside className="space-y-4 min-w-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {!project && (
            <div role="group" aria-label="Sidebar" className="flex gap-2">
              <button type="button" aria-pressed={!aiOpen} onClick={() => setAiOpen(false)} className={`${btnOn(!aiOpen)} flex-1`}>Edit</button>
              <button type="button" aria-pressed={aiOpen} onClick={() => setAiOpen(true)} aria-label="Customise with AI" title="Customise with AI" className={`${btnOn(aiOpen)} flex-1`}><Icon name="spark" className="h-4 w-4" />AI</button>
            </div>
          )}
          {!project && aiOpen && (
            <section aria-label="Customise with AI" className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:rounded-t-2xl max-lg:shadow-2xl space-y-2 rounded-xl border border-gray-200 bg-white p-0 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
                <h3 className={`${heading} mr-auto`}>Customise with AI</h3>
                <button type="button" onClick={() => setAiOpen(false)} aria-label="Close the AI panel" title="Close the AI panel" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="x" className="h-4 w-4" /></button>
              </div>
              <div className="min-h-0">
                <AiChat compact={{ base: shapes, onApply: applyAi }} />
              </div>
              {aiApplied && (
                <div className="space-y-1 border-t border-gray-200 p-3 dark:border-gray-800">
                  <button type="button" onClick={saveCopy} disabled={saving || !hasSolid} aria-label={`Save as ${copyName}`} title={`Save as ${copyName}`} className={`${primary} inline-flex w-full items-center justify-center gap-2`}><Icon name="check" />{saving ? 'Saving' : 'Accept: save as design'}</button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Saves &lsquo;{copyName}&rsquo; to My designs. You approve and order it there. Or use Price to quote it now. Undo reverts an applied change.</p>
                  {savedNote && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{savedNote}</p>}
                </div>
              )}
            </section>
          )}
          <div className={`space-y-4 ${aiOpen && !project ? 'lg:hidden' : ''}`}>
          <div className={panel} aria-live="polite">
            <h3 className={heading}>{project ? 'Your model' : 'Your model / Get a price'}</h3>
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
                      {project ? (
              project.onSave && !project.readOnly && (
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={save} disabled={!h.past.length || !hasSolid || saving} aria-label="Save as a new revision" title="Save as a new revision" className={`${primary} inline-flex items-center gap-2`}>
                    <Icon name="check" />{saving ? 'Saving' : 'Save'}
                  </button>
                  {!h.past.length && <p className="text-sm text-gray-500 dark:text-gray-400">Change something to save a revision.</p>}
                </div>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={price} disabled={!hasLoose || busy} aria-label="Get a price" title="Get a price" className={`${primary} inline-flex items-center gap-2`}><Icon name="tag" />{busy ? 'Building' : 'Price'}</button>
                {busy && <span role="status" className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Building your model…</span>}
                <button type="button" onClick={download} disabled={!hasSolid || busy} aria-label="Download STL" title="Download STL" className={`${btn} py-3`}><Icon name="download" className="h-4 w-4" />STL</button>
                {!hasLoose && <p className="text-sm text-gray-500 dark:text-gray-400">{hasSolid ? 'Template parts are priced in the bill of materials.' : 'Add at least one solid shape first.'}</p>}
              </div>
            )}
          </div>
          <div className={panel}>
            <h3 className={heading}>Shapes</h3>
            {shapes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nothing yet. Add a shape to start.</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {shapes.map((s, i) => (s.group && shapes.findIndex((o) => o.group === s.group) !== i ? null : (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={s.group ? sel?.group === s.group : s.id === sel?.id}
                      onClick={() => !locked && selectShape(s.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-left ${(s.group ? sel?.group === s.group : s.id === sel?.id) ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                      <span className="min-w-0">
                        <span className="block">{s.group ? groupName(s.group) : names[i]}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{s.group ? `${shapes.filter((o) => o.group === s.group).length} parts, moves as one` : `L ${fmt(s.size.x)} × W ${fmt(s.size.y)} × H ${fmt(s.size.z)} mm`}</span>
                      </span>
                      <span className={`text-xs ${s.mode === 'hole' && !s.group ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{s.group ? 'Template' : s.mode === 'hole' ? 'Hole' : 'Solid'}</span>
                    </button>
                  </li>
                )))}
              </ul>
            )}
          </div>

          {(motor || mass) && !locked && (
            <div className={panel}>
              {motor && (
                <>
                  <h3 className={heading}>Motor {motor.id}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{MOTORS.find((x) => x.id === motor.motorId)?.name}, {motorKind(motor.motorId) === 'gear' ? `${wheelMm} mm wheel (set in Simulate)` : `${propDiameterMm(PROP_MOTOR.prop).toFixed(0)} mm prop`}. Not part of the printed model.</p>
                  {motorKind(motor.motorId) === 'prop' && <div className="flex gap-2" role="group" aria-label="Spin direction">
                    {(['cw', 'ccw'] as const).map((d) => (
                      <button key={d} type="button" aria-pressed={motor.spin === d} onClick={() => commitParts((p) => patchMotor(p, motor.id, (m) => ({ ...m, spin: d })))} aria-label={`Spin ${d === 'cw' ? 'CW' : 'CCW'}`} title={`Spin ${d === 'cw' ? 'CW' : 'CCW'}`} className={`${btnOn(motor.spin === d)} flex-1`}>
                        {d === 'cw' ? 'CW' : 'CCW'}
                      </button>
                    ))}
                  </div>}
                  <PosRow value={motor.pos} onChange={(pos) => commitParts((p) => patchMotor(p, motor.id, (m) => ({ ...m, pos })), `mp${motor.id}`)} />
                  {motorKind(motor.motorId) === 'prop' && <>
                    <button type="button" onClick={() => commitParts((p) => makeQuad(p, motor.id))} aria-label="Make 4 (quad-X)" title="Make 4 (quad-X)" className={`${btn} w-full`}>Quad</button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Quad-X copies this motor&rsquo;s distance from the centre to all four corners and replaces the motors you have.</p>
                  </>}
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
                    <button type="button" onClick={() => { const t = typicalMass(mass.name)!; setEstimated((x) => [...x, mass.id]); commitParts((p) => patchMass(p, mass.id, (c) => ({ ...c, massG: t.massG }))); }} aria-label="Use typical value" title="Use typical value" className={`${btn} w-full`}>
                      Typical
                    </button>
                  )}
                  {estimated.includes(mass.id) && <p className="text-xs text-amber-700 dark:text-amber-300">ESTIMATE: typical {mass.name}, real parts vary widely. Weigh yours.</p>}
                  <PosRow value={mass.pos} onChange={(pos) => commitParts((p) => patchMass(p, mass.id, (c) => ({ ...c, pos })), `cp${mass.id}`)} />
                </>
              )}
            </div>
          )}

          {sel?.group && !locked && (
            <div className={panel}>
              <h3 className={heading}>{groupName(sel.group)}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{highlight.length} parts at the default settings. Drag to move them as one. R turns 90°, arrow keys nudge 5 mm (Shift 1 mm), Ctrl/Cmd+D duplicates.</p>
            </div>
          )}
          {!project && <Bom shapes={shapes} parts={parts} onPrice={price} priceBusy={busy} onSave={hasSolid ? saveCopy : undefined} saving={saving} note={savedNote} />}

          {sel && !sel.group && !locked && (
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
              <button type="button" onClick={() => patch(sel.id, (s) => ({ ...s, position: { ...s.position, z: s.position.z - minZ(s) } }))} aria-label="Drop to plate" title="Drop to plate" className={`${btn} w-full`}>
                Drop
              </button>
            </div>
          )}

          </div>
        </aside>
      </div>

      {note && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}

      {!project && (
        <>
          <div aria-hidden className="h-16 lg:hidden" />
          <div className="pp-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden dark:border-gray-700 dark:bg-gray-900/95">
            <span className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-200">{size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} mm` : 'Add a solid shape'}</span>
            <button type="button" onClick={() => setAiOpen(true)} aria-label="Customise with AI" title="Customise with AI" className={`${btn} ml-auto`}><Icon name="spark" className="h-4 w-4" />AI</button>
            <button type="button" onClick={price} disabled={!hasLoose || busy} aria-label="Get a price" title="Get a price" className={`${primary} inline-flex items-center gap-2`}><Icon name="tag" />{busy ? 'Building' : 'Price'}</button>
          </div>
        </>
      )}

      <div ref={offerRef} className="scroll-mt-20">
        {offer && <UploadForm key={offer.key} initialFile={offer.file} onQuote={scrollToOffer} />}
      </div>
    </div>
  );
}
