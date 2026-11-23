// Blueprint-first design: the LLM proposes a Blueprint (parts made of the existing Shape primitives, plus feature notes) that the customer approves
// before any mesh is built. Pure, no I/O. The route maps { ok:false } to HTTP 422.
import { DESIGN_SCHEMA, toDesign } from './aiDesign.ts';
import { MAX_COORD, MAX_SHAPES, solidsSize, minZ, worldVertices, type Shape } from './playground.ts';
import { BED_MM, fitsBed, type Size } from './quote.ts';

export type Part = { id: string; name: string; role: string; shapes: Shape[] };
export type Feature = { type: 'hole' | 'slot'; partId: string; dia?: number; depth?: number; note: string };
export type Blueprint = {
  title: string; notes: string; units: 'mm'; envelope: Size; parts: Part[]; features: Feature[];
  constraints: { fitsBed: boolean; minWall: number };
};
export type BlueprintResult = { ok: true; blueprint: Blueprint } | { ok: false; reason: string };

const shapeProps = (DESIGN_SCHEMA.properties.shapes.items as { properties: object }).properties;
const SHAPE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['id', 'kind', 'mode', 'position', 'rotation', 'size'],
  properties: { id: { type: 'string' }, ...shapeProps },
};

// Structured-output friendly, like DESIGN_SCHEMA. envelope is accepted but always recomputed by the server.
export const BLUEPRINT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'notes', 'units', 'envelope', 'parts', 'features', 'constraints'],
  properties: {
    title: DESIGN_SCHEMA.properties.title, notes: DESIGN_SCHEMA.properties.notes,
    units: { type: 'string', enum: ['mm'] },
    envelope: { type: 'object', additionalProperties: false, required: ['x', 'y', 'z'], properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
    parts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'name', 'role', 'shapes'],
        properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, shapes: { type: 'array', items: SHAPE_SCHEMA } },
      },
    },
    features: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'partId', 'note'],
        properties: { type: { type: 'string', enum: ['hole', 'slot'] }, partId: { type: 'string' }, dia: { type: 'number' }, depth: { type: 'number' }, note: { type: 'string' } },
      },
    },
    constraints: {
      type: 'object', additionalProperties: false, required: ['fitsBed', 'minWall'],
      properties: { fitsBed: { type: 'boolean' }, minWall: { type: 'number' } },
    },
  },
} as const;

// ---------- validation ----------

const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const MAX_DIM = Math.max(...Object.values(BED_MM));
const ID = /^[\w-]{1,32}$/;
const fail = (reason: string): BlueprintResult => ({ ok: false, reason });
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** Rejects (returns a reason) on unknown keys, prototype keys, non-finite or huge numbers, overlong strings. */
function checkKeys(v: unknown, allowed: string[], path: string): string | null {
  if (!isObj(v)) return `${path} must be an object`;
  for (const k of Object.getOwnPropertyNames(v)) {
    if (BAD_KEYS.includes(k)) return `${path}: forbidden key ${k}`;
    if (!allowed.includes(k)) return `${path}: unknown field ${k}`;
  }
  return null;
}
const vecBad = (v: unknown, path: string, max: number): string | null => {
  const e = checkKeys(v, ['x', 'y', 'z'], path);
  if (e) return e;
  const o = v as Json;
  return ['x', 'y', 'z'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]) && Math.abs(o[k] as number) <= max) ? null : `${path} needs finite numbers within +-${max}`;
};
const strBad = (v: unknown, path: string, max: number): string | null => (typeof v === 'string' && v.length <= max ? null : `${path} must be text up to ${max} characters`);
const numBad = (v: unknown, path: string): string | null => (v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_DIM) ? null : `${path} must be a number from 0 to ${MAX_DIM}`);

/** Approximate connectivity: every solid's world bounding box must overlap another solid's box (touching does not count). Boxes of rotated or round shapes
 * are looser than the shapes, so a pass does not prove the part is one piece; the slicer-side checks still apply. */
type Box = { lo: number[]; hi: number[] };
const boxOf = (s: Shape): Box => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of worldVertices(s)) [v.x, v.y, v.z].forEach((c, i) => { lo[i] = Math.min(lo[i], c); hi[i] = Math.max(hi[i], c); });
  return { lo, hi };
};
const overlap = (a: Box, b: Box) => [0, 1, 2].every((i) => a.lo[i] < b.hi[i] && b.lo[i] < a.hi[i]);

