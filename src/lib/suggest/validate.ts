// Suggestion engine, shared geometry + validation of AI-proposed suggestions. Pure TS: no React, no three.
// Frame: mm, x right, y forward, z up, bed 220 x 220 x 250 centred on the origin in x/y (plate at z = 0).
// The AI may only RE-RANK or REWORD the rule-based candidates and propose a position; every position is re-checked here.
import type { Shape } from '../playground.ts';
import type { Vec3 } from '../flight/mass.ts';

export const PART_KINDS = ['motor', 'esc', 'battery', 'fc', 'camera', 'payload'] as const;
export type PartKind = (typeof PART_KINDS)[number];
export type Box = { lo: Vec3; hi: Vec3 };

export const BED = { x: 220, y: 220, z: 250 } as const;
export const MAX_REASON = 200, MAX_AI_ITEMS = 8, MAX_ABS = 10000;
const EPS = 0.01; // mm: faces that merely touch are not an overlap

/** Rough part sizes (x, y, z mm) for bbox checks. ESTIMATE: real parts vary. A motor sits ON its mount point (box rises from pos.z); everything else is centred on pos. */
export const PART_SIZE: Record<PartKind, Vec3> = {
  motor: [22, 22, 15], esc: [30, 30, 6], battery: [60, 30, 20], fc: [30, 30, 6], camera: [19, 19, 19], payload: [30, 30, 30],
};

const NAME: [PartKind, RegExp][] = [
  ['battery', /battery|lipo/i], ['fc', /flight ?controller|\bfc\b/i], ['esc', /\besc\b/i], ['camera', /camera/i], ['payload', /payload/i],
];
/** Which part kind a mass-component name stands for (null: not one of ours). */
export const classify = (name: string): PartKind | null => NAME.find(([, re]) => re.test(name))?.[0] ?? null;

export const partBox = (kind: PartKind, pos: Vec3, sizeOverride?: Vec3): Box => {
  const s = sizeOverride ?? PART_SIZE[kind];
  const z0 = kind === 'motor' ? pos[2] : pos[2] - s[2] / 2;
  return { lo: [pos[0] - s[0] / 2, pos[1] - s[1] / 2, z0], hi: [pos[0] + s[0] / 2, pos[1] + s[1] / 2, z0 + s[2]] };
};

/** World bbox of a shape (all 8 corners of its box, rotated X then Y then Z like three's 'XYZ'): conservative for cylinders, cones and spheres. */
export function shapeBox(s: Shape): Box {
  const d = Math.PI / 180, [cx, cy, cz] = [s.rotation.x * d, s.rotation.y * d, s.rotation.z * d].map((a) => [Math.cos(a), Math.sin(a)]);
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    let [x, y, z] = [sx * s.size.x / 2, sy * s.size.y / 2, sz * s.size.z / 2];
    [x, y] = [x * cz[0] - y * cz[1], x * cz[1] + y * cz[0]]; // Rz
    [x, z] = [x * cy[0] + z * cy[1], -x * cy[1] + z * cy[0]]; // Ry
    [y, z] = [y * cx[0] - z * cx[1], y * cx[1] + z * cx[0]]; // Rx
    const p = [x + s.position.x, y + s.position.y, z + s.position.z];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  }
  return { lo, hi };
}

