// "My items": models a customer saved in this browser (localStorage, no accounts). Pure: no React, no DOM.
// Nothing here is trusted: Order again puts a normal 'model' line in the cart and /api/orders re-validates and reprices it.
import { MATERIALS, MAX_QTY, type MaterialKey, type MeshStats } from './quote.ts';
import { validUploadName } from './uploadRules.ts';
import type { CartLine } from './cart.ts';

export const MAX_ITEMS = 20;

export type MyItem = {
  id: string;
  name: string;
  file: string; // stored upload name
  material: MaterialKey;
  colour: string;
  qty: number;
  notes: string;
  stats: MeshStats | null; // display estimate only
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isQty = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QTY;

/** Returns only well-formed items (localStorage is untrusted). */
export function parseItems(raw: unknown): MyItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MyItem[] = [];
  for (const r of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id, 60);
    const material = o.material;
    if (!id || out.some((i) => i.id === id) || !validUploadName(o.file) || typeof material !== 'string' || !Object.hasOwn(MATERIALS, material) || !isQty(o.qty)) continue;
    const s = o.stats as { volumeCm3?: unknown; sizeMm?: Record<string, unknown> } | null;
    const stats = s && num(s.volumeCm3) && s.sizeMm && num(s.sizeMm.x) && num(s.sizeMm.y) && num(s.sizeMm.z)
      ? { volumeCm3: s.volumeCm3 as number, sizeMm: { x: s.sizeMm.x as number, y: s.sizeMm.y as number, z: s.sizeMm.z as number } }
      : null;
    out.push({ id, name: str(o.name, 80) || 'My model', file: o.file, material: material as MaterialKey, colour: str(o.colour, 40), qty: o.qty, notes: str(o.notes, 300), stats });
  }
  return out;
}

/** Adds (newest first) or replaces the item with the same id; drops the oldest beyond MAX_ITEMS. */
export function saveItem(items: MyItem[], item: MyItem): MyItem[] {
  return [item, ...items.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS);
}

export const removeItem = (items: MyItem[], id: string): MyItem[] => items.filter((i) => i.id !== id);

export const updateItem = (items: MyItem[], id: string, patch: Partial<Pick<MyItem, 'name' | 'material' | 'colour' | 'qty' | 'notes'>>): MyItem[] =>
  parseItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

/** The cart line for Order again: the plain 'model' line the quote page adds; colour rides in the label the owner sees. */
export function toCartLine(i: MyItem, estimate: number | null): CartLine {
  const label = (i.colour ? `${i.name} (${i.colour})` : i.name).slice(0, 80);
  return { kind: 'model', file: i.file, label, material: i.material, qty: i.qty, estimate };
}
