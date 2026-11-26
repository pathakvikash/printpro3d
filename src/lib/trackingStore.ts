// Changing an order's or request's status, shared by the admin API and scripts/set-status.mjs. Server only.
// Must stay erasable TypeScript with explicit .ts imports (the script imports it under Node's type stripping).
import { notifyStatusChange } from './notify.ts';
import { getJson, putJson } from './store.ts';
import { noteError } from './adminList.ts';
import { ALL_STATUSES, type TrackType } from './tracking.ts';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FOLDER: Record<TrackType, string> = { order: 'orders', request: 'requests' };

export type SetStatusResult =
  | { ok: true; type: TrackType; id: string; from: string; to: string; emailed: boolean }
  | { ok: false; code: 'bad_id' | 'unknown_status' | 'not_found' | 'wrong_type'; message: string };

/**
 * Sets `status` on the order or request with this id and emails the customer when it changed.
 * `type` limits the lookup (the admin screen knows it); without it orders are tried first, then requests.
 */
export async function setStatus(id: string, status: string, type?: TrackType): Promise<SetStatusResult> {
  if (!UUID.test(id)) return { ok: false, code: 'bad_id', message: `id must be a UUID, got: ${id}` };
  const key = id.toLowerCase();
  if (![...ALL_STATUSES.order, ...ALL_STATUSES.request].includes(status)) {
    return { ok: false, code: 'unknown_status', message: `unknown status: ${status}` };
  }
  for (const t of type ? [type] : (['order', 'request'] as const)) {
    const file = `${key}.json`;
    const rec = await getJson<Record<string, unknown>>(FOLDER[t], file);
    if (!rec || typeof rec !== 'object') continue;
    if (!ALL_STATUSES[t].includes(status)) {
      return { ok: false, code: 'wrong_type', message: `"${status}" is not a valid ${t} status` };
    }
    const from = String(rec.status ?? '');
    rec.status = status;
    await putJson(FOLDER[t], file, rec);
    // a repeat of the same status does not email the customer again
    const emailed = from !== status && (await notifyStatusChange(t, key, status, rec));
    return { ok: true, type: t, id: key, from, to: status, emailed };
  }
  return { ok: false, code: 'not_found', message: `no ${type ?? 'order or request'} with id ${key}` };
}

/** Saves the owner's private note on an order or request. Never exposed by /api/track. */
export async function setNote(id: string, note: unknown, type?: TrackType): Promise<{ ok: true; type: TrackType } | { ok: false; code: 'bad_id' | 'bad_note' | 'not_found'; message: string }> {
  if (!UUID.test(id)) return { ok: false, code: 'bad_id', message: 'id must be a UUID' };
  const err = noteError(note);
  if (err) return { ok: false, code: 'bad_note', message: err };
  const file = `${id.toLowerCase()}.json`;
  for (const t of type ? [type] : (['order', 'request'] as const)) {
    const rec = await getJson<Record<string, unknown>>(FOLDER[t], file);
    if (!rec || typeof rec !== 'object') continue;
    rec.ownerNote = note;
    rec.ownerNoteAt = new Date().toISOString();
    await putJson(FOLDER[t], file, rec);
    return { ok: true, type: t };
  }
  return { ok: false, code: 'not_found', message: 'not found' };
}
