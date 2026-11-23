// Pure helpers for the blueprint-first Build page: step gating, error mapping, labels. No React, no fetch.
// `import type` only: designProjects.ts is server code and must not reach the browser bundle.
import type { Project, Revision, Status } from './designProjects.ts';
import type { Blueprint, BlueprintDiff, Change } from './designBlueprint.ts';
import { solidsSize, type Shape } from './playground.ts';
import { BED_MM, fitsBed, type MeshStats } from './quote.ts';

export type ProjectView = Omit<Project, 'email'>;
export type Caps = { ai: boolean; meshy: boolean; tier: string; revisions: number };

export const PROMPT_MAX = 600;
export const CHANGE_MAX = 300;
export const PROJECT_KEY = 'printpro3d.design.v1';
export const EMAIL_KEY = 'printpro3d.designemail.v1';

// ---------- steps ----------

export const STEPS = ['plan', 'approve', 'build', 'order'] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = { plan: 'Plan', approve: 'Approve', build: 'Build', order: 'Order' };

const RANK: Record<Status, number> = { draft: 0, approved: 1, finalized: 2, ordered: 3 };

/** Which steps a project in this status may open. Plan and Approve can always be looked at; Build needs an approval, Order a finalized file. */
export const stepAllowed = (step: Step, status: Status): boolean => (step === 'plan' || step === 'approve' ? true : step === 'build' ? RANK[status] >= 1 : RANK[status] >= 2);

/** Where a project lands when it is opened or resumed. */
export const defaultStep = (status: Status): Step => (status === 'draft' ? 'plan' : status === 'approved' ? 'build' : 'order');

const DONE_AT: Record<Step, number> = { plan: 1, approve: 1, build: 2, order: 3 };
export type StepView = { step: Step; label: string; allowed: boolean; done: boolean; current: boolean };
export const stepViews = (status: Status, current: Step): StepView[] =>
  STEPS.map((step) => ({ step, label: STEP_LABEL[step], allowed: stepAllowed(step, status), done: RANK[status] >= DONE_AT[step], current: step === current }));

/** A step that is no longer allowed (a stale stored step) falls back to the default one. */
export const settleStep = (step: Step, status: Status): Step => (stepAllowed(step, status) ? step : defaultStep(status));

export const isFrozen = (status: Status) => status !== 'draft';
/** "Place order" is on only for a finalized project: an ordered one is already in the owner's queue. */
export const canPlaceOrder = (status: Status) => status === 'finalized';

// ---------- errors ----------

export type ErrorKind = 'rate_limit' | 'ai_off' | 'invalid' | 'conflict' | 'missing' | 'network' | 'server';
export type UiError = { kind: ErrorKind; text: string };

/** Maps an HTTP status and the server's message to something the page can show plainly. The 422 reason is the server's own words. */
export function mapError(status: number, message?: string): UiError {
  const m = (message ?? '').trim();
  if (status === 0) return { kind: 'network', text: 'We could not reach the server. Check your connection and try again.' };
  if (status === 429) return { kind: 'rate_limit', text: m || 'Too many requests. Try again later, or edit by hand.' };
  if (status === 503) return { kind: 'ai_off', text: m || 'AI is not set up on this site. You can still start from a template or edit by hand.' };
  if (status === 422 || status === 400) return { kind: 'invalid', text: m || 'That did not work. Change it and try again.' };
  if (status === 404 || status === 410) return { kind: 'missing', text: m || 'That design is no longer available.' };
  if (status === 409) return { kind: 'conflict', text: m || 'That is not possible in the design\'s current state.' };
  return { kind: 'server', text: m || 'Something went wrong. Please try again.' };
}

// ---------- AI revision budget ----------

export const aiUsage = (p: Pick<ProjectView, 'aiRevisions' | 'source'>, cap: number) => ({
  used: p.aiRevisions, cap, left: Math.max(0, cap - p.aiRevisions),
  text: `${p.aiRevisions} of ${cap} used`,
  exhausted: p.aiRevisions >= cap,
});

// ---------- revisions ----------

export type RevRow = { n: number; label: string; by: Revision['by']; request?: string; current: boolean; approved: boolean };
export const revisionRows = (p: ProjectView): RevRow[] =>
  [...p.revisions].sort((a, b) => a.n - b.n).map((r) => ({ n: r.n, label: `v${r.n}`, by: r.by, request: r.request, current: r.n === p.current, approved: r.n === p.approvedRev }));

