import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createImageTask, createTextTask, downloadAllowed, downloadTo, getTask, MeshyError, repairForPrint } from './meshy.ts';

type Seen = { method: string; url: string; auth?: string; body: Record<string, unknown> | null };
const KEY = 'msy_test_secret_key';

async function stub() {
  const seen: Seen[] = [];
  const polls: Record<string, number> = {};
  let base = '';
  const json = (res: http.ServerResponse, status: number, o: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
      const u = req.url!;
      if (req.method === 'POST' && u === '/openapi/v2/text-to-3d') {
        if (JSON.parse(raw).prompt === 'poor') return json(res, 402, { message: `no credits for ${KEY}`.replace(KEY, '***') });
        return json(res, 202, { result: 'txt1' });
      }
      if (req.method === 'POST' && u === '/openapi/v1/image-to-3d') return json(res, 202, { result: 'img1' });
      if (req.method === 'POST' && u === '/openapi/v1/print/repair') return json(res, 202, { result: 'rep1' });
      if (req.method === 'GET' && u === '/files/m.stl') { res.writeHead(200, { 'Content-Length': 6 }); return res.end('abcdef'); }
      if (req.method === 'GET' && u === '/files/redirect') { res.writeHead(302, { Location: '/files/m.stl' }); return res.end(); }
      const m = /^\/openapi\/(?:v2\/text-to-3d|v1\/image-to-3d|v1\/print\/repair)\/(\w+)$/.exec(u);
      if (req.method === 'GET' && m) {
        const id = m[1];
        polls[id] = (polls[id] ?? 0) + 1;
        if (id === 'bad') return json(res, 200, { status: 'FAILED', progress: 0, task_error: { type: 'invalid_input', message: 'Image rejected' }, model_urls: {} });
        if (polls[id] === 1) return json(res, 200, { status: 'PENDING', progress: 0, model_urls: {} });
        if (polls[id] === 2) return json(res, 200, { status: 'IN_PROGRESS', progress: 42, model_urls: {} });
        return json(res, 200, { status: 'SUCCEEDED', progress: 100, model_urls: { stl: `${base}/files/m.stl`, glb: 'x' } });
      }
      json(res, 404, { message: 'Task not found' });
    });
  });
  await new Promise<void>((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { seen, base, close: () => server.close() };
}

test('meshy client against a local stub', async (t) => {
  let s: Awaited<ReturnType<typeof stub>>;
  try {
    s = await stub();
  } catch (e) {
    t.skip(`cannot bind a local port in this sandbox (${(e as Error).message}); client not exercised`);
    return;
  }
  process.env.MESHY_API_KEY = KEY;
  process.env.MESHY_BASE_URL = s.base;
  try {
    // text: path, auth, mesh-only STL + moderation
    assert.equal(await createTextTask('a small dragon'), 'txt1');
    let r = s.seen.at(-1)!;
    assert.equal(r.method, 'POST');
    assert.equal(r.url, '/openapi/v2/text-to-3d');
    assert.equal(r.auth, `Bearer ${KEY}`);
    assert.deepEqual(r.body, { mode: 'preview', prompt: 'a small dragon', target_formats: ['stl'], moderation: true });

    // pending -> in progress -> succeeded
    assert.deepEqual(await getTask('text', 'txt1'), { state: 'pending', progress: 0, stlUrl: null, error: null });
    assert.equal((await getTask('text', 'txt1')).progress, 42);
    const done = await getTask('text', 'txt1');
    assert.equal(done.state, 'succeeded');
    assert.equal(done.stlUrl, `${s.base}/files/m.stl`);
    assert.equal(s.seen.at(-1)!.url, '/openapi/v2/text-to-3d/txt1');

    // image: data URI, untextured
    assert.equal(await createImageTask('data:image/png;base64,AAAA'), 'img1');
    r = s.seen.at(-1)!;
    assert.equal(r.url, '/openapi/v1/image-to-3d');
    assert.deepEqual(r.body, { image_url: 'data:image/png;base64,AAAA', should_texture: false, target_formats: ['stl'], moderation: true });

    // failure response
    const bad = await getTask('image', 'bad');
    assert.equal(bad.state, 'failed');
    assert.equal(bad.error, 'Image rejected');
    assert.equal(s.seen.at(-1)!.url, '/openapi/v1/image-to-3d/bad');

    // non-2xx throws a short message that never holds the key
    await assert.rejects(createTextTask('poor'), (e: Error & { status?: number }) => {
      assert.equal(e.status, 402);
      assert.match(e.message, /^Meshy 402/);
      assert.ok(!e.message.includes(KEY));
      return true;
    });

    // repair: size goes in as intended_print_longest_side_mm, waits for success
    const url = await repairForPrint(`${s.base}/files/in.stl`, 80.4, { pollMs: 5 });
    assert.equal(url, `${s.base}/files/m.stl`);
    const post = s.seen.find((x) => x.url === '/openapi/v1/print/repair')!;
    assert.deepEqual(post.body, { model_url: `${s.base}/files/in.stl`, printer_type: 'fdm', intended_print_longest_side_mm: 80 });
    assert.ok(s.seen.some((x) => x.url === '/openapi/v1/print/repair/rep1'));

    // download: streams to disk, never sends the key, enforces the cap
    const dir = mkdtempSync(path.join(tmpdir(), 'meshy-'));
    assert.equal(await downloadTo(`${s.base}/files/m.stl`, path.join(dir, 'a.stl')), 6);
    assert.equal(readFileSync(path.join(dir, 'a.stl'), 'utf8'), 'abcdef');
    assert.equal(s.seen.filter((x) => x.url === '/files/m.stl').every((x) => x.auth === undefined), true);
    await assert.rejects(downloadTo(`${s.base}/files/m.stl`, path.join(dir, 'b.stl'), 3), /too large/);
    // redirects are not followed, even to the same file
    await assert.rejects(downloadTo(`${s.base}/files/redirect`, path.join(dir, 'c.stl')));

    // no key: refuses before any request
    delete process.env.MESHY_API_KEY;
    const n = s.seen.length;
    await assert.rejects(createTextTask('x'), /not configured/);
    assert.equal(s.seen.length, n);
  } finally {
    s.close();
    delete process.env.MESHY_BASE_URL;
    delete process.env.MESHY_API_KEY;
  }
});

test('download allow-list: Meshy https hosts and the configured origin only', () => {
  const base = 'https://api.meshy.ai';
  for (const ok of ['https://assets.meshy.ai/a.stl', 'https://meshy.ai/a.stl', 'https://api.meshy.ai/x.stl']) {
    assert.equal(downloadAllowed(ok, base), true, ok);
  }
  for (const bad of [
    'http://assets.meshy.ai/a.stl', // plain http to a Meshy host
    'https://evil.example/a.stl',
    'https://meshy.ai.evil.example/a.stl',
    'https://evilmeshy.ai/a.stl',
    'file:///etc/passwd',
    'not a url',
  ]) {
    assert.equal(downloadAllowed(bad, base), false, bad);
  }
  // the configured origin itself (the test stub) is allowed, even over http
  assert.equal(downloadAllowed('http://127.0.0.1:4010/files/m.stl', 'http://127.0.0.1:4010'), true);
  assert.equal(downloadAllowed('http://127.0.0.1:4011/files/m.stl', 'http://127.0.0.1:4010'), false);
});

test('downloadTo refuses bad hosts before making any request', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
    calls++;
    return realFetch(...a);
  }) as typeof fetch;
  const dir = mkdtempSync(path.join(tmpdir(), 'meshy-deny-'));
  try {
    for (const url of ['http://assets.meshy.ai/a.stl', 'https://evil.example/a.stl']) {
      await assert.rejects(downloadTo(url, path.join(dir, 'x.stl')), (e: unknown) => e instanceof MeshyError && e.status === 400);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
