import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_FAILS, adminEmails, adminGate, aiSettingsGate, emailAllowed, tokenOk } from './adminAuth.ts';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'admin-'));
const none = async () => null;
const as = (e: string | null) => async () => e;
const req = (auth?: string, ip = '5.5.5.5') =>
  new Request('http://x/api/admin/orders', { headers: { 'x-forwarded-for': ip, ...(auth ? { authorization: auth } : {}) } });

test('tokenOk needs the Bearer scheme and the exact token', () => {
  assert.equal(tokenOk('Bearer s3cret', 's3cret'), true);
  for (const h of [null, '', 's3cret', 'Basic s3cret', 'Bearer s3cre', 'Bearer s3cret2', 'Bearer ', 'bearer s3cret']) {
    assert.equal(tokenOk(h, 's3cret'), false, String(h));
  }
});

test('ADMIN_EMAILS: lower-cased, trimmed, empties dropped', () => {
  assert.deepEqual(adminEmails({ ADMIN_EMAILS: ' Me@Gmail.com , ,b@x.io ' }), ['me@gmail.com', 'b@x.io']);
  assert.deepEqual(adminEmails({}), []);
});

test('emailAllowed: case and whitespace ignored, exact match only, unverified denied, empty list denies all', () => {
  const env = { ADMIN_EMAILS: 'Me@Gmail.com,b@x.io' };
  assert.equal(emailAllowed(' ME@gmail.COM ', true, env), true);
  assert.equal(emailAllowed('me@gmail.com', undefined, env), true);
  assert.equal(emailAllowed('me@gmail.com', false, env), false);
  for (const e of ['me@gmail.com.evil.io', 'xme@gmail.com', 'me@gmail.co', '', null, undefined]) assert.equal(emailAllowed(e, true, env), false, String(e));
  assert.equal(emailAllowed('me@gmail.com', true, {}), false);
  assert.equal(emailAllowed('me@gmail.com', true, { ADMIN_EMAILS: ' , ' }), false);
});

test('503 when neither ADMIN_EMAILS nor ADMIN_TOKEN is set', async () => {
  const off = await adminGate(req('Bearer x'), 0, {}, as('me@gmail.com'));
  assert.equal(off?.status, 503);
  assert.deepEqual(await off!.json(), { error: 'admin disabled' });
});

test('session: allowed email passes, other or missing email is 401, no delay without a bearer header', async () => {
  const env = { ADMIN_EMAILS: 'me@gmail.com' };
  assert.equal(await adminGate(req(), 0, env, as('Me@Gmail.com')), null);
  assert.equal((await adminGate(req(), 0, env, as('other@gmail.com')))?.status, 401);
  assert.equal((await adminGate(req(), 0, env, none))?.status, 401);
});

test('bearer fallback: right token passes, wrong token is 401 and delayed, works with ADMIN_EMAILS unset', async () => {
  const env = { ADMIN_TOKEN: 'tok-123' };
  assert.equal(await adminGate(req('Bearer tok-123'), 0, env, none), null);
  const t = Date.now();
  assert.equal((await adminGate(req('Bearer nope'), 80, { ...env, ADMIN_EMAILS: 'me@gmail.com' }, none))?.status, 401);
  assert.ok(Date.now() - t >= 70, 'wrong bearer is delayed');
  assert.equal((await adminGate(req(), 0, env, none))?.status, 401);
});

test('after MAX_FAILS wrong tries the IP is locked out, even with the right token', async () => {
  const env = { ADMIN_TOKEN: 'tok-123' };
  for (let i = 0; i < MAX_FAILS; i++) assert.equal((await adminGate(req('Bearer bad', '6.6.6.6'), 0, env, none))?.status, 401);
  assert.equal((await adminGate(req('Bearer tok-123', '6.6.6.6'), 0, env, none))?.status, 429);
  assert.equal(await adminGate(req('Bearer tok-123', '7.7.7.7'), 0, env, none), null); // another IP is unaffected
});

test('aiSettingsGate: open outside production, admin gate in production', async () => {
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.8'), { NODE_ENV: 'development' }, 0, none), null);
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.8'), {}, 0, none), null);
  for (const env of [{ NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    assert.equal((await aiSettingsGate(req(undefined, '8.8.8.8'), env, 0, as('me@gmail.com')))?.status, 503); // admin off in production
  }
  const prod = { NODE_ENV: 'production', ADMIN_EMAILS: 'me@gmail.com', ADMIN_TOKEN: 'tok-123' };
  assert.equal((await aiSettingsGate(req(undefined, '8.8.8.9'), prod, 0, none))?.status, 401);
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.9'), prod, 0, as('me@gmail.com')), null);
  assert.equal(await aiSettingsGate(req('Bearer tok-123', '8.8.8.9'), { VERCEL: '1', ADMIN_TOKEN: 'tok-123' }, 0, none), null);
});