export const solidBoxes = (shapes: Shape[]): Box[] => shapes.filter((s) => s.mode === 'solid').map(shapeBox);
export function union(bs: Box[]): Box | null {
  if (!bs.length) return null;
  return { lo: [0, 1, 2].map((i) => Math.min(...bs.map((b) => b.lo[i]))) as Vec3, hi: [0, 1, 2].map((i) => Math.max(...bs.map((b) => b.hi[i]))) as Vec3 };
}
export const overlaps = (a: Box, b: Box) => [0, 1, 2].every((i) => a.lo[i] < b.hi[i] - EPS && b.lo[i] < a.hi[i] - EPS);
/** Is (x, y) over the shape's real outline (not its bbox)? Exact for shapes turned only about z; a shape tilted about x or y falls back to its bbox. */
export function overShape(s: Shape, x: number, y: number): boolean {
  if (Math.abs(s.rotation.x) > 1e-6 || Math.abs(s.rotation.y) > 1e-6) { const b = shapeBox(s); return x >= b.lo[0] && x <= b.hi[0] && y >= b.lo[1] && y <= b.hi[1]; }
  const a = (-s.rotation.z * Math.PI) / 180, dx = x - s.position.x, dy = y - s.position.y;
  const u = (dx * Math.cos(a) - dy * Math.sin(a)) / (s.size.x / 2), v = (dx * Math.sin(a) + dy * Math.cos(a)) / (s.size.y / 2);
  if (s.kind === 'box' || s.kind === 'wedge') return Math.abs(u) <= 1 + 1e-9 && Math.abs(v) <= 1 + 1e-9;
  const r = Math.hypot(u, v);
  return r <= 1 + 1e-9 && (s.kind !== 'torus' || r >= 0.5 - 1e-9); // torus tube spans radius 0.25..0.5 of the 1-unit size
}
export const overFrame = (shapes: Shape[], x: number, y: number) => shapes.some((s) => s.mode === 'solid' && overShape(s, x, y));
export const inBed = (b: Box) => Math.abs(b.lo[0]) <= BED.x / 2 && Math.abs(b.hi[0]) <= BED.x / 2 && Math.abs(b.lo[1]) <= BED.y / 2 && Math.abs(b.hi[1]) <= BED.y / 2 && b.lo[2] >= -EPS && b.hi[2] <= BED.z;

/** null when the part at pos is acceptable, else why not: finite, in the bed, centre over real frame material, no overlap with frame solids. size: the part's (x, y, z) when turned (battery at yaw 90). */
export function checkPlacement(kind: PartKind, pos: Vec3, shapes: Shape[], size?: Vec3): string | null {
  if (!pos.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_ABS)) return 'position is not a sensible number';
  const box = partBox(kind, pos, size);
  if (!inBed(box)) return `outside the ${BED.x}x${BED.y}x${BED.z} mm bed`;
  const solids = solidBoxes(shapes), frame = union(solids);
  if (!frame) return 'there is no frame yet';
  if (!overFrame(shapes, pos[0], pos[1])) return 'its centre is not over any frame material';
  if (solids.some((s) => overlaps(box, s))) return 'would intersect the frame';
  return null;
}

// ---------- what an LLM may fill ----------
const NUM = (min: number, max: number) => ({ type: 'number', minimum: min, maximum: max });
/** JSON schema for the LLM: re-rank / reword the candidates (kinds from the rule engine) and optionally propose a position and angles. */
export const SUGGEST_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array', maxItems: MAX_AI_ITEMS,
      items: {
        type: 'object', additionalProperties: false, required: ['kind'],
        properties: {
          kind: { type: 'string', enum: [...PART_KINDS] },
          reason: { type: 'string', maxLength: MAX_REASON },
          posMm: { type: 'array', items: NUM(-1000, 1000), minItems: 3, maxItems: 3 },
          yawDeg: NUM(-360, 360),
          tiltDeg: NUM(-90, 90),
        },
      },
    },
  },
} as const;

export type AiSuggestion = { kind: PartKind; reason?: string; posMm?: Vec3; yawDeg?: number; tiltDeg?: number };
export type Validated = { ok: true; value: AiSuggestion } | { ok: false; error: string };
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const angle = (v: unknown, lim: number): number | string => (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_ABS ? 'angle must be a finite number' : clamp(v, -lim, lim));
const wrap180 = (v: number) => { const w = ((v % 360) + 540) % 360 - 180; return w === -180 ? 180 : w; };

