import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setStatus } from './trackingStore.ts';
import { getJson, putJson } from './store.ts';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'tstore-'));
const ORDER = '11111111-2222-4333-8444-555555555555';
const REQ = '66666666-2222-4333-8444-555555555555';

test('setStatus updates the record, emails the customer once, validates input', async () => {
  await putJson('orders', `${ORDER}.json`, { id: ORDER, status: 'pending_review', name: 'Ann', email: 'ann@example.com', total: 5 });
  await putJson('requests', `${REQ}.json`, { id: REQ, status: 'new', name: 'Bo', email: '' });
  process.env.RESEND_API_KEY = 're_test_key';
  const sent: { to: string; subject: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    const r = await setStatus(ORDER.toUpperCase(), 'printing');
    assert.deepEqual(r, { ok: true, type: 'order', id: ORDER, from: 'pending_review', to: 'printing', emailed: true });
    assert.equal((await getJson<{ status: string; total: number }>('orders', `${ORDER}.json`))?.status, 'printing');
    assert.equal((await getJson<{ total: number }>('orders', `${ORDER}.json`))?.total, 5); // other fields kept
    assert.deepEqual(sent.map((s) => [s.to, s.subject]), [['ann@example.com', 'Your order: Printing']]);

    assert.equal((await setStatus(ORDER, 'printing') as { emailed: boolean }).emailed, false); // same status: no second email
    assert.equal(sent.length, 1);

    const q = await setStatus(REQ, 'designing', 'request'); // no customer email: saved, not emailed
    assert.equal(q.ok && q.emailed, false);
    assert.equal((await getJson<{ status: string }>('requests', `${REQ}.json`))?.status, 'designing');

    for (const [id, status, type, code] of [
      ['nope', 'paid', undefined, 'bad_id'],
      [ORDER, 'bogus', undefined, 'unknown_status'],
      [ORDER, 'designing', undefined, 'wrong_type'], // a request status on an order
      [REQ, 'paid', 'request', 'wrong_type'],
      ['99999999-2222-4333-8444-555555555555', 'paid', undefined, 'not_found'],
      [REQ, 'paid', 'order', 'not_found'], // the id exists, but as a request
    ] as const) {
      const bad = await setStatus(id, status, type);
      assert.equal(bad.ok, false, `${id} ${status}`);
      if (!bad.ok) assert.equal(bad.code, code, `${id} ${status}`);
    }
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  }
});

test('without RESEND_API_KEY the status is saved and no email is attempted', async () => {
  await putJson('orders', `${ORDER}.json`, { id: ORDER, status: 'paid', email: 'ann@example.com' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('must not be called'); }) as typeof fetch;
  try {
    const r = await setStatus(ORDER, 'shipped');
    assert.equal(r.ok && r.emailed, false);
    assert.equal((await getJson<{ status: string }>('orders', `${ORDER}.json`))?.status, 'shipped');
  } finally {
    globalThis.fetch = realFetch;
  }
});
