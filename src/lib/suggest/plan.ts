// What the "Suggested next" bar shows: rule candidates each with their suggested spot and angle, an optional AI re-ranking merged in
// (re-checked here, never trusted), and nudging a suggested spot. Pure TS: no React, no three.
import type { Shape } from '../playground.ts';
import type { Parts } from '../flight/layout.ts';
import type { Vec3 } from '../flight/mass.ts';
import { suggestNext, type SuggestContext } from './next.ts';
import { settleZ, suggestPlacement, type Placement, type PlacementResult } from './placement.ts';
import { checkPlacement, clamp, dimsFor, MAX_REASON, PART_KINDS, turnedSize, wrap180, type PartKind } from './validate.ts';

export type SuggestItem = { kind: PartKind; reason: string; count?: number; place: PlacementResult; ai?: boolean };

/** The names the Playground gives its mass parts (layout.ts MASS_PARTS). */
export const MASS_NAME: Record<Exclude<PartKind, 'motor'>, string> = { esc: 'ESC', battery: 'Battery', fc: 'Flight controller', camera: 'Camera', payload: 'Payload' };
export const KIND_LABEL: Record<PartKind, string> = { motor: 'Motor', esc: 'ESC', battery: 'Battery', fc: 'Flight controller', camera: 'Camera', payload: 'Payload' };
/** The part kind of a Playground "+ chip" (motor, or a mass part by name). */
export const kindOfMassName = (name: string): PartKind | null => (PART_KINDS.find((k) => k !== 'motor' && MASS_NAME[k] === name) as PartKind | undefined) ?? null;
export const chipLabel = (i: { kind: PartKind; count?: number }) => (i.kind === 'motor' && (i.count ?? 1) > 1 ? `${i.count} motors` : KIND_LABEL[i.kind]);

/** Rule-based next parts, each with where it goes and at what angle. [] when nothing is missing. */
export function suggestItems(shapes: Shape[], parts: Parts, ctx: SuggestContext = {}): SuggestItem[] {
  return suggestNext(shapes, parts, ctx).map((n) => ({ ...n, place: suggestPlacement(n.kind, shapes, parts) }));
}

/** "turned 90 deg, tilted up 25 deg" for a placement, '' when it has no angle. Yaw only counts for parts that are not round. */
export function describeAngle(p: { yawDeg: number; tiltDeg: number }, kind: PartKind): string {
  const out: string[] = [];
  if (kind !== 'motor' && Math.abs(p.yawDeg) > 0.05) out.push(`turned ${p.yawDeg} deg (long side along ${Math.abs(p.yawDeg) % 180 === 90 ? 'y' : 'the new heading'})`);
  if (Math.abs(p.tiltDeg) > 0.05) out.push(`tilted ${p.tiltDeg > 0 ? 'up' : 'down'} ${Math.abs(p.tiltDeg)} deg`);
  return out.join(', ');
}

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_REASON);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const vec = (x: unknown): Vec3 | null => (Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === 'number' && Number.isFinite(v)) ? (x as Vec3) : null);

/**
 * Merge a reply from /api/suggest into the rule items. Only kinds the rules suggested are used, in the AI's order (duplicates ignored); anything it left out
 * follows in rule order. The AI's reason is used as text; its spot is used only if checkPlacement accepts it, else the rule's spot stays. null: nothing usable.
 */
export function mergeAi(rules: SuggestItem[], reply: unknown, shapes: Shape[], parts: Parts): SuggestItem[] | null {
  const list = isObj(reply) && Array.isArray(reply.items) ? reply.items.slice(0, 8) : null;
  if (!list || !rules.length) return null;
  const out: SuggestItem[] = [], used = new Set<PartKind>();
  for (const raw of list) {
    if (!isObj(raw) || typeof raw.kind !== 'string') continue;
    const base = rules.find((r) => r.kind === raw.kind);
    if (!base || used.has(base.kind)) continue;
    used.add(base.kind);
    const item: SuggestItem = { ...base, ai: true };
    if (typeof raw.reason === 'string' && clean(raw.reason)) item.reason = clean(raw.reason);
    const pl = isObj(raw.place) ? raw.place : null, pos = pl ? vec(pl.posMm) : null;
    if (pl && pos && typeof pl.yawDeg === 'number' && typeof pl.tiltDeg === 'number' && Number.isFinite(pl.yawDeg + pl.tiltDeg)) {
      const yaw = wrap180(pl.yawDeg), tilt = clamp(pl.tiltDeg, -90, 90);
      if (!checkPlacement(base.kind, pos, shapes, turnedSize(base.kind, yaw), parts)) {
        const spin = base.place.posMm && 'spin' in base.place ? base.place.spin : undefined;
        item.place = { posMm: pos, yawDeg: yaw, tiltDeg: tilt, basis: 'ai', reason: typeof pl.reason === 'string' && clean(pl.reason) ? clean(pl.reason) : item.reason, ...(spin ? { spin } : {}) };
      }
    }
    out.push(item);
  }
  if (!out.length) return null;
  return [...out, ...rules.filter((r) => !used.has(r.kind))];
}

/** Half the height of a mass part: a part stores its centre, so one clicked onto a surface is lifted by this much. */
export const massHalfHeight = (name: string): number => (dimsFor(name)?.[2] ?? 8) / 2;

export const NUDGE_MM = 2;
/**
 * Move a suggested spot by (dx, dy) mm and/or turn it by dYaw degrees; the height is recomputed so the part keeps resting on what is below.
 * Refused (with the reason) when the new spot is off the frame, outside the bed or overlaps something.
 */
export function nudge(kind: PartKind, from: Placement, d: { dx?: number; dy?: number; dYaw?: number }, shapes: Shape[], parts: Parts): { ok: true; place: Placement } | { ok: false; why: string } {
  const yaw = wrap180(from.yawDeg + (d.dYaw ?? 0)), size = turnedSize(kind, yaw);
  const x = Math.round((from.posMm[0] + (d.dx ?? 0)) * 10) / 10, y = Math.round((from.posMm[1] + (d.dy ?? 0)) * 10) / 10;
  const z = Math.round(settleZ(kind, [x, y], shapes, parts, kind === 'motor' ? undefined : size) * 10) / 10, pos: Vec3 = [x, y, z];
  const why = checkPlacement(kind, pos, shapes, size, parts);
  if (why) return { ok: false, why: `Cannot move it there: ${why}.` };
  return { ok: true, place: { ...from, posMm: pos, yawDeg: yaw, basis: 'nudged', reason: 'Moved by you from the suggested spot.' } };
}