export const currentRevision = (p: ProjectView): Revision => p.revisions.find((r) => r.n === p.current) ?? p.revisions[p.revisions.length - 1];
export const previousRevision = (p: ProjectView): Revision | null => {
  const par = currentRevision(p).parent;
  return par === null ? null : (p.revisions.find((r) => r.n === par) ?? null);
};
/** Undo only moves back to the parent, and only while the design is a draft. */
export const canUndo = (p: ProjectView) => p.status === 'draft' && currentRevision(p).parent !== null;

export const BY_LABEL: Record<Revision['by'], string> = { ai: 'AI', manual: 'By hand', template: 'Template', mesh: 'Uploaded model' };

// ---------- blueprint facts ----------

const r1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const fmtMm = (n: number) => `${r1(n)} mm`;
export const fmtSize = (s: { x: number; y: number; z: number }) => `${r1(s.x)} × ${r1(s.y)} × ${r1(s.z)} mm`;

export type PartRow = { id: string; name: string; role: string; dims: string };
/** One row per part: name, role and the size of its solid shapes together (mm). */
export const partRows = (b: Blueprint): PartRow[] =>
  b.parts.map((p) => {
    const s = solidsSize(p.shapes);
    return { id: p.id, name: p.name, role: p.role, dims: s ? fmtSize(s) : 'holes only' };
  });

/** "Assumptions" are the AI's notes, one per sentence. */
export const noteItems = (notes: string): string[] => notes.split(/\n+|(?<=[.;!?])\s+/).map((t) => t.trim()).filter(Boolean);

export const bedFit = (b: Blueprint) => {
  const ok = fitsBed(b.envelope);
  return { ok, text: ok ? 'Fits our print area.' : `Too big for our ${BED_MM.x}×${BED_MM.y}×${BED_MM.z} mm print area.` };
};

/** Estimated weight in grams in the given material density and fill (same formula as quote()). */
export const estGrams = (stats: MeshStats | null, density = 1.24, fill = 0.4): number | null => (stats ? stats.volumeCm3 * density * fill : null);

// ---------- diff ----------

const unitOf = (field: string) => (field.startsWith('rotation') ? '°' : field.startsWith('position') || field.startsWith('size') ? ' mm' : '');
const val = (v: number | string, field: string) => (typeof v === 'number' ? `${r1(v)}${unitOf(field)}` : v);
const FIELD_LABEL: Record<string, string> = { x: 'x', y: 'y', z: 'z' };

export type DiffRow = { kind: 'added' | 'removed' | 'changed'; what: string; detail: string };
/** Rows for the diff table: added and removed shapes first, then each changed field as "old → new". */
export function diffRows(d: BlueprintDiff): DiffRow[] {
  const change = (c: Change): DiffRow => {
    const [g, axis] = c.field.split('.');
    const f = axis ? `${g} ${FIELD_LABEL[axis] ?? axis}` : c.field;
    return { kind: 'changed', what: c.what, detail: `${f}: ${val(c.from, c.field)} → ${val(c.to, c.field)}` };
  };
  return [
    ...d.added.map((what): DiffRow => ({ kind: 'added', what, detail: 'added' })),
    ...d.removed.map((what): DiffRow => ({ kind: 'removed', what, detail: 'removed' })),
    ...d.changed.map(change),
  ];
}

// ---------- storage and input ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** localStorage is untrusted: only a UUID is a project id. */
export const parseStoredId = (raw: unknown): string | null => (typeof raw === 'string' && UUID.test(raw.trim()) ? raw.trim().toLowerCase() : null);
/** ?prompt= pass-through: collapse whitespace, cap at PROMPT_MAX. */
export const prefillPrompt = (raw: string | null): string => (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, PROMPT_MAX);
export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ---------- hand edits ----------

/** Turns the Playground's flat shape list back into a blueprint: shapes keep the part they were in, new shapes go into an "Added shapes" part,
 * parts left empty are dropped (with their features). The server validates and recomputes the envelope; this only has to be well-formed. */
export function reassign(b: Blueprint, shapes: Shape[]): Blueprint {
  const home = new Map(b.parts.flatMap((p) => p.shapes.map((s): [string, string] => [s.id, p.id])));
  const parts = b.parts.map((p) => ({ ...p, shapes: shapes.filter((s) => home.get(s.id) === p.id) }));
  const added = shapes.filter((s) => !home.has(s.id));
  if (added.length) {
    let id = 'added';
    while (parts.some((p) => p.id === id)) id += '_';
    parts.push({ id, name: 'Added shapes', role: 'added by hand', shapes: added });
  }
  const kept = parts.filter((p) => p.shapes.length);
  const envelope = solidsSize(shapes) ?? b.envelope;
  return {
    ...b, envelope, parts: kept,
    features: b.features.filter((f) => kept.some((p) => p.id === f.partId)),
    constraints: { ...b.constraints, fitsBed: fitsBed(envelope) },
  };
}
