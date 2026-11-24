// What the cart page shows for a line: name, chosen settings, kit grouping. Pure (no React, no geometry): safe for /cart's first load.
import { CATALOG } from './catalog.ts';
import { KIT_METAS } from './kitMeta.ts';
import type { CartLine } from './cart.ts';
import { templateById } from './templateDefs.ts';

export type KitLine = Extract<CartLine, { kind: 'kit' }>;
export type Section = { kind: 'kit'; id: string; title: string; lines: KitLine[] } | { kind: 'line'; line: CartLine };

const SEP = ' · '; // kitLines() labels a part `<kit name> · <part>`
const kitIdOf = (l: KitLine) => l.id.split(':')[0];

export const shopItem = (id: string) => CATALOG.find((i) => i.id === id) ?? null;

export function lineName(l: CartLine): string {
  if (l.kind === 'shop') return shopItem(l.id)?.name ?? l.id;
  if (l.kind === 'tpl') return templateById(l.id)?.name ?? l.id;
  if (l.kind === 'kit') { const i = l.label.indexOf(SEP); return i < 0 ? l.label : l.label.slice(i + SEP.length); }
  return l.label;
}

/** Kit lines of one kit become one section (first appearance decides its place); every other line is a section of its own. */
export function groupLines(lines: CartLine[]): Section[] {
  const out: Section[] = [];
  const kits = new Map<string, Extract<Section, { kind: 'kit' }>>();
  for (const l of lines) {
    if (l.kind !== 'kit') { out.push({ kind: 'line', line: l }); continue; }
    const id = kitIdOf(l);
    let s = kits.get(id);
    if (!s) {
      const i = l.label.indexOf(SEP);
      s = { kind: 'kit', id, title: i > 0 ? l.label.slice(0, i) : (KIT_METAS.find((k) => k.id === id)?.title ?? id), lines: [] };
      kits.set(id, s);
      out.push(s);
    }
    s.lines.push(l);
  }
  return out;
}

/** The settings the customer chose, as short `Label: value` texts (templates), or the kit's own settings note. */
export function lineSettings(l: CartLine): string[] {
  if (l.kind === 'kit') return l.note ? [l.note] : [];
  if (l.kind === 'model') return l.notes ? [`Notes: ${l.notes}`] : [];
  if (l.kind !== 'tpl') return [];
  const t = templateById(l.id);
  if (!t) return [];
  return t.fields.map((f) => {
    const v = l.cfg[f.key];
    if (f.type === 'bool') return `${f.label}: ${v ? 'yes' : 'no'}`;
    if (f.type === 'select') return `${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}`;
    return `${f.label}: ${v}${f.unit ? ` ${f.unit}` : ''}`;
  });
}

export function lineMaterial(l: CartLine): string {
  if (l.kind === 'shop') return shopItem(l.id)?.material ?? '';
  if (l.kind === 'tpl') return templateById(l.id)?.material ?? '';
  return l.kind === 'kit' ? '' : l.material;
}
