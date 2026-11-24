// Cart and saved-list rules shared by the browser and the orders route.
// Pure: no React, no DOM, no fs. The browser keeps these in localStorage, with no accounts.
// Prices shown in the browser are for display only; /api/orders recomputes every line itself.
import { CATALOG } from './catalog.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; // not imported from aiJobs: that pulls the server store into the browser bundle
import { MAX_QTY, MIN_ORDER, SETUP_FEE } from './quote.ts';
import { cfgKey, normalizeCfg, templateById, type Cfg } from './templateDefs.ts';

export const MAX_LINES = 20;
export const MAX_SAVED = 50;
// Each template line is a server CSG rebuild at checkout, so an order carries at most this many distinct configured parts
// (checked in /api/orders via orderChecks, and before a kit is added to the cart).
export const MAX_TPL_LINES = 5;
// Kit part lines are rebuilt (or read from an STL file) at checkout too, but the parts are small: more of them may share one order.
export const MAX_KIT_LINES = 12;

export type CartLine =
  | { kind: 'shop'; id: string; qty: number }
  // a parametric template with the customer's settings; `unitPrice` is the per-piece price shown when it was configured (display only, the server recomputes from `cfg`)
  | { kind: 'tpl'; id: string; cfg: Cfg; qty: number; unitPrice: number }
  // one printed part of a kit (src/lib/kits/adapt.ts); `id` is `<kitId>:<partId>`, `label` and `unitPrice` are display only, the server rebuilds the part from the kit file and `cfg`
  | { kind: 'kit'; id: string; label: string; cfg: Cfg; qty: number; unitPrice: number }
  // a customer's own model (upload, builder or AI): `file` is the stored upload name,
  // `estimate` the line total shown when it was quoted (null = we quote it manually)
  | { kind: 'model'; file: string; label: string; notes?: string; material: string; qty: number; estimate: number | null }
  // a finalized design project (blueprint-first flow); the server prices it from the STL it built, `estimate` is display only
  | { kind: 'design'; project: string; label: string; material: string; qty: number; estimate: number | null };

const isQty = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QTY;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function lineKey(l: CartLine): string {
  if (l.kind === 'tpl') return `tpl:${l.id}:${cfgKey(templateById(l.id)!, l.cfg)}`;
  if (l.kind === 'kit') return `kit:${l.id}:${JSON.stringify(Object.keys(l.cfg).sort().map((k) => [k, l.cfg[k]]))}`;
  if (l.kind === 'design') return `design:${l.project}:${l.material}`;
  return l.kind === 'shop' ? `shop:${l.id}` : `model:${l.file}:${l.material}`;
}

// Untrusted input (localStorage, request bodies): returns only well-formed lines.
export function parseCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const r of raw) {
    if (out.length >= MAX_LINES) break;
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (!isQty(o.qty)) continue;
    if (o.kind === 'shop') {
      const id = str(o.id, 60);
      if (CATALOG.some((i) => i.id === id)) out.push({ kind: 'shop', id, qty: o.qty });
    } else if (o.kind === 'tpl') {
      const t = templateById(o.id);
      const unit = o.unitPrice;
      if (!t || typeof unit !== 'number' || !Number.isFinite(unit) || unit < 0) continue;
      // strict: a config saved before the template's options changed is dropped, never silently swapped for defaults
      // (the customer would order a different part than the one they saw)
      try {
        out.push({ kind: 'tpl', id: t.id, cfg: normalizeCfg(t, o.cfg, true), qty: o.qty, unitPrice: unit });
      } catch {}
    } else if (o.kind === 'kit') {
      // light check only (this file ships to every page): the server validates the id and the config against the kit file
      const id = str(o.id, 60), unit = o.unitPrice, cfg = o.cfg;
      const plain = !!cfg && typeof cfg === 'object' && !Array.isArray(cfg) && Object.keys(cfg).length <= 20 && Object.values(cfg).every((v) => ['string', 'number', 'boolean'].includes(typeof v));
      if (!/^[a-z0-9-]+:[A-Za-z0-9-]+$/.test(id) || !plain || typeof unit !== 'number' || !Number.isFinite(unit) || unit < 0) continue;
      out.push({ kind: 'kit', id, label: str(o.label, 80) || id, cfg: cfg as Cfg, qty: o.qty, unitPrice: unit });
    } else if (o.kind === 'design') {
      const project = str(o.project, 40);
      const material = str(o.material, 20);
      if (!UUID.test(project) || !material) continue;
      const est = o.estimate;
      out.push({ kind: 'design', project: project.toLowerCase(), label: str(o.label, 80) || 'Your design', material, qty: o.qty, estimate: typeof est === 'number' && Number.isFinite(est) && est >= 0 ? est : null });
    } else if (o.kind === 'model') {
      const file = str(o.file, 200);
      const material = str(o.material, 20);
      if (!file || !material) continue;
      const est = o.estimate;
      out.push({
        kind: 'model',
        file,
        label: str(o.label, 80) || 'Your model',
        ...(str(o.notes, 300) ? { notes: str(o.notes, 300) } : {}),
        material,
        qty: o.qty,
        estimate: typeof est === 'number' && Number.isFinite(est) && est >= 0 ? est : null,
      });
    }
  }
  return out;
}

