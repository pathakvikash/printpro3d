import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clientIp, filled, hit, limited, seen } from './spam.ts';
import { list } from './store.ts';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'spam-'));
const req = (xff?: string) => new Request('http://x/api', { method: 'POST', headers: xff ? { 'x-forwarded-for': xff } : {} });

test('honeypot: only a non-blank string counts as filled', () => {
  assert.equal(filled('http://spam.example'), true);
  for (const v of ['', '   ', undefined, null, 0, {}]) assert.equal(filled(v), false);
});

test('client ip is the first x-forwarded-for hop; junk becomes unknown', () => {
  assert.equal(clientIp(req('203.0.113.9, 10.0.0.1')), '203.0.113.9');
  assert.equal(clientIp(req('2001:db8::1')), '2001:db8::1');
  assert.equal(clientIp(req()), 'unknown');
  assert.equal(clientIp(req('__proto__')), 'unknown');
});

test('limit per IP per hour: the 11th is refused, other IPs and the next hour are unaffected', async () => {
  const t = new Date('2026-11-20T10:30:00Z');
  const results = await Promise.all(Array.from({ length: 12 }, () => hit('submit', '1.1.1.1', 10, t)));
  assert.equal(results.filter(Boolean).length, 10); // concurrent calls are counted one at a time
  assert.equal(await seen('submit', '1.1.1.1', t), 10);
  assert.equal(await hit('submit', '2.2.2.2', 10, t), true);
  assert.equal(await hit('upload', '1.1.1.1', 10, t), true); // buckets are separate
  assert.equal(await hit('submit', '1.1.1.1', 10, new Date('2026-11-20T11:00:00Z')), true); // new hour
  assert.equal(await seen('submit', '1.1.1.1', t), 10);
});

test('old windows are removed', async () => {
  await hit('gc', '3.3.3.3', 5, new Date('2026-11-20T01:00:00Z'));
  await hit('gc', '3.3.3.3', 5, new Date('2026-11-20T03:00:00Z'));
  const gc = (await list('ratelimit')).filter((k) => k.startsWith('gc-'));
  assert.equal(gc.length, 1);
});

test('limited() returns a 429 JSON response once over the limit', async () => {
  const r = () => limited(req('9.9.9.9'), 'submit');
  for (let i = 0; i < 10; i++) assert.equal(await r(), null);
  const over = await r();
  assert.equal(over?.status, 429);
  assert.match((await over!.json()).error, /Too many requests/);
});
