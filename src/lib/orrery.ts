// Orrery app integration, pure parts: service-token verification, manifest, MCP tools, JSON-RPC dispatch, handoff single use.
// Node crypto only, no dependencies. Contract: Orrery docs/design/apps-integration.md. Must stay erasable TypeScript with .ts imports (node --test).
import { createHmac, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;
export type Claims = { iss?: string; aud?: string | string[]; sub?: string; iat?: number; exp?: number; jti?: string; purpose?: string };

const SKEW = 30; // seconds of clock skew allowed
const MAX_LIFE = 120; // service tokens: contract says 60 s, small margin
const MAX_LIFE_SSO = 60 + SKEW; // handoff tokens: 60 s plus skew

/** null while ORRERY_APP_SECRET is unset: the integration is off (503 on the API, 404 on the manifest). */
export function orreryConfig(env: Env = process.env) {
  const secret = env.ORRERY_APP_SECRET?.trim();
  if (!secret) return null;
  return { secret, appId: env.ORRERY_APP_ID?.trim() || 'printpro3d', issuer: env.ORRERY_ISSUER?.trim() || 'orrery' };
}
export type OrreryConfig = NonNullable<ReturnType<typeof orreryConfig>>;

/** HS256 JWT check: signature (constant time), alg, iss, aud, iat/exp with skew, purpose. Returns the claims or null. */
export function verifyJwt(token: string, cfg: OrreryConfig, purpose?: 'sso', nowMs = Date.now()): Claims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  let header: { alg?: unknown };
  let c: Claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header?.alg !== 'HS256' || !c || typeof c !== 'object') return null; // rejects "none" and every other alg
  const want = createHmac('sha256', cfg.secret).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const now = Math.floor(nowMs / 1000);
  if (c.iss !== cfg.issuer) return null;
  if (!(c.aud === cfg.appId || (Array.isArray(c.aud) && c.aud.includes(cfg.appId)))) return null;
  if (typeof c.exp !== 'number' || typeof c.iat !== 'number') return null;
  if (c.exp + SKEW < now || c.iat - SKEW > now || c.exp - c.iat > (purpose === 'sso' ? MAX_LIFE_SSO : MAX_LIFE)) return null;
  if (typeof c.sub !== 'string' || !c.sub.trim() || c.sub.length > 254) return null;
  if ((c.purpose ?? undefined) !== purpose) return null; // a handoff token is never a bearer token, and the reverse
  return { ...c, sub: c.sub.trim().toLowerCase() };
}

const jsonErr = (error: string, status: number, extra?: HeadersInit) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } });

/** The verified user ({ sub }) from `Authorization: Bearer`, or the Response to return (503 off, 401 bad). */
export function bearerSub(request: Request, env: Env = process.env, nowMs = Date.now()): { sub: string } | Response {
  const cfg = orreryConfig(env);
  if (!cfg) return jsonErr('Orrery integration is not configured', 503);
  const m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('authorization') ?? '');
  const claims = m ? verifyJwt(m[1], cfg, undefined, nowMs) : null;
  return claims?.sub ? { sub: claims.sub } : jsonErr('Unauthorized', 401, { 'WWW-Authenticate': 'Bearer' });
}

// ---- SSO handoff ----
// ponytail: single-use jti set lives in this process; a replay inside the 60 s window can win on another serverless instance. Use the store or KV if that matters.
const usedJti = new Map<string, number>();

/** True once per jti until it expires; false on a replay or a missing jti. */
export function consumeJti(jti: unknown, expSec: number, nowMs = Date.now(), seen = usedJti): boolean {
  if (typeof jti !== 'string' || !jti || jti.length > 200) return false;
  for (const [k, e] of seen) if (e * 1000 < nowMs) seen.delete(k);
  if (seen.has(jti)) return false;
  seen.set(jti, expSec + SKEW);
  return true;
}

/** Verifies a handoff token (purpose "sso") and burns its jti. Returns the verified lower-case email or null. */
export function acceptHandoff(token: string, env: Env = process.env, nowMs = Date.now(), seen = usedJti): string | null {
  const cfg = orreryConfig(env);
  const c = cfg ? verifyJwt(token, cfg, 'sso', nowMs) : null;
  if (!c?.sub || !c.sub.includes('@') || !consumeJti(c.jti, c.exp ?? 0, nowMs, seen)) return null;
  return c.sub;
}

/** Same-origin relative path only (no //host, no backslash, no scheme); anything else becomes "/". */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])[^\s\\]*$/.test(next) ? next : '/';
}

/** File names the Orrery file route will look up: STL only, no path characters. */
export const validFileName = (n: string) => /^[A-Za-z0-9._-]{1,128}$/.test(n) && !n.includes('..') && n.toLowerCase().endsWith('.stl');

// ---- manifest ----
export const APP_ID = 'printpro3d';

export function siteBase(env: Env = process.env): string {
  const prod = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = env.SITE_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || env.AUTH_URL?.trim() || (prod ? `https://${prod}` : '') || 'https://printpro3d.vercel.app';
  return raw.replace(/\/+$/, '');
}

