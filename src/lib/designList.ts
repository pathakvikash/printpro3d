// The designs this browser has opened, newest first, kept in localStorage. Only pointers: the server holds the work, and removing
// an entry here never deletes it. Pure helpers (raw string in, value out) so they can be tested without a browser.
import { parseStoredId } from './buildFlow.ts';

export const DESIGNS_KEY = 'printpro3d.designs.v1';
export const DESIGNS_MAX = 20;
export type DesignEntry = { id: string; title: string; updatedAt: string };

/** localStorage is untrusted: keep well-formed entries only. `legacyId` is the old single-id key, migrated when not already listed. */
export function parseDesigns(raw: unknown, legacyId: unknown = null, now = new Date().toISOString()): DesignEntry[] {
  let arr: unknown[] = [];
  try { const v = JSON.parse(typeof raw === 'string' ? raw : '[]'); if (Array.isArray(v)) arr = v; } catch {}
  const out: DesignEntry[] = [];
  for (const e of arr) {
    const o = e as Partial<DesignEntry> | null;
    const id = parseStoredId(o?.id);
    if (!id || out.some((x) => x.id === id)) continue;
    out.push({ id, title: typeof o?.title === 'string' ? o.title.slice(0, 80) : '', updatedAt: typeof o?.updatedAt === 'string' ? o.updatedAt : now });
  }
  const old = parseStoredId(legacyId);
  if (old && !out.some((x) => x.id === old)) out.push({ id: old, title: '', updatedAt: now });
  return out.slice(0, DESIGNS_MAX);
}

/** Add or update an entry and move it to the front; an empty title keeps the old one. Oldest entries beyond the cap fall off. */
export function upsertDesign(list: DesignEntry[], id: string, title: string, now = new Date().toISOString()): DesignEntry[] {
  const prev = list.find((e) => e.id === id);
  return [{ id, title: title.trim().slice(0, 80) || prev?.title || '', updatedAt: now }, ...list.filter((e) => e.id !== id)].slice(0, DESIGNS_MAX);
}

export const removeDesign = (list: DesignEntry[], id: string): DesignEntry[] => list.filter((e) => e.id !== id);
