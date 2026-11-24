// Pure checks for /api/orders, kept out of the route file so they can be tested. No fs, no React.
import path from 'node:path';
import { CATALOG, type Item } from './catalog.ts';
import { MAX_QTY } from './quote.ts';
import { cfgKey, normalizeCfg, templateById, type Cfg, type TemplateDef } from './templateDefs.ts';

// the same model extensions /api/upload accepts (upload names keep their extension)
const MODEL_RE = /\.(stl|obj|glb|gltf|3mf)$/i;
export const isModelFile = (name: string) => MODEL_RE.test(name);

// One checked entry of an order request. `n` is its 1-based position, for error messages.
export type Checked =
  | { n: number; kind: 'shop'; item: Item; qty: number }
  | { n: number; kind: 'tpl'; tpl: TemplateDef; cfg: Cfg; qty: number }
  | { n: number; kind: 'model'; file: string; material: string; qty: number }
  | { n: number; kind: 'design'; project: string; material: string; qty: number };

// Each template line is a CSG rebuild on the server (up to ~1 s, several when the kernel needs retries), so an
// order carries at most this many distinct configured parts. Keeps one request well inside the function timeout.
export const MAX_TPL_LINES = 5;

// Same shop item, or same upload + material, becomes one line with the summed quantity.
// A sum over MAX_QTY is refused, not capped: the customer must get the quantity they asked for.
export function mergeChecked(reqs: Checked[]): Checked[] {
  const out: Checked[] = [];
  const at = new Map<string, number>();
  for (const r of reqs) {
    const key = JSON.stringify(r.kind === 'shop' ? ['shop', r.item.id] : r.kind === 'tpl' ? ['tpl', r.tpl.id, cfgKey(r.tpl, r.cfg)] : r.kind === 'design' ? ['design', r.project, r.material] : ['model', r.file, r.material]);
    const i = at.get(key);
    if (i === undefined) {
      at.set(key, out.length);
      out.push(r);
      continue;
    }
    const cur = out[i];
    const qty = cur.qty + r.qty;
    if (qty > MAX_QTY) throw new Error(`item ${r.n}: quantity over ${MAX_QTY} after merging`);
    out[i] = { ...cur, qty };
  }
  if (out.filter((r) => r.kind === 'tpl').length > MAX_TPL_LINES) throw new Error(`at most ${MAX_TPL_LINES} different configured parts per order`);
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; // not from aiJobs: that pulls in the store
const isQty = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QTY;

// Strict check of one entry of the order request. Bad entries are rejected, never dropped: the customer must get what they asked for.
// Price fields and labels sent by the browser are ignored (they are never read); every price is recomputed server side.
export function checkEntry(raw: unknown, n: number): Checked {
  const fail = (msg: string) => new Error(`item ${n}: ${msg}`);
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (o.kind !== 'shop' && o.kind !== 'model' && o.kind !== 'tpl' && o.kind !== 'design') throw fail('kind must be "shop", "tpl", "design" or "model"');
  const qty = o.qty;
  if (!isQty(qty)) throw fail(`qty must be a whole number 1-${MAX_QTY}`);
  if (o.kind === 'tpl') {
    const tpl = templateById(o.id);
    if (!tpl) throw fail('unknown template');
    try {
      return { n, kind: 'tpl', tpl, cfg: normalizeCfg(tpl, o.cfg, true), qty };
    } catch (e) {
      throw fail(e instanceof Error ? e.message : 'bad config');
    }
  }
  if (o.kind === 'shop') {
    const item = CATALOG.find((i) => i.id === o.id);
    if (!item) throw fail('unknown item');
    return { n, kind: 'shop', item, qty };
  }
  if (o.kind === 'design') {
    if (typeof o.project !== 'string' || !UUID.test(o.project) || typeof o.material !== 'string') throw fail('design needs a project and a material');
    return { n, kind: 'design', project: o.project.toLowerCase(), material: o.material, qty }; // lowercase: case variants of one id merge (MAX_QTY cap)
  }
  if (typeof o.file !== 'string' || typeof o.material !== 'string') throw fail('model needs a file and a material');
  const file = path.basename(o.file);
  if (!file) throw fail('file is required');
  if (!isModelFile(file)) throw fail('not a model file'); // e.g. an image from an idea request
  return { n, kind: 'model', file, material: o.material, qty };
}
