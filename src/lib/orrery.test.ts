import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { TOOLS, acceptHandoff, bearerSub, handleRpc, manifest, orreryConfig, safeNext, validFileName, verifyJwt, type Deps } from './orrery.ts';
import { startJob } from './aiGenerate.ts';

const SECRET = 's3cret-for-tests';
const env = { ORRERY_APP_SECRET: SECRET };
const cfg = orreryConfig(env)!;
const NOW = 1_800_000_000_000;
const sec = NOW / 1000;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>, o: { secret?: string; alg?: string; drop?: string[] } = {}) {
  const c: Record<string, unknown> = { iss: 'orrery', aud: 'printpro3d', sub: 'User@Example.com', iat: sec, exp: sec + 60, jti: Math.random().toString(36), ...claims };
  for (const k of o.drop ?? []) delete c[k];
  const head = b64({ alg: o.alg ?? 'HS256', typ: 'JWT' });
  const body = `${head}.${b64(c)}`;
  const sig = o.alg === 'none' ? '' : createHmac('sha256', o.secret ?? SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

test('jwt: a good token verifies and the sub is lower-cased', () => {
  assert.equal(verifyJwt(sign({}), cfg, undefined, NOW)?.sub, 'user@example.com');
});
test('jwt: wrong secret, wrong aud, wrong iss, expired, future, alg none, missing exp all fail', () => {
  assert.equal(verifyJwt(sign({}, { secret: 'other' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({ aud: 'statmesh' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({ iss: 'evil' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({ iat: sec - 200, exp: sec - 100 }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({ iat: sec + 100, exp: sec + 160 }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({}, { alg: 'none' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({}, { drop: ['exp'] }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt('a.b', cfg, undefined, NOW), null);
});
test('jwt: 30 s skew is allowed, a handoff token is not a bearer token and the reverse', () => {
  assert.ok(verifyJwt(sign({ iat: sec - 80, exp: sec - 20 }), cfg, undefined, NOW));
  assert.equal(verifyJwt(sign({ purpose: 'sso' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({}), cfg, 'sso', NOW), null);
  assert.ok(verifyJwt(sign({ purpose: 'sso' }), cfg, 'sso', NOW));
});

test('jwt: lifetime clamp (service <= 120 s, handoff <= 60 + skew) and service tokens with any purpose claim are rejected', () => {
  assert.ok(verifyJwt(sign({ exp: sec + 120 }), cfg, undefined, NOW));
  assert.equal(verifyJwt(sign({ exp: sec + 121 }), cfg, undefined, NOW), null);
  assert.ok(verifyJwt(sign({ purpose: 'sso', exp: sec + 90 }), cfg, 'sso', NOW));
  assert.equal(verifyJwt(sign({ purpose: 'sso', exp: sec + 91 }), cfg, 'sso', NOW), null);
  assert.equal(verifyJwt(sign({ purpose: 'sso' }), cfg, undefined, NOW), null);
  assert.equal(verifyJwt(sign({ purpose: 'anything' }), cfg, undefined, NOW), null);
});

test('mcp: job_status for an unknown job is a normal failed result, not isError', async () => {
  const d: Deps = { ...deps([]), status: async () => null };
  const r = await handleRpc(rpc('tools/call', { name: 'job_status', arguments: { jobId: 'nope' } }), 'u@x.io', d);
  const res = (r.body as { result: { isError?: boolean; structuredContent: unknown; content: { text: string }[] } }).result;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, { state: 'failed', error: 'Job not found' });
  assert.ok(res.content[0].text.length > 0);
});

test('bearerSub: 503 when unset, 401 without or with a bad token, sub when good', async () => {
  const req = (h?: string) => new Request('https://x.test/api/mcp', { headers: h ? { authorization: h } : {} });
  assert.equal((bearerSub(req(), {}) as Response).status, 503);
  assert.equal((bearerSub(req(), env, NOW) as Response).status, 401);
  assert.equal((bearerSub(req('Bearer nope'), env, NOW) as Response).status, 401);
  assert.deepEqual(bearerSub(req(`Bearer ${sign({})}`), env, NOW), { sub: 'user@example.com' });
});

test('handoff: single use, then rejected; bad token rejected', () => {
  const seen = new Map<string, number>();
  const t = sign({ purpose: 'sso', jti: 'abc' });
  assert.equal(acceptHandoff(t, env, NOW, seen), 'user@example.com');
  assert.equal(acceptHandoff(t, env, NOW, seen), null);
  assert.equal(acceptHandoff(sign({ purpose: 'sso', jti: 'd' }, { secret: 'x' }), env, NOW, seen), null);
  assert.equal(acceptHandoff(sign({ purpose: 'sso' }, { drop: ['jti'] }), env, NOW, seen), null);
});

test('safeNext keeps same-origin paths only', () => {
  assert.equal(safeNext('/quote?file=a.stl'), '/quote?file=a.stl');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'evil', '', null]) assert.equal(safeNext(bad), '/');
});

test('file names: stl only, no path tricks', () => {
  assert.ok(validFileName('1700000000000-3f2b1c9e-1111-4222-8333-444455556666.stl'));
  for (const bad of ['', 'a/b.stl', '../x.stl', 'a..b.stl', 'x.obj', 'a b.stl', 'x'.repeat(130) + '.stl']) assert.equal(validFileName(bad), false);
});

test('manifest: contract shape, actions permission, origin from env', () => {
  const m = manifest({ ...env, SITE_URL: 'https://p.example.com/' });
  assert.equal(m.id, 'printpro3d');
  assert.equal(m.baseUrl, 'https://p.example.com');
  assert.equal(m.mcp.url, 'https://p.example.com/api/mcp');
  assert.equal(m.auth, 'orrery-jwt');
  assert.deepEqual(m.sso, { path: '/sso' });
  assert.deepEqual(m.capabilities, ['job', 'model3d', 'link']);
  assert.deepEqual(m.deepLinks, { quote: '/quote?file={file}', home: '/' });
  assert.equal(m.permission, 'actions');
  assert.equal(orreryConfig({}), null); // unset secret: route returns 404
  assert.equal(manifest({}).baseUrl, 'https://printpro3d.vercel.app');
});

const deps = (calls: unknown[]): Deps => ({
  generate: async (a) => { calls.push(a); return { ok: true, jobId: 'job-1' }; },
  status: async () => ({ state: 'done', progress: 100, result: { orrery: 1, type: 'model3d', format: 'stl', file: 'f.stl' } }),
});
const rpc = (method: string, params?: unknown, id: unknown = 1) => ({ jsonrpc: '2.0', id, method, params });

test('mcp: tools/list annotations (generate not read-only, job_status read-only)', async () => {
  const r = await handleRpc(rpc('tools/list'), 'u@x.io', deps([]));
  const tools = (r.body as { result: { tools: typeof TOOLS } }).result.tools;
  const by = Object.fromEntries(tools.map((t) => [t.name, t.annotations.readOnlyHint]));
  assert.deepEqual(by, { generate_model: false, job_status: true });
});
test('mcp: initialize, ping, notification 202, unknown method, bad request', async () => {
  const init = await handleRpc(rpc('initialize', { protocolVersion: '2025-06-18' }), 'u', deps([]));
  assert.equal((init.body as { result: { protocolVersion: string } }).result.protocolVersion, '2025-06-18');
  assert.deepEqual((await handleRpc(rpc('ping'), 'u', deps([]))).body, { jsonrpc: '2.0', id: 1, result: {} });
  assert.deepEqual(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, 'u', deps([])), { status: 202 });
  assert.equal((await handleRpc(rpc('nope'), 'u', deps([]))).status, 200);
  assert.equal(((await handleRpc(rpc('nope'), 'u', deps([]))).body as { error: { code: number } }).error.code, -32601);
  assert.equal(((await handleRpc([], 'u', deps([]))).body as { error: { code: number } }).error.code, -32600);
});
test('mcp: generate_model passes the verified sub and returns a job; job_status returns the model3d', async () => {
  const calls: unknown[] = [];
  const g = await handleRpc(rpc('tools/call', { name: 'generate_model', arguments: { prompt: ' a vase ', style: 'low poly!' } }), 'u@x.io', deps(calls));
  assert.deepEqual(calls, [{ sub: 'u@x.io', prompt: 'a vase, low poly style' }]);
  const sc = (g.body as { result: { structuredContent: Record<string, unknown> } }).result.structuredContent;
  assert.deepEqual(sc, { orrery: 1, type: 'job', jobId: 'job-1', statusTool: 'job_status', title: 'a vase', pollMs: 3000 });
  const s = await handleRpc(rpc('tools/call', { name: 'job_status', arguments: { jobId: 'job-1' } }), 'u@x.io', deps([]));
  const res = (s.body as { result: { structuredContent: { state: string; result: { type: string } } } }).result.structuredContent;
  assert.equal(res.state, 'done');
  assert.equal(res.result.type, 'model3d');
});

test('quota is keyed by the token sub: startJob counts usage for that email, and a refused quota starts nothing', async () => {
  const taken: string[] = [];
  const wrote: unknown[] = [];
  const d = (ok: boolean) => ({
    take: async (e: string) => { taken.push(e); return ok ? { ok: true as const } : { ok: false as const, scope: 'email' as const, limit: 3 }; },
    text: async () => 'meshy-1',
    image: async () => 'meshy-2',
    write: async (j: unknown) => { wrote.push(j); },
  });
  const a = { email: 'sub@x.io', name: 'sub', phone: '', mode: 'text' as const, prompt: 'a vase' };
  const r = await startJob(a, d(true));
  assert.ok(r.ok);
  assert.deepEqual(taken, ['sub@x.io']);
  assert.equal(wrote.length, 1);
  const denied = await startJob({ ...a, email: 'other@x.io' }, d(false));
  assert.deepEqual([denied.ok, !denied.ok && denied.status], [false, 429]);
  assert.deepEqual(taken, ['sub@x.io', 'other@x.io']);
  assert.equal(wrote.length, 1);
});