export function validateBlueprint(input: unknown): BlueprintResult {
  let e = checkKeys(input, ['title', 'notes', 'units', 'envelope', 'parts', 'features', 'constraints'], 'blueprint');
  if (e) return fail(e);
  const o = input as Json;
  e = strBad(o.title, 'title', 60) ?? strBad(o.notes, 'notes', 300);
  if (e) return fail(e);
  if (o.units !== 'mm') return fail('units must be "mm"');
  if (o.envelope !== undefined && (e = vecBad(o.envelope, 'envelope', 1e6))) return fail(e);
  if (!Array.isArray(o.parts) || !o.parts.length) return fail('parts must be a non-empty list');
  if (o.parts.length > MAX_SHAPES) return fail('too many parts');
  const partIds = new Set<string>(), raws: unknown[] = [], owner: number[] = [];
  for (const [pi, p] of o.parts.entries()) {
    e = checkKeys(p, ['id', 'name', 'role', 'shapes'], `parts[${pi}]`);
    if (e) return fail(e);
    const part = p as Json;
    e = strBad(part.id, `parts[${pi}].id`, 32) ?? strBad(part.name, `parts[${pi}].name`, 40) ?? strBad(part.role, `parts[${pi}].role`, 120);
    if (e) return fail(e);
    if (!ID.test(part.id as string) || partIds.has(part.id as string)) return fail(`parts[${pi}].id is invalid or repeated`);
    partIds.add(part.id as string);
    if (!Array.isArray(part.shapes)) return fail(`parts[${pi}].shapes must be a list`);
    for (const [si, s] of part.shapes.entries()) {
      const path = `parts[${pi}].shapes[${si}]`;
      e = checkKeys(s, ['id', 'kind', 'mode', 'position', 'rotation', 'size'], path);
      if (e) return fail(e);
      const sh = s as Json;
      e = vecBad(sh.position, `${path}.position`, MAX_COORD) ?? vecBad(sh.rotation, `${path}.rotation`, MAX_COORD) ?? vecBad(sh.size, `${path}.size`, MAX_DIM);
      if (e) return fail(e);
      if (typeof sh.id !== 'string' || !ID.test(sh.id)) return fail(`${path}.id is invalid`);
      raws.push(s); owner.push(pi);
      if (raws.length > MAX_SHAPES) return fail(`a blueprint has at most ${MAX_SHAPES} shapes`);
    }
  }
  if (!Array.isArray(o.features) || o.features.length > 50) return fail('features must be a list of at most 50');
  const features: Feature[] = [];
  for (const [fi, f] of o.features.entries()) {
    const path = `features[${fi}]`;
    e = checkKeys(f, ['type', 'partId', 'dia', 'depth', 'note'], path);
    if (e) return fail(e);
    const ft = f as Json;
    e = strBad(ft.note, `${path}.note`, 200) ?? numBad(ft.dia, `${path}.dia`) ?? numBad(ft.depth, `${path}.depth`);
    if (e) return fail(e);
    if ((ft.type !== 'hole' && ft.type !== 'slot') || typeof ft.partId !== 'string' || !partIds.has(ft.partId)) return fail(`${path} has a bad type or unknown partId`);
    features.push({ type: ft.type, partId: ft.partId, note: ft.note as string, ...(ft.dia !== undefined ? { dia: ft.dia as number } : {}), ...(ft.depth !== undefined ? { depth: ft.depth as number } : {}) });
  }
  e = checkKeys(o.constraints, ['fitsBed', 'minWall'], 'constraints');
  if (e) return fail(e);
  const mw = (o.constraints as Json).minWall;
  if (typeof (o.constraints as Json).fitsBed !== 'boolean' || typeof mw !== 'number' || !Number.isFinite(mw) || mw < 0 || mw > MAX_DIM) return fail('constraints are invalid');

  // reuse toDesign for the real shape validation; it silently drops bad shapes, so a count mismatch means rejection
  const d = toDesign({ title: 'x', notes: '', shapes: raws });
  if (!d.ok) return fail('The blueprint has no solid shape');
  if (d.shapes.length !== raws.length) return fail('Some shapes are invalid');
  const drop = Math.min(...d.shapes.filter((s) => s.mode === 'solid').map(minZ));
  const shapes = d.shapes.map((s) => ({ ...s, position: { ...s.position, z: s.position.z - drop } }));
  const envelope = solidsSize(shapes);
  if (!envelope || !fitsBed(envelope)) return fail(`The design does not fit the ${BED_MM.x} x ${BED_MM.y} x ${BED_MM.z} mm print bed`);
  const boxes = shapes.filter((s) => s.mode === 'solid').map(boxOf);
  if (boxes.length > 1 && !boxes.every((b, i) => boxes.some((c, j) => j !== i && overlap(b, c)))) return fail('A solid does not overlap any other solid');

  const parts = o.parts.map((p, pi): Part => {
    const part = p as Json;
    return { id: part.id as string, name: part.name as string, role: part.role as string, shapes: shapes.filter((_, i) => owner[i] === pi) };
  });
  return { ok: true, blueprint: { title: o.title as string, notes: o.notes as string, units: 'mm', envelope, parts, features, constraints: { fitsBed: true, minWall: mw } } };
}

