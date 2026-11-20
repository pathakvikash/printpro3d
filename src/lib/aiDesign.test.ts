import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_SCHEMA, FEW_SHOT, SYSTEM_PROMPT, buildRequest, extractReplyText, modelFor, parseModelReply, pickProvider, toDesign, type DesignResult } from './aiDesign.ts';
import { runProvider } from './aiProviders.ts';
import { MAX_SHAPES, buildMesh } from './playground.ts';
import { meshStats } from './quote.ts';

const shape = (over: Record<string, unknown> = {}) => ({
  kind: 'box', mode: 'solid', position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 }, ...over,
});
const design = (shapes: unknown[], extra: Record<string, unknown> = {}) => ({ title: 'A part', notes: 'Some notes', shapes, ...extra });
const okOf = (r: DesignResult) => { assert.ok(r.ok, r.ok ? '' : r.reason); return r; };

test('toDesign: valid design gets fresh unique ids', () => {
  const r = okOf(toDesign(design([shape(), shape({ kind: 'cylinder', mode: 'hole' })])));
  assert.equal(r.title, 'A part');
  assert.equal(r.notes, 'Some notes');
  assert.equal(r.shapes.length, 2);
  assert.equal(new Set(r.shapes.map((s) => s.id)).size, 2);
  for (const s of r.shapes) assert.ok(typeof s.id === 'string' && s.id.length > 0);
  assert.equal(r.shapes[1].mode, 'hole');
});

test('toDesign: clamps position, size low and high', () => {
  const r = okOf(toDesign(design([shape({ position: { x: 99999, y: -99999, z: 5 }, size: { x: 0, y: 900, z: -3 } })])));
  assert.deepEqual(r.shapes[0].position, { x: 10000, y: -10000, z: 5 });
  assert.deepEqual(r.shapes[0].size, { x: 0.1, y: 250, z: 0.1 });
});

test('toDesign: drops bad shapes, not the whole design', () => {
  const r = okOf(toDesign(design([
    shape({ kind: 'pyramid' }), shape({ mode: 'ghost' }), shape({ size: { x: NaN, y: 1, z: 1 } }), shape({ position: { x: Infinity, y: 0, z: 0 } }),
    shape({ rotation: { x: '5', y: 0, z: 0 } }), shape({ size: undefined }), 7, null, shape(),
  ])));
  assert.equal(r.shapes.length, 1);
});

test('toDesign: keeps exactly MAX_SHAPES', () => {
  const r = okOf(toDesign(design(Array.from({ length: MAX_SHAPES + 5 }, () => shape()))));
  assert.equal(r.shapes.length, MAX_SHAPES);
});

test('toDesign: no solids is a failure with a reason', () => {
  const r = toDesign(design([shape({ mode: 'hole' })], { notes: 'Nothing to print' }));
  assert.deepEqual(r, { ok: false, reason: 'Nothing to print' });
  const e = toDesign(design([], { notes: '' }));
  assert.ok(!e.ok && e.reason.length > 0);
  for (const bad of [null, 'x', 5, {}, { shapes: 'no' }]) assert.equal(toDesign(bad).ok, false);
});

test('toDesign: control characters stripped, title capped at 60', () => {
  const r = okOf(toDesign(design([shape()], { title: '  Br\u0000ac\u0007ket\u001b  ', notes: 'a\nb\u0000c\u007fd' })));
  assert.equal(r.title, 'Bracket');
  assert.equal(r.notes, 'abcd');
  assert.equal(okOf(toDesign(design([shape()], { title: 'x'.repeat(100), notes: 'y'.repeat(500) }))).title.length, 60);
  assert.equal(okOf(toDesign(design([shape()], { notes: 'y'.repeat(500) }))).notes.length, 300);
  assert.equal(okOf(toDesign(design([shape()], { title: 42 }))).title, '');
});

