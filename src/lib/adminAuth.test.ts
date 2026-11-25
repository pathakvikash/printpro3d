import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_FAILS, adminGate, aiSettingsGate, tokenOk } from './adminAuth.ts';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'admin-'));
const req = (auth?: string, ip = '5.5.5.5') =>
  new Request('http://x/api/admin/orders', { headers: { 'x-forwarded-for': ip, ...(auth ? { authorization: auth } : {}) } });

test('tokenOk needs the Bearer scheme and the exact token', () => {
  assert.equal(tokenOk('Bearer s3cret', 's3cret'), true);
  for (const h of [null, '', 's3cret', 'Basic s3cret', 'Bearer s3cre', 'Bearer s3cret2', 'Bearer ', 'bearer s3cret']) {
    assert.equal(tokenOk(h, 's3cret'), false, String(h));
  }
});

test('503 when ADMIN_TOKEN is unset, 401 on a wrong token, null on the right one', async () => {
  delete process.env.ADMIN_TOKEN;
  const off = await adminGate(req('Bearer x'), 0);
  assert.equal(off?.status, 503);
  assert.deepEqual(await off!.json(), { error: 'admin disabled' });
  process.env.ADMIN_TOKEN = 'tok-123';
  try {
    assert.equal((await adminGate(req(), 0))?.status, 401);
    assert.equal((await adminGate(req('Bearer nope'), 0))?.status, 401);
    assert.equal(await adminGate(req('Bearer tok-123'), 0), null);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});

test('after MAX_FAILS wrong tries the IP is locked out, even with the right token', async () => {
  process.env.ADMIN_TOKEN = 'tok-123';
  try {
    for (let i = 0; i < MAX_FAILS; i++) assert.equal((await adminGate(req('Bearer bad', '6.6.6.6'), 0))?.status, 401);
    assert.equal((await adminGate(req('Bearer tok-123', '6.6.6.6'), 0))?.status, 429);
    assert.equal(await adminGate(req('Bearer tok-123', '7.7.7.7'), 0), null); // another IP is unaffected
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});

test('aiSettingsGate: open without a token outside production, admin token in production', async () => {
  delete process.env.ADMIN_TOKEN;
  assert.equal(await aiSettingsGate(req(undefined, '6.6.6.6'), { NODE_ENV: 'development' }, 0), null);
  assert.equal(await aiSettingsGate(req(undefined, '6.6.6.6'), {}, 0), null);
  for (const env of [{ NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    assert.equal((await aiSettingsGate(req(undefined, '6.6.6.6'), env, 0))?.status, 503); // no ADMIN_TOKEN: closed
  }
  process.env.ADMIN_TOKEN = 'tok-123';
  try {
    const prod = { NODE_ENV: 'production' };
    assert.equal((await aiSettingsGate(req(undefined, '6.6.6.7'), prod, 0))?.status, 401);
    assert.equal((await aiSettingsGate(req('Bearer nope', '6.6.6.7'), { VERCEL: '1' }, 0))?.status, 401);
    assert.equal(await aiSettingsGate(req('Bearer tok-123', '6.6.6.7'), prod, 0), null);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});