// ---------- diff ----------

export type Change = { what: string; id: string; field: string; from: number | string; to: number | string };
export type BlueprintDiff = { added: string[]; removed: string[]; changed: Change[] };

const FIELDS = (s: Shape): [string, number | string][] => [
  ['kind', s.kind], ['mode', s.mode],
  ...(['position', 'rotation', 'size'] as const).flatMap((g) => (['x', 'y', 'z'] as const).map((k): [string, number] => [`${g}.${k}`, s[g][k]])),
];
const label = (p: Part, s: Shape) => `${p.name}/${s.kind}${s.mode === 'hole' ? ' hole' : ''}`;

/** Matches shapes by id; when a part's ids were all reassigned, falls back to the part with the same name and pairs its shapes by order. Numbers are mm (degrees for rotation). */
export function diffBlueprints(a: Blueprint, b: Blueprint): BlueprintDiff {
  const out: BlueprintDiff = { added: [], removed: [], changed: [] };
  const pairs: [Part, Shape, Shape][] = [];
  const bById = new Map(b.parts.flatMap((p) => p.shapes.map((s): [string, [Part, Shape]] => [s.id, [p, s]])));
  const used = new Set<string>();
  const leftA: [Part, Shape][] = [];
  for (const p of a.parts) for (const s of p.shapes) {
    const m = bById.get(s.id);
    if (m) { pairs.push([m[0], s, m[1]]); used.add(s.id); } else leftA.push([p, s]);
  }
  // name fallback: pair leftover shapes of same-named parts in order
  for (const bp of b.parts) {
    const rest = bp.shapes.filter((s) => !used.has(s.id));
    const mine = leftA.filter(([p]) => p.name === bp.name);
    rest.forEach((s, i) => {
      if (!mine[i]) return;
      pairs.push([bp, mine[i][1], s]); used.add(s.id); leftA.splice(leftA.indexOf(mine[i]), 1);
    });
  }
  for (const [p, s] of leftA) out.removed.push(label(p, s));
  for (const p of b.parts) for (const s of p.shapes) if (!used.has(s.id)) out.added.push(label(p, s));
  for (const [p, o, n] of pairs) {
    const fo = FIELDS(o), fn = FIELDS(n);
    fo.forEach(([f, v], i) => { if (v !== fn[i][1]) out.changed.push({ what: label(p, n), id: n.id, field: f, from: v, to: fn[i][1] }); });
  }
  return out;
}

// ---------- Playground interop ----------

export const blueprintToShapes = (b: Blueprint): Shape[] => b.parts.flatMap((p) => p.shapes);

/** Wraps a flat shape list as a one-part blueprint (envelope recomputed, not validated). */
export function shapesToBlueprint(shapes: Shape[], title = 'My design', notes = ''): Blueprint {
  const envelope = solidsSize(shapes) ?? { x: 0, y: 0, z: 0 };
  return {
    title, notes, units: 'mm', envelope, parts: [{ id: 'part1', name: 'Part', role: 'main body', shapes }], features: [],
    constraints: { fitsBed: fitsBed(envelope), minWall: 1.2 },
  };
}