test('parseModelReply: plain, fenced, surrounded, garbage, no shapes', () => {
  const json = JSON.stringify(design([shape()]));
  assert.equal(okOf(parseModelReply(json)).shapes.length, 1);
  assert.equal(okOf(parseModelReply('```json\n' + json + '\n```')).shapes.length, 1);
  assert.equal(okOf(parseModelReply(`Here you go:\n${json}\nHope that helps!`)).shapes.length, 1);
  assert.throws(() => parseModelReply('sorry, I cannot help'), /not a design/);
  assert.throws(() => parseModelReply('{ not json }'), /not a design/);
  assert.equal(parseModelReply('{"title":"x","notes":"n"}').ok, false);
});

// every key in a JSON-ish value
const keys = (v: unknown): string[] => (v && typeof v === 'object' ? Object.entries(v).flatMap(([k, c]) => [k, ...keys(c)]) : []);
const img = { mime: 'image/jpeg' as const, base64: 'QUJD' };

test('buildRequest anthropic', () => {
  const r = buildRequest('anthropic', { text: 'a hook', image: img }, { model: 'claude-haiku-5-5', apiKey: 'k', baseUrl: '' });
  const b = r.body as { messages: { content: { type: string }[] }[]; output_config: { format: { type: string } }; system: string };
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(b.messages[0].content[0].type, 'image');
  assert.equal(b.messages[0].content[1].type, 'text');
  assert.equal(r.headers['anthropic-version'], '2026-10-21');
  assert.equal(r.headers['x-api-key'], 'k');
  assert.equal(b.output_config.format.type, 'json_schema');
  assert.equal(b.system, SYSTEM_PROMPT);
  assert.equal((r.body as { max_tokens: number }).max_tokens, 16000);
  const all = keys(r.body);
  for (const bad of ['temperature', 'top_p', 'top_k']) assert.ok(!all.includes(bad), bad);
  const t = buildRequest('anthropic', { text: ' ', image: img }, { model: 'm', apiKey: 'k', baseUrl: '' }).body as typeof b;
  assert.match(JSON.stringify(t.messages), /only a photo/);
});

test('buildRequest openai', () => {
  const cfg = { model: 'm', apiKey: undefined, baseUrl: 'http://localhost:11434/v1/' };
  const r = buildRequest('openai', { text: 'a hook', image: img }, cfg);
  const b = r.body as { messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[]; response_format: { type: string } };
  assert.equal(r.url, 'http://localhost:11434/v1/chat/completions');
  const parts = b.messages[1].content;
  assert.equal(parts[0].type, 'text');
  assert.match(parts[0].text!, /Reply with one JSON object only, no prose\./);
  assert.ok(parts[1].image_url!.url.startsWith('data:image/jpeg;base64,'));
  assert.equal(b.response_format.type, 'json_object');
  assert.equal('Authorization' in r.headers, false);
  assert.equal(buildRequest('openai', { text: 'x' }, { ...cfg, apiKey: 'sk' }).headers.Authorization, 'Bearer sk');
  for (const bad of ['temperature', 'top_p', 'top_k']) assert.ok(!keys(r.body).includes(bad), bad);
});

test('extractReplyText', () => {
  const a = { content: [{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: '{"a":1}' }] };
  assert.equal(extractReplyText('anthropic', a), '{"a":1}');
  const o = { choices: [{ message: { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] } }] };
  assert.equal(extractReplyText('openai', o), '{"a":1}');
  assert.equal(extractReplyText('openai', { choices: [{ message: { content: 'hi' } }] }), 'hi');
  assert.throws(() => extractReplyText('anthropic', { content: [{ type: 'thinking', thinking: 'x' }] }), /empty/);
  assert.throws(() => extractReplyText('openai', {}), /empty/);
});

