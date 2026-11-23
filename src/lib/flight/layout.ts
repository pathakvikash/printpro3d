// Pure helpers for the Playground's motor/mass components: mount-point snapping, placement, quad-X, undo history, storage parsing.
// Frame coordinates are the Playground's: mm, x right, y forward, z up.
import type { Shape } from '../playground.ts';
import { MAX_COMPONENTS, MAX_MOTORS, parseComponents, quadX, type MassComponent, type Motor } from './components.ts';
import type { Vec3 } from './mass.ts';

export const SNAP_MM = 8;
export const PARTS_KEY = 'printpro3d.playground.components.v1';
export const MASS_PARTS = ['Battery', 'ESC', 'Flight controller', 'Camera', 'Payload'] as const;
export type Parts = { motors: Motor[]; components: MassComponent[] };
export const NO_PARTS: Parts = { motors: [], components: [] };

/** Top-face centres of solid, upright cylinders; hole cylinders add their axis at the surface of a solid cylinder under them (else at their own centre). */
export function mountPoints(shapes: Shape[]): Vec3[] {
  const upright = (s: Shape) => s.kind === 'cylinder' && Math.abs(s.rotation.x) < 1e-6 && Math.abs(s.rotation.y) < 1e-6;
  const solids = shapes.filter((s) => s.mode === 'solid' && upright(s));
  const out: Vec3[] = solids.map((s) => [s.position.x, s.position.y, s.position.z + s.size.z / 2]);
  for (const h of shapes.filter((s) => s.mode === 'hole' && upright(s))) {
    const under = solids.filter((s) => Math.hypot(s.position.x - h.position.x, s.position.y - h.position.y) <= s.size.x / 2);
    const z = under.length ? Math.max(...under.map((s) => s.position.z + s.size.z / 2)) : h.position.z;
    if (!out.some((p) => Math.hypot(p[0] - h.position.x, p[1] - h.position.y) < 1)) out.push([h.position.x, h.position.y, z]);
  }
  return out;
}

/** Nearest mount point within SNAP_MM of p, else p itself. */
export function snapToMount(p: Vec3, mounts: Vec3[], radius = SNAP_MM): { pos: Vec3; snapped: boolean } {
  let best: Vec3 | null = null, bd = radius;
  for (const m of mounts) { const d = Math.hypot(m[0] - p[0], m[1] - p[1], m[2] - p[2]); if (d <= bd) { bd = d; best = m; } }
  return best ? { pos: [...best], snapped: true } : { pos: p, snapped: false };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
export const roundPos = (p: Vec3): Vec3 => [round(p[0]), round(p[1]), round(p[2])];

function freshId(prefix: string, taken: string[]): string {
  let i = 1;
  while (taken.includes(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

/** Next spin for a new motor: alternate so a quad comes out balanced. */
export const nextSpin = (motors: Motor[]): 'cw' | 'ccw' => (motors.length % 2 ? 'cw' : 'ccw');

export function addMotor(p: Parts, pos: Vec3, motorId: string): { parts: Parts; id: string | null } {
  if (p.motors.length >= MAX_MOTORS) return { parts: p, id: null };
  const id = freshId('m', p.motors.map((m) => m.id));
  return { parts: { ...p, motors: [...p.motors, { id, pos: roundPos(pos), spin: nextSpin(p.motors), motorId }] }, id };
}

export function addMass(p: Parts, name: string, pos: Vec3): { parts: Parts; id: string | null } {
  if (p.components.length >= MAX_COMPONENTS) return { parts: p, id: null };
  const id = freshId('c', p.components.map((c) => c.id));
  return { parts: { ...p, components: [...p.components, { id, name, massG: null, pos: roundPos(pos) }] }, id };
}

/** Replace all motors by a quad-X built from one motor's position (|x|, |y|; 28 mm if that is 0), at that motor's height. */
export function makeQuad(p: Parts, anchorId: string, fallbackMm = 28): Parts {
  const a = p.motors.find((m) => m.id === anchorId);
  if (!a) return p;
  const x = Math.abs(a.pos[0]) || fallbackMm, y = Math.abs(a.pos[1]) || fallbackMm;
  return { ...p, motors: quadX(x, y, a.motorId).map((m) => ({ ...m, pos: [m.pos[0], m.pos[1], a.pos[2]] as Vec3 })) };
}

export const patchMotor = (p: Parts, id: string, f: (m: Motor) => Motor): Parts => ({ ...p, motors: p.motors.map((m) => (m.id === id ? f(m) : m)) });
export const patchMass = (p: Parts, id: string, f: (c: MassComponent) => MassComponent): Parts => ({ ...p, components: p.components.map((c) => (c.id === id ? f(c) : c)) });
export const removePart = (p: Parts, id: string): Parts => ({ motors: p.motors.filter((m) => m.id !== id), components: p.components.filter((c) => c.id !== id) });

/** Saved parts or empty. Anything that fails strict validation (or has no motors: the parser needs one) is dropped. */
export function loadParts(json: string | null): Parts {
  try { return json ? parseComponents(JSON.parse(json)) : NO_PARTS; } catch { return NO_PARTS; }
}
/** What to store, or null to clear the key (parseComponents rejects a motor-less set). */
export const savedParts = (p: Parts): string | null => (p.motors.length ? JSON.stringify(p) : null);

// ---------- undo history over the whole document (shapes + parts) ----------
export type Doc = { shapes: Shape[]; parts: Parts };
export type History = { past: Doc[]; now: Doc; future: Doc[]; key?: string; at?: number };
export const HISTORY_CAP = 50;

/** One snapshot per change; repeats of the same key within a second share one (typing "25"). */
export function pushHistory(p: History, next: Doc, key: string | undefined, at: number): History {
  if (key && key === p.key && p.at !== undefined && at - p.at < 1000) return { ...p, now: next, at };
  return { past: [...p.past, p.now].slice(-HISTORY_CAP), now: next, future: [], key, at };
}
export const undoHistory = (p: History): History => (p.past.length ? { past: p.past.slice(0, -1), now: p.past[p.past.length - 1], future: [p.now, ...p.future] } : p);
export const redoHistory = (p: History): History => (p.future.length ? { past: [...p.past, p.now].slice(-HISTORY_CAP), now: p.future[0], future: p.future.slice(1) } : p);
