// "Build with AI" chat: pure state helpers. Kept free of three/playground imports so the chat bundle stays small.
// History lives in sessionStorage only (this tab); the email in localStorage. Both are untrusted on read.
import type { Shape } from './playground.ts';

export type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; photo?: boolean; title?: string; shapes?: Shape[]; error?: boolean };
export const CHAT_KEY = 'printpro3d.aichat.v1';
export const EMAIL_KEY = 'printpro3d.aichat.email';
export const AI_DRAFT_KEY = 'printpro3d.aidesign.v1'; // read by Playground (?from=ai)
export const MAX_MSGS = 40;
export const MAX_TEXT = 600; // matches DESIGN_PROMPT_MAX on the server
const MAX_SHAPES = 20;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max) : '');
const isV3 = (v: unknown) => !!v && typeof v === 'object' && ['x', 'y', 'z'].every((k) => Number.isFinite((v as Record<string, unknown>)[k]));
const isShape = (s: unknown) => {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.kind === 'string' && (o.mode === 'solid' || o.mode === 'hole') && isV3(o.position) && isV3(o.rotation) && isV3(o.size);
};

/** Messages from storage; anything malformed is dropped (shapes are re-validated by the server and the builder anyway). */
export function parseHistory(raw: string | null): ChatMsg[] {
  let arr: unknown;
  try { arr = JSON.parse(raw ?? '[]'); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: ChatMsg[] = [];
  for (const m of arr.slice(-MAX_MSGS)) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    if ((o.role !== 'user' && o.role !== 'assistant') || typeof o.id !== 'string') continue;
    const msg: ChatMsg = { id: clean(o.id, 40), role: o.role, text: clean(o.text, 1000) };
    if (o.photo === true) msg.photo = true;
    if (o.error === true) msg.error = true;
    if (typeof o.title === 'string') msg.title = clean(o.title, 60);
    if (Array.isArray(o.shapes) && o.shapes.length > 0 && o.shapes.length <= MAX_SHAPES && o.shapes.every(isShape)) msg.shapes = o.shapes as Shape[];
    out.push(msg);
  }
  return out;
}

export const addMsg = (list: ChatMsg[], msg: ChatMsg): ChatMsg[] => [...list, msg].slice(-MAX_MSGS);

/** The latest assistant design, which a follow-up turn edits; null after "New" or before the first design. */
export function lastDesign(list: ChatMsg[]): ChatMsg | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.role === 'assistant' && m.shapes) return m;
    if (m.role === 'assistant' && m.text === NEW_MARK) return null;
  }
  return null;
}
/** A divider message: designs before it are not refined any more. */
export const NEW_MARK = 'New design. Describe what you want.';

/** Fields for POST /api/design. With `refine`, the server edits those shapes instead of starting over. */
export function designFields(o: { email: string; prompt: string; refine?: Shape[] | null; trap?: string }): [string, string][] {
  const f: [string, string][] = [['email', o.email.trim()]];
  const prompt = o.prompt.trim().slice(0, MAX_TEXT);
  if (prompt) f.push(['prompt', prompt]);
  if (o.refine?.length) f.push(['shapes', JSON.stringify(o.refine.map(({ id, kind, mode, position, rotation, size }) => ({ id, kind, mode, position, rotation, size })))]);
  if (o.trap) f.push(['website', o.trap]);
  return f;
}

/** The assistant message for a /api/design answer, or an error message. */
export function replyMsg(id: string, ok: boolean, body: unknown, fallback: string): ChatMsg {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!ok || !Array.isArray(b.shapes) || !b.shapes.length || !b.shapes.every(isShape)) {
    return { id, role: 'assistant', error: true, text: clean(b.error, 400) || fallback };
  }
  return { id, role: 'assistant', title: clean(b.title, 60), text: clean(b.notes, 300) || 'Here is a first version.', shapes: (b.shapes as Shape[]).slice(0, MAX_SHAPES) };
}

/** The payload Playground reads from sessionStorage for ?from=ai. */
export const draftFor = (m: ChatMsg, photo: boolean) => JSON.stringify({ title: m.title ?? '', notes: m.text, shapes: m.shapes ?? [], source: photo ? 'photo' : 'description' });

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