export function manifest(env: Env = process.env) {
  const base = siteBase(env);
  return {
    manifestVersion: 1,
    id: env.ORRERY_APP_ID?.trim() || APP_ID,
    name: 'Print Pro 3D',
    icon: `${base}/icon.svg`,
    baseUrl: base,
    description: 'Turn a text prompt into a printable 3D model and order the print.',
    goodFor: 'Generate 3D models from a description, then order a print.',
    mcp: { url: `${base}/api/mcp` },
    auth: 'orrery-jwt',
    sso: { path: '/sso' },
    capabilities: ['job', 'model3d', 'link'],
    deepLinks: { quote: '/quote?file={file}', home: '/' },
    permission: 'actions', // generate_model spends Meshy credit, so Orrery asks the user before every run
  };
}

/** GET /.well-known/orrery-app.json. Served even before ORRERY_APP_SECRET is set: Orrery reads the manifest to register the
 *  app and only then shows the secret (the MCP and file routes stay 503 until it is set). */
export const manifestResponse = (env: Env = process.env) => Response.json(manifest(env), { headers: { 'Cache-Control': 'public, max-age=300' } });

// ---- MCP tools ----
export const TOOLS = [
  {
    name: 'generate_model',
    title: 'Generate 3D model',
    description: 'Start generating a printable 3D model (STL) from a text description. Spends one of the user\'s daily AI models. Returns a job; poll it with job_status.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to make, 3 to 400 characters. No weapons, no brands or characters.' },
        style: { type: 'string', description: 'Optional style words, e.g. "low poly" or "smooth".' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'job_status',
    title: 'Model job status',
    description: 'Status of a generate_model job: queued, running, done or failed. A finished job returns the STL file.',
    inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
] as const;

export type Status = { state: 'queued' | 'running' | 'done' | 'failed'; progress?: number; result?: Record<string, unknown>; error?: string };
export type Deps = {
  /** Starts a generation for this verified email; the quota is keyed by it. */
  generate: (a: { sub: string; prompt: string }) => Promise<{ ok: true; jobId: string } | { ok: false; error: string }>;
  /** Status of a job owned by this email, or null when it is unknown or someone else's. */
  status: (a: { sub: string; jobId: string }) => Promise<Status | null>;
};

type Rpc = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
export type RpcOut = { status: number; body?: unknown };

const rpcErr = (id: unknown, code: number, message: string): RpcOut => ({ status: 200, body: { jsonrpc: '2.0', id: id ?? null, error: { code, message } } });
const text = (t: string, structuredContent?: unknown, isError = false) => ({ content: [{ type: 'text', text: t }], ...(structuredContent ? { structuredContent } : {}), ...(isError ? { isError } : {}) });

/** Cleans prompt + optional style into one prompt string (checkPrompt still screens it). */
export const joinPrompt = (prompt: unknown, style: unknown): string => {
  const p = typeof prompt === 'string' ? prompt.trim() : '';
  const s = typeof style === 'string' ? style.replace(/[^A-Za-z0-9 ,-]/g, '').trim().slice(0, 40) : '';
  return s ? `${p}, ${s} style` : p;
};

/** One JSON-RPC message (stateless streamable HTTP, JSON replies). Notifications get 202 and no body. */
export async function handleRpc(msg: unknown, sub: string, deps: Deps): Promise<RpcOut> {
  const m = msg as Rpc;
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcErr(undefined, -32600, 'Invalid request');
  const isNote = m.id === undefined || m.method.startsWith('notifications/');
  if (isNote) return { status: 202 };
  const reply = (result: unknown): RpcOut => ({ status: 200, body: { jsonrpc: '2.0', id: m.id, result } });
  switch (m.method) {
    case 'initialize':
      return reply({
        protocolVersion: typeof m.params?.protocolVersion === 'string' ? m.params.protocolVersion : '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'printpro3d', version: '1.0.0' },
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const name = m.params?.name;
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      if (name === 'generate_model') {
        const r = await deps.generate({ sub, prompt: joinPrompt(args.prompt, args.style) });
        if (!r.ok) return reply(text(r.error, undefined, true));
        const title = (typeof args.prompt === 'string' ? args.prompt.trim() : 'Model').slice(0, 60);
        return reply(text(`Started generating "${title}". Poll job_status with jobId ${r.jobId}.`, { orrery: 1, type: 'job', jobId: r.jobId, statusTool: 'job_status', title, pollMs: 3000 }));
      }
      if (name === 'job_status') {
        const s = typeof args.jobId === 'string' ? await deps.status({ sub, jobId: args.jobId }) : null;
        // unknown or foreign job: a normal result, so Orrery's card shows "failed" instead of retrying a 502
        if (!s) return reply(text('Job not found.', { state: 'failed', error: 'Job not found' }));
        return reply(text(`Job is ${s.state}${s.progress !== undefined ? ` (${s.progress}%)` : ''}.`, s));
      }
      return rpcErr(m.id, -32602, 'Unknown tool');
    }
    default:
      return rpcErr(m.id, -32601, 'Method not found');
  }
}
