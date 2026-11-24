// Server-side pricing of the order lines that come from stored files: uploads and finalized design projects. Server only.
// Nothing the browser says about price is read; the price comes from the STL in the store and its stats sidecar.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fitsBed, meshStats, quote, type MeshStats } from './quote.ts';
import { kitPartByKey, kitPartMesh } from './kits/adapt.ts';
import type { OrderLine } from './notify.ts';
import { findJobByFile } from './aiJobs.ts';
import { orderInfo } from './designProjects.ts';
import { getBytes, getJson } from './store.ts';
import type { Cfg } from './templateDefs.ts';

export type SavedLine = OrderLine & { stats?: MeshStats | null; quote?: ReturnType<typeof quote> | null; cfg?: Cfg };

export async function priceModel(file: string, material: string, qty: number): Promise<SavedLine> {
  if (file.endsWith('.stats.json') || !(await getBytes('uploads', file))) throw new Error('file not found');

  // stats were computed at upload time; missing or invalid sidecar means manual quote
  let stats: MeshStats | null = null;
  try {
    const s = await getJson<{ volumeCm3?: unknown; sizeMm?: Record<string, unknown> }>('uploads', `${file}.stats.json`);
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    if (s && ok(s.volumeCm3) && (s.volumeCm3 as number) > 0 && s.sizeMm && ok(s.sizeMm.x) && ok(s.sizeMm.y) && ok(s.sizeMm.z)) {
      stats = { volumeCm3: s.volumeCm3 as number, sizeMm: { x: s.sizeMm.x as number, y: s.sizeMm.y as number, z: s.sizeMm.z as number } };
    }
  } catch {}

  let q: ReturnType<typeof quote> | null = null;
  if (stats) {
    const r = quote(stats, material, qty); // validates material + qty
    if (fitsBed(stats.sizeMm)) q = r;
  } else {
    quote({ volumeCm3: 0, sizeMm: { x: 0, y: 0, z: 0 } }, material, qty); // validate only
  }
  // ponytail: setup fee and minimum order apply per model line — one fee per order if that proves too steep
  const ai = await findJobByFile(file); // file came from an AI generation: tell the owner the prompt
  return {
    kind: 'model', file, material, qty, stats, quote: q, total: q ? q.total : null,
    ...(ai ? { aiPrompt: ai.prompt } : {}),
  };
}

/** A kit part line: the mesh is rebuilt from the kit file (builder + validated config) or read from the STL file we ship in public/models/kits;
 * the price is quote() of that mesh. `key` and `cfg` must already be checked (orderChecks); the client's label and price are never read. */
export async function priceKit(key: string, cfg: Cfg, qty: number): Promise<SavedLine> {
  const hit = kitPartByKey(key);
  if (!hit) throw new Error('unknown kit part');
  const { source, part } = hit;
  // the file name comes from the kit file, never from the request; resolve it under public/ anyway
  const read = async (file: string) => { const b = await readFile(path.join(process.cwd(), 'public', path.normalize(file).replace(/^(\.\.[\\/])+/, ''))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
  const mesh = await kitPartMesh(key, cfg, read);
  const stats = mesh ? meshStats(mesh) : null;
  if (!stats) throw new Error('this kit part could not be built');
  if (!fitsBed(stats.sizeMm)) throw new Error('this kit part does not fit the print bed');
  const q = quote(stats, part.material, qty);
  const config = Object.entries(cfg).map(([k, v]) => `${k}: ${v}`).join(', ');
  return { kind: 'kit', id: key, itemName: `${source.title}: ${part.label}`, config, cfg, qty, material: part.material, stats, quote: q, total: q.total };
}

/** A design line: the project must be finalized with its file in the store; the price is computed from that server-built STL. */
export async function priceDesign(project: string, material: string, qty: number): Promise<SavedLine> {
  const info = await orderInfo(project);
  const line = await priceModel(info.file, material, qty);
  return { ...line, kind: 'design', project: info.id, revision: info.revision, ...(info.components.length ? { components: info.components } : {}) };
}

/** Order note block for design lines: project id, revision and the components the customer supplies (not printed). */
export const designNotes = (lines: SavedLine[]): string =>
  lines.filter((l) => l.kind === 'design')
    .map((l) => `Design project ${l.project} rev ${l.revision}.${l.components?.length ? ` User-supplied components (not printed): ${l.components.map((c) => c.replace(/\s+/g, ' ')).join(', ')}.` : ''}`)
    .join('\n');