/**
 * One AI item. Rejects prototype keys, unknown keys, unknown kinds (or kinds not in `allowed`), NaN/huge numbers and positions outside the bed,
 * off the frame or inside it. Yaw wraps to -180..180 (270 is -90), tilt clamps to -90..90; the reason is cut to 200 chars with control characters removed.
 */
export function validateSuggestion(raw: unknown, design: Shape[], allowed: readonly PartKind[] = PART_KINDS): Validated {
  const no = (error: string): Validated => ({ ok: false, error });
  if (!isObj(raw)) return no('suggestion must be an object');
  const own = Object.getOwnPropertyNames(raw);
  if (own.some((k) => BAD_KEYS.includes(k))) return no('forbidden key');
  const extra = own.find((k) => !['kind', 'reason', 'posMm', 'yawDeg', 'tiltDeg'].includes(k));
  if (extra) return no(`unknown key "${extra.slice(0, 20)}"`);
  const kind = raw.kind;
  if (typeof kind !== 'string' || !(PART_KINDS as readonly string[]).includes(kind)) return no('unknown kind');
  if (!allowed.includes(kind as PartKind)) return no(`"${kind}" is not one of the rule-based candidates`);
  const out: AiSuggestion = { kind: kind as PartKind };
  if (raw.reason !== undefined) {
    if (typeof raw.reason !== 'string') return no('reason must be text');
    out.reason = raw.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_REASON);
  }
  if (raw.posMm !== undefined) {
    const p = raw.posMm;
    if (!Array.isArray(p) || p.length !== 3 || !p.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000)) return no('posMm must be [x,y,z] finite numbers within 1000 mm');
    const why = checkPlacement(kind as PartKind, p as Vec3, design);
    if (why) return no(`position rejected: ${why}`);
    out.posMm = [p[0], p[1], p[2]];
  }
  if (raw.yawDeg !== undefined) { const a = angle(raw.yawDeg, MAX_ABS); if (typeof a === 'string') return no(a); out.yawDeg = wrap180(a); }
  if (raw.tiltDeg !== undefined) { const a = angle(raw.tiltDeg, 90); if (typeof a === 'string') return no(a); out.tiltDeg = a; }
  return { ok: true, value: out };
}

/**
 * Apply an AI plan (the parsed JSON matching SUGGEST_SCHEMA) to the rule-based candidates: the AI's valid items come first in its order
 * (with its reworded reason), every candidate it did not mention follows, so nothing is ever dropped or invented. Rejections are listed.
 */
export function applyAiPlan<T extends { kind: PartKind; reason: string }>(candidates: T[], rawPlan: unknown, design: Shape[]): { ordered: (T & { ai?: AiSuggestion })[]; rejected: string[] } {
  const rejected: string[] = [];
  const items = isObj(rawPlan) && !Object.getOwnPropertyNames(rawPlan).some((k) => BAD_KEYS.includes(k)) && Array.isArray(rawPlan.suggestions) ? rawPlan.suggestions.slice(0, MAX_AI_ITEMS) : null;
  if (!items) return { ordered: candidates.map((c) => ({ ...c })), rejected: ['AI plan ignored: not an object with a suggestions array'] };
  const kinds = candidates.map((c) => c.kind), used = new Set<PartKind>(), first: (T & { ai?: AiSuggestion })[] = [];
  items.forEach((it, i) => {
    const v = validateSuggestion(it, design, kinds);
    if (!v.ok) { rejected.push(`item ${i}: ${v.error}`); return; }
    if (used.has(v.value.kind)) { rejected.push(`item ${i}: duplicate "${v.value.kind}"`); return; }
    used.add(v.value.kind);
    const base = candidates.find((c) => c.kind === v.value.kind) as T;
    first.push({ ...base, reason: v.value.reason || base.reason, ai: v.value });
  });
  return { ordered: [...first, ...candidates.filter((c) => !used.has(c.kind)).map((c) => ({ ...c }))], rejected };
}
