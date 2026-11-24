// Owner-chosen AI settings (provider, preset, model, base URL), set in /admin and kept in the store. NON-secret only: keys stay in env.
// Precedence for every AI route: stored settings, then env (AI_PROVIDER, AI_PRESET, AI_MODEL, AI_BASE_URL), then the defaults in aiDesign.ts.
// The stored choice is applied by overlaying those env names, so pickProvider/modelFor/endpointFor/designModel need no change.
import { PRESETS, type Env, type ProviderId } from './aiDesign.ts';
import { getJson } from './store.ts';

export type AiSettings = { provider: ProviderId; preset?: string; model?: string; baseUrl?: string };
export const SETTINGS_NS = 'settings';
export const SETTINGS_KEY = 'ai.json';
export const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/; // openrouter "a/b", ollama "q:8b", lmstudio "qwen/qwen3.5-9b"
const ALLOWED = new Set(['provider', 'preset', 'model', 'baseUrl']);
const LOCAL_PRESETS = new Set(['ollama', 'lmstudio']);

export const isProd = (env: Env) => env.NODE_ENV === 'production' || !!env.VERCEL;

/** True for loopback, private, link-local and local-only host names (IPv4, IPv6, names). Not a DNS check. */
export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h === '0.0.0.0') return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (h.includes(':')) return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  return false;
}

export type Checked = { ok: true; settings: AiSettings | null } | { ok: false; error: string };

/** Strict check of a PUT body. `{ provider: 'auto' }` clears the stored choice (env decides again). Never accepts a key. */
export function validateSettings(body: unknown, env: Env): Checked {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send a JSON object' };
  const o = body as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!ALLOWED.has(k)) return { ok: false, error: `Unknown field: ${k.slice(0, 40)}. API keys are set as server env vars only.` };
  const str = (k: string) => (o[k] === undefined || o[k] === '' || o[k] === null ? undefined : o[k]);
  const provider = o.provider;
  if (provider === 'auto') return { ok: true, settings: null };
  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'claude-cli') return { ok: false, error: 'provider must be auto, anthropic, openai or claude-cli' };
  if (provider === 'claude-cli' && isProd(env)) return { ok: false, error: 'claude-cli is for local development only' };
  const out: AiSettings = { provider };

  const model = str('model');
  if (model !== undefined) {
    if (typeof model !== 'string' || !MODEL_RE.test(model)) return { ok: false, error: 'model: 1-120 letters, digits and . _ : / @ + -' };
    out.model = model;
  }
  const preset = str('preset'), baseUrl = str('baseUrl');
  if (provider !== 'openai' && (preset !== undefined || baseUrl !== undefined)) return { ok: false, error: 'preset and baseUrl are for the openai-compatible provider only' };
  if (preset !== undefined) {
    if (typeof preset !== 'string' || !Object.hasOwn(PRESETS, preset)) return { ok: false, error: `preset must be one of ${Object.keys(PRESETS).join(', ')}` };
    if (LOCAL_PRESETS.has(preset) && baseUrl === undefined && isProd(env)) return { ok: false, error: 'Local presets need a public https baseUrl in production' };
    out.preset = preset;
  }
  if (baseUrl !== undefined) {
    if (typeof baseUrl !== 'string' || baseUrl.length > 300) return { ok: false, error: 'baseUrl must be a URL of at most 300 characters' };
    let u: URL;
    try { u = new URL(baseUrl); } catch { return { ok: false, error: 'baseUrl is not a valid URL' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'baseUrl must be http or https' };
    if (u.username || u.password) return { ok: false, error: 'baseUrl must not contain a user or password' };
    if (u.search || u.hash) return { ok: false, error: 'baseUrl must not have a query or fragment' };
    if (isProd(env) && (u.protocol !== 'https:' || privateHost(u.hostname))) return { ok: false, error: 'In production baseUrl must be https on a public host' };
    out.baseUrl = u.href.replace(/\/+$/, '');
  }
  return { ok: true, settings: out };
}

/** env with the stored choice laid over it. A stored model also beats AI_DESIGN_MODEL/AI_DESIGN_TIER (the blueprint flow). */
export function applySettings(env: Env, s: AiSettings | null): Env {
  if (!s) return env;
  const out: Env = { ...env, AI_PROVIDER: s.provider, AI_MODEL: s.model };
  if (s.model) { out.AI_DESIGN_MODEL = undefined; out.AI_DESIGN_TIER = undefined; }
  if (s.provider === 'openai' && (s.preset || s.baseUrl)) { out.AI_PRESET = s.preset; out.AI_BASE_URL = s.baseUrl; }
  return out;
}

/** The stored settings, re-validated on read (a hand-edited or stale file is ignored), or null. */
export async function storedSettings(env: Env = process.env): Promise<AiSettings | null> {
  try {
    const r = validateSettings(await getJson(SETTINGS_NS, SETTINGS_KEY), env);
    return r.ok ? r.settings : null;
  } catch {
    return null;
  }
}

/** The env every AI route should resolve its provider from. */
export async function aiEnv(env: Env = process.env): Promise<Env> {
  return applySettings(env, await storedSettings(env));
}
