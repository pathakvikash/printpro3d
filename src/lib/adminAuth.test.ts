import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEmails, adminGate, aiSettingsGate, emailAllowed } from './adminAuth.ts';

const none = async () => null;
const as = (e: string | null) => async () => e;
const req = (auth?: string, ip = '5.5.5.5') =>
  new Request('http://x/api/admin/orders', { headers: { 'x-forwarded-for': ip, ...(auth ? { authorization: auth } : {}) } });

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

test('503 when ADMIN_EMAILS is not set, even with ADMIN_TOKEN', async () => {
  const off = await adminGate(req('Bearer x'), { ADMIN_TOKEN: 'x' }, as('me@gmail.com'));
  assert.equal(off?.status, 503);
  assert.deepEqual(await off!.json(), { error: 'admin disabled' });
});

test('session: allowed email passes, other email 403, missing 401, no delay without a bearer header', async () => {
  const env = { ADMIN_EMAILS: 'me@gmail.com' };
  assert.equal(await adminGate(req(), env, as('Me@Gmail.com')), null);
  assert.equal((await adminGate(req(), env, as('other@gmail.com')))?.status, 403);
  assert.equal((await adminGate(req(), env, none))?.status, 401);
});

test('no token route: a Bearer ADMIN_TOKEN header gets 401 without a Gmail session', async () => {
  const env = { ADMIN_EMAILS: 'me@gmail.com', ADMIN_TOKEN: 'tok-123' };
  assert.equal((await adminGate(req('Bearer tok-123'), env, none))?.status, 401);
  assert.equal((await adminGate(req('Bearer tok-123'), env, as('other@gmail.com')))?.status, 403);
  assert.equal((await aiSettingsGate(req('Bearer tok-123'), { ...env, VERCEL: '1' }, none))?.status, 401);
});

test('aiSettingsGate: open outside production, admin gate in production', async () => {
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.8'), { NODE_ENV: 'development' }, none), null);
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.8'), {}, none), null);
  for (const env of [{ NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    assert.equal((await aiSettingsGate(req(undefined, '8.8.8.8'), env, as('me@gmail.com')))?.status, 503); // admin off in production
  }
  const prod = { NODE_ENV: 'production', ADMIN_EMAILS: 'me@gmail.com' };
  assert.equal((await aiSettingsGate(req(undefined, '8.8.8.9'), prod, none))?.status, 401);
  assert.equal(await aiSettingsGate(req(undefined, '8.8.8.9'), prod, as('me@gmail.com')), null);
});

test('a signed-in non-admin gets 403 (not 401); signed out stays 401', async () => {
  const env = { ADMIN_EMAILS: 'me@gmail.com' };
  assert.equal((await adminGate(req(), env, as('customer@gmail.com')))?.status, 403);
  assert.equal((await adminGate(req(), env, none))?.status, 401);
  assert.equal((await aiSettingsGate(req(), { ...env, NODE_ENV: 'production' }, as('customer@gmail.com')))?.status, 403);
});
