import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'acct-'));
const { indexAdd, listMine, ownerFields } = await import('./account.ts');
const { putJson, getJson } = await import('./store.ts');

const A = { sub: '111', email: 'a@gmail.com', name: 'A' };
const B = { sub: '222', email: 'b@gmail.com', name: 'B' };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rec = (n: number, extra: Record<string, unknown>) => ({ id: id(n), createdAt: `2026-01-0${n}T00:00:00Z`, status: 'pending_review', lines: [{}], total: 100, currency: 'INR', ...extra });

test('ownerFields: sub and email from the session only, nothing when signed out', () => {
  assert.deepEqual(ownerFields(A), { userSub: '111', userEmail: 'a@gmail.com' });
  assert.deepEqual(ownerFields(null), {});
});

test('routes attach the session user, not body fields', () => {
  for (const f of ['orders', 'requests']) {
    const src = readFileSync(new URL(`../app/api/${f}/route.ts`, import.meta.url), 'utf8');
    assert.match(src, /sessionUser\(\)/);
    assert.match(src, /\.\.\.ownerFields\(user\)/);
    assert.doesNotMatch(src, /body\.userSub|get\('userSub'\)|\.\.\.body\b/);
  }
});

test('session id is Google\'s stable account id, not Auth.js\'s per-login random UUID', () => {
  const src = readFileSync(new URL('../auth.ts', import.meta.url), 'utf8');
  assert.match(src, /token\.sub = account\.providerAccountId/);
});

test('indexAdd appends to the per-user index; signed out writes nothing', async () => {
  await indexAdd(A, { type: 'order', id: id(1), createdAt: 'x' });
  await indexAdd(A, { type: 'request', id: id(2), createdAt: 'y' });
  await indexAdd(null, { type: 'order', id: id(9), createdAt: 'z' });
  assert.deepEqual((await getJson<{ id: string }[]>('user-orders', '111.json'))!.map((e) => e.id), [id(1), id(2)]);
  assert.equal(await getJson('user-orders', 'null.json'), null);
});

test('listMine: own records by sub or by verified email, newest first, never another user\'s', async () => {
  await putJson('orders', `${id(1)}.json`, rec(1, { userSub: '111', email: 'whatever@x.io' })); // A by sub
  await putJson('requests', `${id(2)}.json`, rec(2, { userSub: '111', category: 'toy' })); // A by sub, indexed
  await putJson('orders', `${id(3)}.json`, rec(3, { email: ' A@Gmail.com ' })); // A by email only
  await putJson('orders', `${id(4)}.json`, rec(4, { userSub: '222', email: 'b@gmail.com' })); // B
  await putJson('orders', `${id(5)}.json`, rec(5, { email: 'c@gmail.com' })); // guest
  const a = await listMine(A);
  assert.deepEqual(a.map((r) => r.id), [id(3), id(2), id(1)]);
  assert.deepEqual((await listMine(B)).map((r) => r.id), [id(4)]);
  // a forged index entry pointing at someone else's order is ignored
  await indexAdd(B, { type: 'order', id: id(5), createdAt: 'x' });
  await indexAdd(B, { type: 'order', id: id(1), createdAt: 'x' });
  assert.deepEqual((await listMine(B)).map((r) => r.id), [id(4)]);
});

test('a typed contact email cannot push a new anonymous order into someone else\'s list', async () => {
  const spoof = { id: '00000000-0000-4000-8000-000000000077', createdAt: '2026-12-01T00:00:00Z', status: 'pending_review', lines: [{}], total: 1, currency: 'INR', email: 'b@gmail.com' };
  await putJson('orders', `${spoof.id}.json`, spoof);
  assert.ok(!(await listMine(B)).some((r) => r.id === spoof.id));
  const signedIn = { ...spoof, id: '00000000-0000-4000-8000-000000000078', userSub: '222', userEmail: 'b@gmail.com' };
  await putJson('orders', `${signedIn.id}.json`, signedIn);
  assert.ok((await listMine(B)).some((r) => r.id === signedIn.id));
});
