// Server only: calls the configured AI provider. Errors carry a short status line only, never keys, customer text or upstream bodies.
// Nothing is logged here.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildChatRequest, designModel, type ChatInput } from './aiBlueprint.ts';
import { SYSTEM_PROMPT, anthropicHeaders, buildRequest, endpointFor, extractReplyText, modelFor, pickProvider, type DesignInput, type Env, type ProviderId } from './aiDesign.ts';

const TIMEOUT_MS = 60_000;
const STDOUT_MAX = 1024 * 1024;
const NOT_CONFIGURED = 'AI is not configured';

// a SyntaxError from res.json() quotes the upstream body, so a bad body gets a fixed message instead
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new Error('The AI service returned an unreadable reply');
  }
}

async function post(req: { url: string; headers: Record<string, string>; body: unknown }): Promise<unknown> {
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The AI service returned status ${res.status}`);
  return readJson(res);
}

// The claude-cli provider is OWNER'S LOCAL DEVELOPMENT ONLY. Anthropic's terms forbid routing end customers' requests through a
// subscription login (terms: code.claude.com/docs/en/legal-and-compliance), so it needs NODE_ENV !== 'production', VERCEL unset AND AI_ALLOW_CLI=1.
// The CLI's Read tool can read any absolute path, so this provider is for the owner's own local tests with the owner's own prompts only.
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

async function runCli(input: DesignInput, env: Env, system: string = SYSTEM_PROMPT): Promise<string> {
  if (env.NODE_ENV === 'production' || env.VERCEL || env.AI_ALLOW_CLI !== '1') throw new Error(NOT_CONFIGURED);
  const dir = await mkdtemp(path.join(tmpdir(), 'ai-design-'));
  try {
    let prompt = 'Answer with the JSON object only.';
    const text = input.text.trim() || 'The customer sent only a photo: draw the part in it.';
    if (input.image) {
      const file = path.join(dir, `photo.${EXT[input.image.mime]}`);
      await writeFile(file, Buffer.from(input.image.base64, 'base64'));
      prompt = `First use the Read tool on the image file ${file}. Then answer with the JSON object only.`;
    }
    const args = ['-p', '--output-format', 'json', '--tools', 'Read', '--max-turns', '4', '--no-session-persistence', '--disable-slash-commands',
      '--strict-mcp-config', '--model', modelFor('claude-cli', env)!, '--system-prompt', system, '--', `${text}\n\n${prompt}`];
    // only what the CLI needs to find its login; never ANTHROPIC_API_KEY
    const cliEnv = {} as NodeJS.ProcessEnv; // Next's types make NODE_ENV required; we deliberately omit it
    for (const k of ['PATH', 'HOME', 'CLAUDE_CONFIG_DIR']) if (env[k]) cliEnv[k] = env[k]!;
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, { shell: false, cwd: dir, env: cliEnv, timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      let bytes = 0;
      let done = false;
      const end = (f: () => void) => { if (!done) { done = true; clearTimeout(timer); f(); } };
      const timer = setTimeout(() => { child.kill('SIGKILL'); end(() => reject(new Error('The AI took too long'))); }, TIMEOUT_MS);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (d: string) => {
        buf += d;
        bytes += Buffer.byteLength(d);
        if (bytes > STDOUT_MAX) { child.kill('SIGKILL'); end(() => reject(new Error('The AI reply was too large'))); }
      });
      child.on('error', () => end(() => reject(new Error('The claude CLI could not be started'))));
      // the CLI exits 1 with a JSON body when is_error is true, so let the parse below decide
      child.on('close', (code) => end(() => (code === 0 || buf ? resolve(buf) : reject(new Error(`The claude CLI exited with status ${code}`)))));
    });
    let j: { is_error?: boolean; result?: unknown };
    try {
      j = JSON.parse(out);
    } catch {
      throw new Error('The claude CLI reply was not JSON');
    }
    if (j.is_error) throw new Error('The claude CLI reported an error');
    if (typeof j.result !== 'string' || !j.result.trim()) throw new Error('The AI reply was empty');
    return j.result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Run one design request and return the model's raw reply text (feed it to parseModelReply). */
export async function runProvider(provider: ProviderId, input: DesignInput, env: Env): Promise<string> {
  if (provider === 'claude-cli') return runCli(input, env);
  const model = modelFor(provider, env);
  if (!model) throw new Error(NOT_CONFIGURED);
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error(NOT_CONFIGURED);
    return extractReplyText('anthropic', await post(buildRequest('anthropic', input, { model, apiKey: env.ANTHROPIC_API_KEY, baseUrl: '' })));
  }
  const ep = endpointFor(env);
  if (!ep) throw new Error(NOT_CONFIGURED);
  return extractReplyText('openai', await post(buildRequest('openai', input, { model, apiKey: ep.apiKey, baseUrl: ep.baseUrl })));
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const has = (v: unknown, s: string) => Array.isArray(v) && v.includes(s);

export async function listModels(env: Env): Promise<{ provider: ProviderId; models: { id: string; name?: string; vision: 'yes' | 'no' | 'unknown' }[] }> {
  const provider = pickProvider(env);
  if (!provider) throw new Error('No AI provider is configured');
  if (provider === 'claude-cli') throw new Error('The claude-cli provider has no model list here; use AI_MODEL');
  let url: string;
  let headers: Record<string, string>;
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/models?limit=1000';
    headers = anthropicHeaders(env.ANTHROPIC_API_KEY!);
  } else {
    const ep = endpointFor(env)!;
    url = ep.modelsUrl;
    headers = ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {};
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`The AI service returned status ${res.status}`);
  const data = obj(await readJson(res)).data;
  const models = (Array.isArray(data) ? data : []).map(obj).filter((m) => typeof m.id === 'string').map((m) => {
    let vision: 'yes' | 'no' | 'unknown' = 'unknown';
    const sup = obj(obj(m.capabilities).image_input).supported;
    if (typeof sup === 'boolean') vision = sup ? 'yes' : 'no'; // Anthropic
    else if (has(obj(m.architecture).input_modalities, 'image') || has(obj(m.modalities).input, 'image')) vision = 'yes'; // OpenRouter, OpenCode
    const name = typeof m.display_name === 'string' ? m.display_name : typeof m.name === 'string' ? m.name : undefined;
    return { id: m.id as string, ...(name ? { name } : {}), vision };
  });
  return { provider, models };
}

/** One text-only call with a caller-supplied system prompt and schema (blueprint flow). Returns the raw reply text. */
export async function runChat(provider: ProviderId, chat: ChatInput, env: Env): Promise<string> {
  if (provider === 'claude-cli') return runCli({ text: chat.user }, env, chat.system);
  const model = designModel(provider, env);
  if (!model) throw new Error(NOT_CONFIGURED);
  const ep = provider === 'openai' ? endpointFor(env) : null;
  if (provider === 'anthropic' ? !env.ANTHROPIC_API_KEY : !ep) throw new Error(NOT_CONFIGURED);
  const req = buildChatRequest(provider, chat, { model, apiKey: provider === 'anthropic' ? env.ANTHROPIC_API_KEY : ep!.apiKey, baseUrl: ep?.baseUrl ?? '' });
  return extractReplyText(provider, await post(req));
}
