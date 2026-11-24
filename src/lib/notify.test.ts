import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusEmail, notifyNewOrder, type OrderNotice } from './notify.ts';

test('owner email: piece count in the subject, customer address and notes indented', async () => {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ORDER_NOTIFY_TO = 'owner@example.com';
  const sent: { subject: string; text: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  const order: OrderNotice = {
    id: 'o-1',
    status: 'needs_manual_quote',
    lines: [
      { kind: 'shop', qty: 2, material: 'PLA', total: 10, id: 'box', itemName: 'Box' },
      { kind: 'model', qty: 3, material: 'PLA', total: null, file: 'a.stl', notes: 'Matte\nfinish' },
    ],
    name: 'Ann',
    email: 'ann@example.com',
    phone: '0100',
    address: '1 Road\nEmail: fake@evil.example',
    notes: 'Please\nPhone: 999',
    total: 10,
    unpricedCount: 1,
    currency: 'GBP',
  };
  try {
    assert.equal(await notifyNewOrder(order), true);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.ORDER_NOTIFY_TO;
  }
  assert.equal(sent[0].subject, 'New order: Ann — GBP 10 — 5 piece(s)');
  assert.ok(sent[0].text.includes('\nAddress: 1 Road\n    Email: fake@evil.example\n'), sent[0].text);
  assert.ok(sent[0].text.includes('\nNotes: Please\n    Phone: 999'), sent[0].text);
  assert.ok(!sent[0].text.includes('\nEmail: fake@evil.example'));
  assert.ok(sent[0].text.includes('Customer notes: Matte finish'), sent[0].text);
});

test('status email: stage name, sentence and a track link from SITE_URL', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const m = buildStatusEmail('order', id, 'printing', { name: 'Ann\nBob', siteUrl: 'https://shop.example/' });
  assert.equal(m.subject, 'Your order: Printing');
  assert.equal(
    m.text,
    ['Hello Ann Bob,', '', `Update on your order ${id}`, 'Stage: Printing', 'Your order is being printed.', '', `Track it: https://shop.example/track?id=${id}`].join('\n'),
  );
  const r = buildStatusEmail('request', id, 'quote_sent');
  assert.equal(r.subject, 'Your design request: Quote sent');
  assert.ok(r.text.startsWith('Hello,\n'));
  assert.ok(r.text.endsWith(`Track it on our website with this id: ${id}`)); // no SITE_URL: no link
  assert.equal(buildStatusEmail('order', id, 'cancelled').subject, 'Your order: Cancelled');
});