test('pickProvider', () => {
  const p = pickProvider;
  assert.equal(p({}), null);
  assert.equal(p({ ANTHROPIC_API_KEY: 'k' }), 'anthropic');
  assert.equal(p({ ANTHROPIC_API_KEY: 'k', AI_BASE_URL: 'http://x/v1' }), 'anthropic');
  assert.equal(p({ AI_BASE_URL: 'http://x/v1' }), 'openai');
  assert.equal(p({ AI_PRESET: 'ollama' }), 'openai');
  assert.equal(p({ AI_PRESET: 'openai' }), null);
  assert.equal(p({ AI_PRESET: 'openai', AI_API_KEY: 'k' }), 'openai');
  assert.equal(p({ AI_PRESET: 'nope' }), null);
  assert.equal(p({ AI_ALLOW_CLI: '1' }), 'claude-cli');
  assert.equal(p({ AI_ALLOW_CLI: '1', NODE_ENV: 'development' }), 'claude-cli');
  assert.equal(p({ AI_ALLOW_CLI: '1', NODE_ENV: 'production' }), null);
  assert.equal(p({ AI_ALLOW_CLI: '1', VERCEL: '1' }), null);
  assert.equal(p({ AI_PROVIDER: 'claude-cli', AI_ALLOW_CLI: '1', VERCEL: '1' }), null);
  assert.equal(p({ AI_PROVIDER: 'anthropic' }), null);
  assert.equal(p({ AI_PROVIDER: 'claude-cli', NODE_ENV: 'production', AI_ALLOW_CLI: '1' }), null);
  assert.equal(p({ AI_PROVIDER: 'claude-cli', AI_ALLOW_CLI: '1' }), 'claude-cli');
  assert.equal(p({ AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'k' }), null); // strict: no fallback
  assert.equal(p({ AI_PROVIDER: 'bogus', ANTHROPIC_API_KEY: 'k' }), null);
  assert.equal(p({ AI_PROVIDER: 'toString', ANTHROPIC_API_KEY: 'k' }), null);
});

test('modelFor', () => {
  assert.equal(modelFor('anthropic', {}), 'claude-haiku-5-5');
  assert.equal(modelFor('claude-cli', {}), 'haiku');
  assert.equal(modelFor('openai', {}), null);
  assert.equal(modelFor('openai', { AI_MODEL: 'llava' }), 'llava');
});

test('few-shot examples match the data and build closed meshes', { timeout: 120000 }, () => {
  assert.equal(FEW_SHOT.length, 3);
  for (const f of FEW_SHOT) {
    assert.ok(SYSTEM_PROMPT.includes(JSON.stringify(f.answer)));
    const r = okOf(toDesign(f.answer));
    const want = (f.answer as { shapes: unknown[] }).shapes;
    assert.deepEqual(r.shapes.map((s) => ({ kind: s.kind, mode: s.mode, position: s.position, rotation: s.rotation, size: s.size })), want);
    const mesh = buildMesh(r.shapes);
    assert.ok(mesh, 'mesh');
    assert.ok(meshStats(mesh), 'closed');
  }
});

test('runProvider claude-cli rejects before spawning unless it is local dev with AI_ALLOW_CLI', async () => {
  await assert.rejects(runProvider('claude-cli', { text: 'x' }, { NODE_ENV: 'production', AI_ALLOW_CLI: '1' }), /not configured/);
  await assert.rejects(runProvider('claude-cli', { text: 'x' }, { NODE_ENV: 'development' }), /not configured/);
  await assert.rejects(runProvider('claude-cli', { text: 'x' }, { VERCEL: '1', AI_ALLOW_CLI: '1' }), /not configured/);
});

test('DESIGN_SCHEMA: closed objects and no unsupported keywords', () => {
  const banned = ['minimum', 'maximum', '$ref', 'oneOf', 'anyOf', 'allOf', 'minLength', 'maxLength', 'pattern', 'temperature', 'top_p', 'top_k'];
  const walk = (node: unknown, at: string) => {
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (o.type === 'object') assert.equal(o.additionalProperties, false, `${at} must set additionalProperties:false`);
    for (const k of banned) assert.ok(!(k in o), `${at} has ${k}`);
    for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
  };
  walk(DESIGN_SCHEMA, 'schema');
});
