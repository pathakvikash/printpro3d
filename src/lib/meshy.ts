// Meshy API client (https://docs.meshy.ai). Server only: the key must never reach client code.
//
// Env vars:
//   MESHY_API_KEY        Meshy Pro plan key (API keys need a paid plan). Server-side only. Unset = AI generation is off.
//   MESHY_BASE_URL       optional, defaults to https://api.meshy.ai (tests point it at a local stub)
//   AI_DAILY_PER_EMAIL   generations per email per UTC day, default 3 (see aiGuard.ts)
//   AI_DAILY_TOTAL       generations per UTC day across everyone, default 40
//
// Endpoints used (all documented, see the report): text-to-3d v2, image-to-3d v1, print/repair v1.
// Meshy keeps outputs for 3 days only, so callers download the STL and keep their own copy.
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type Kind = 'text' | 'image' | 'repair';
export type TaskState = 'pending' | 'working' | 'succeeded' | 'failed';
export type Task = { state: TaskState; progress: number; stlUrl: string | null; error: string | null };

export class MeshyError extends Error {
  status: number; // no parameter property: node's type stripping rejects it
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PATHS: Record<Kind, string> = {
  text: '/openapi/v2/text-to-3d',
  image: '/openapi/v1/image-to-3d',
  repair: '/openapi/v1/print/repair',
};

export const meshyEnabled = () => Boolean(process.env.MESHY_API_KEY);

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, unknown>> {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new MeshyError(503, 'Meshy is not configured');
  const base = (process.env.MESHY_BASE_URL ?? 'https://api.meshy.ai').replace(/\/+$/, '');
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // error bodies are {"message": "..."}; never echo anything else, and never the key
    const msg = typeof data?.message === 'string' ? data.message.slice(0, 200) : res.statusText;
    throw new MeshyError(res.status, `Meshy ${res.status}: ${msg}`);
  }
  return data;
}

async function create(kind: Kind, body: unknown): Promise<string> {
  const data = await call('POST', PATHS[kind], body);
  if (typeof data.result !== 'string' || !data.result) throw new MeshyError(502, 'Meshy returned no task id');
  return data.result;
}

/** Text to 3D, preview mode only: an untextured mesh (20 credits on the default model). Prompt max 800 chars at Meshy. */
export const createTextTask = (prompt: string) =>
  create('text', { mode: 'preview', prompt, target_formats: ['stl'], moderation: true });

/** Image to 3D from a public URL or a base64 data URI (png/jpg/webp, max 20MB at Meshy). should_texture:false = mesh only. */
export const createImageTask = (imageDataOrUrl: string) =>
  create('image', { image_url: imageDataOrUrl, should_texture: false, target_formats: ['stl'], moderation: true });

export async function getTask(kind: Kind, id: string): Promise<Task> {
  const d = await call('GET', `${PATHS[kind]}/${encodeURIComponent(id)}`);
  const status = d.status;
  const urls = d.model_urls as Record<string, unknown> | null | undefined;
  const err = d.task_error as { message?: unknown } | null | undefined;
  const state: TaskState =
    status === 'SUCCEEDED' ? 'succeeded'
    : status === 'FAILED' || status === 'CANCELED' ? 'failed'
    : status === 'IN_PROGRESS' ? 'working'
    : 'pending';
  return {
    state,
    progress: typeof d.progress === 'number' ? d.progress : 0,
    stlUrl: typeof urls?.stl === 'string' ? urls.stl : null,
    error: state === 'failed' ? (typeof err?.message === 'string' ? err.message.slice(0, 200) : status === 'CANCELED' ? 'Canceled' : 'Generation failed') : null,
  };
}

/**
 * Print repair for FDM (10 credits). modelUrl must be a public http(s) STL URL (Meshy's own signed URL works).
 * Meshy keeps the model's scale; sizeMm is the longest side the wall-thickness check should assume.
 * Waits for the task and returns the repaired STL URL. Throws on failure or timeout.
 */
export async function repairForPrint(modelUrl: string, sizeMm: number, opts: { pollMs?: number; timeoutMs?: number } = {}): Promise<string> {
  const id = await create('repair', {
    model_url: modelUrl,
    printer_type: 'fdm',
    intended_print_longest_side_mm: Math.min(1000, Math.max(1, Math.round(sizeMm))),
  });
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  for (;;) {
    const t = await getTask('repair', id);
    if (t.state === 'succeeded') {
      if (!t.stlUrl) throw new MeshyError(502, 'Repair returned no STL');
      return t.stlUrl;
    }
    if (t.state === 'failed') throw new MeshyError(502, t.error ?? 'Repair failed');
    if (Date.now() > deadline) throw new MeshyError(504, 'Repair timed out');
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 3000));
  }
}

/**
 * Hosts a result file may come from, as suffixes: the host itself or any subdomain, https only.
 * ponytail: suffix match because the exact asset host could not be confirmed from the Meshy docs; narrow it to that host once confirmed.
 */
export const MESHY_ASSET_SUFFIXES = ['meshy.ai'];

/** May downloadTo fetch this URL? Same origin as MESHY_BASE_URL (the test stub), or https on an allowed Meshy host. */
export function downloadAllowed(url: string, base = process.env.MESHY_BASE_URL ?? 'https://api.meshy.ai'): boolean {
  const parse = (s: string) => {
    try {
      return new URL(s);
    } catch {
      return null;
    }
  };
  const u = parse(url);
  const b = parse(base);
  if (!u || !b) return false;
  if (u.origin === b.origin) return true;
  if (u.protocol !== 'https:') return false;
  return MESHY_ASSET_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith(`.${s}`));
}

/** Stream a (signed, unauthenticated) result URL to disk with a size cap. The API key is never sent. Redirects are refused. */
export async function downloadTo(url: string, dest: string, maxBytes = 100 * 1024 * 1024): Promise<number> {
  if (!downloadAllowed(url)) throw new MeshyError(400, 'Model download URL not allowed');
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'error' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > maxBytes) throw new Error('Model file too large');
  let n = 0;
  const cap = new Transform({
    transform(chunk, _enc, cb) {
      n += chunk.length;
      cb(n > maxBytes ? new Error('Model file too large') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), cap, createWriteStream(dest));
  } catch (e) {
    await unlink(dest).catch(() => {});
    throw e;
  }
  return n;
}
