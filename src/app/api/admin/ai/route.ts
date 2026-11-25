import { NextResponse } from 'next/server';
import { aiSettingsGate } from '@/lib/adminAuth';
import { PRESETS, cliAllowed, modelFor, pickProvider, endpointFor } from '@/lib/aiDesign';
import { listModels, runChat } from '@/lib/aiProviders';
import { designModel } from '@/lib/aiBlueprint';
import { SETTINGS_KEY, SETTINGS_NS, applySettings, isProd, storedSettings, validateSettings } from '@/lib/aiSettings';
import { del, putJson } from '@/lib/store';

// Owner AI settings. GET: stored choice, what is in effect, which env keys are present (booleans only).
// PUT: save the non-secret choice. POST {action:'models'|'test', settings?}: list models or make one tiny real call with a draft or the saved choice.
// Keys never leave the server and are never accepted here.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BODY_MAX = 2048;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function body(request: Request): Promise<unknown> {
  const t = await request.text();
  if (t.length > BODY_MAX) throw new Error('Request too large');
  return JSON.parse(t);
}

function effective(env: Record<string, string | undefined>) {
  const provider = pickProvider(env);
  const ep = provider === 'openai' ? endpointFor(env) : null;
  return { provider, model: provider ? modelFor(provider, env) : null, preset: provider === 'openai' ? env.AI_PRESET ?? null : null, baseUrl: ep?.baseUrl ?? null };
}

/** What Auto picks right now (ignores AI_PROVIDER): ids and a label only, never key values. */
function autoPick(env: Record<string, string | undefined>) {
  const provider = pickProvider({ ...env, AI_PROVIDER: undefined });
  const model = provider ? modelFor(provider, env) : null;
  const label = provider === 'anthropic' ? `Anthropic (${model})`
    : provider === 'openai' ? `OpenAI-compatible${env.AI_PRESET ? ` (${env.AI_PRESET})` : ''}`
    : provider === 'claude-cli' ? 'Claude Code CLI (local only)'
    : `none: add ANTHROPIC_API_KEY in ${isProd(env) ? 'Vercel' : '.env.local'}`;
  return { provider, model, label };
}

export async function GET(request: Request) {
  const denied = await aiSettingsGate(request);
  if (denied) return denied;
  const stored = await storedSettings();
  return NextResponse.json({
    stored,
    effective: effective(applySettings(process.env, stored)),
    keys: { ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY, AI_API_KEY: !!process.env.AI_API_KEY, MESHY_API_KEY: !!process.env.MESHY_API_KEY },
    presets: Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, { label: p.label, baseUrl: p.baseUrl, keyless: p.keyless, note: p.note }])),
    cliAllowed: cliAllowed(process.env),
    auto: autoPick(applySettings(process.env, null)),
  });
}

export async function PUT(request: Request) {
  const denied = await aiSettingsGate(request);
  if (denied) return denied;
  let b: unknown;
  try { b = await body(request); } catch { return bad('Send a small JSON object'); }
  const v = validateSettings(b, process.env);
  if (!v.ok) return bad(v.error);
  if (v.settings) await putJson(SETTINGS_NS, SETTINGS_KEY, v.settings);
  else await del(SETTINGS_NS, SETTINGS_KEY);
  return NextResponse.json({ stored: v.settings, effective: effective(applySettings(process.env, v.settings)) });
}

const PING = {
  system: 'Reply with the JSON object {"ok":true} and nothing else.',
  user: 'ping',
  schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
};

export async function POST(request: Request) {
  const denied = await aiSettingsGate(request);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    const raw = await body(request);
    if (!raw || typeof raw !== 'object') throw new Error();
    b = raw as Record<string, unknown>;
  } catch {
    return bad('Send a small JSON object');
  }
  let settings = await storedSettings();
  if (b.settings !== undefined) {
    const v = validateSettings(b.settings, process.env);
    if (!v.ok) return bad(v.error);
    settings = v.settings;
  }
  const env = applySettings(process.env, settings);
  const provider = pickProvider(env);
  if (!provider) return NextResponse.json({ ok: false, error: 'No provider is usable with this choice (missing key or base URL?)' });
  try {
    if (b.action === 'models') {
      const { models } = await listModels(env);
      return NextResponse.json({ ok: true, models: models.slice(0, 500) });
    }
    if (b.action === 'test') {
      const t0 = Date.now();
      const reply = await runChat(provider, PING, env);
      return NextResponse.json({ ok: true, provider, model: designModel(provider, env), ms: Date.now() - t0, reply: reply.slice(0, 80) });
    }
  } catch (e) {
    // aiProviders errors are short status lines only (no keys, no upstream bodies)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'failed' });
  }
  return bad('action must be models or test');
}