// Adds a line, merging with an existing identical one (quantity capped at MAX_QTY).
// A new model line replaces the old estimate, since quantity may have changed the price.
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const k = lineKey(line);
  const i = lines.findIndex((l) => lineKey(l) === k);
  if (i < 0) return lines.length >= MAX_LINES ? lines : [...lines, line];
  const cur = lines[i];
  const next = { ...line, qty: Math.min(MAX_QTY, cur.qty + line.qty) } as CartLine;
  if ((next.kind === 'model' || next.kind === 'design') && next.kind === cur.kind) next.estimate = null; // merged quantity: price confirmed by us
  return lines.map((l, j) => (j === i ? next : l));
}

// A model line whose quantity changes loses its estimate: the quoted total was for the old quantity, so we quote it again.
export function setQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (!isQty(qty)) return lines;
  return lines.map((l) => {
    if (lineKey(l) !== key) return l;
    if ((l.kind === 'model' || l.kind === 'design') && l.qty !== qty) return { ...l, qty, estimate: null };
    return { ...l, qty } as CartLine;
  });
}

export const removeLine = (lines: CartLine[], key: string): CartLine[] => lines.filter((l) => lineKey(l) !== key);

// Display total of one line, or null when we will quote it manually.
export function lineTotal(l: CartLine): number | null {
  if (l.kind === 'tpl' || l.kind === 'kit') return Math.round(Math.max(MIN_ORDER, SETUP_FEE + l.unitPrice * l.qty)); // same formula as quote(); display only
  if (l.kind === 'shop') {
    const item = CATALOG.find((i) => i.id === l.id);
    return item ? item.price * l.qty : null;
  }
  return l.estimate;
}

export function cartTotal(lines: CartLine[]): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const l of lines) {
    const t = lineTotal(l);
    if (t === null) unpriced++;
    else total += t;
  }
  return { total, unpriced };
}

// Saved ("wishlist") entries are `shop:<catalogue id>` or `example:<example id>`.
export function parseSaved(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const r of raw) {
    if (out.length >= MAX_SAVED) break;
    if (typeof r !== 'string' || !/^(shop|example):[a-z0-9-]{1,60}$/.test(r) || out.includes(r)) continue;
    // drop saved shop items that are no longer in the catalogue (ids change when the catalogue does)
    if (r.startsWith('shop:') && !CATALOG.some((i) => i.id === r.slice(5))) continue;
    out.push(r);
  }
  return out;
}

export const toggleSaved = (saved: string[], key: string): string[] =>
  saved.includes(key) ? saved.filter((s) => s !== key) : saved.length >= MAX_SAVED ? saved : [...saved, key];
