// Part price cache, time budget and review status of the order pricing (orderPricing.ts): a part we cannot price is accepted for review, never priced from the client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkEntry } from './orderChecks.ts';
import { clearPriceCache, newBudget, partStats, priceKit, priceTpl } from './orderPricing.ts';
import { quote } from './quote.ts';
import { notifyNewOrder } from './notify.ts';
import { templateById } from './templateDefs.ts';

const setup = () => { process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'price-budget-')); clearPriceCache(); };
const spent = () => ({ deadline: Date.now() - 1, longest: 0 }); // budget already used up
const entry = (id: string, cfg: unknown) => { const e = checkEntry({ kind: 'kit', id, cfg, qty: 2, total: 1, unitPrice: 0.01, price: 1 }, 1); if (e.kind !== 'kit') throw new Error('kind'); return e; };

test('cache hit: a part priced once is instant afterwards, from memory and from the store, even with no budget left', async () => {
  setup();
  const e = entry('rc-car:gear', {}); // STL kit part: cheap to build
  const first = await priceKit(e.id, e.cfg, 2, newBudget());
  assert.equal(first.priceStatus, undefined);
  assert.ok(first.total! > 0);
  const mem = await priceKit(e.id, e.cfg, 2, spent());
  assert.deepEqual(mem, first);
  clearPriceCache(); // a new invocation: only the store remains
  const stored = await priceKit(e.id, e.cfg, 2, spent());
  assert.deepEqual(stored, first);
  assert.equal(stored.total, quote(first.stats!, first.material, 2).total); // price is recomputed from the stored volume for this qty
  assert.equal((await priceKit(e.id, e.cfg, 5, spent())).total, quote(first.stats!, first.material, 5).total); // other qty, same cached part
});

test('budget exceeded: the part is accepted with priceStatus review, no price, nothing cached', async () => {
  setup();
  const e = entry('rc-car:gear', {});
  const line = await priceKit(e.id, e.cfg, e.qty, spent());
  assert.equal(line.priceStatus, 'review');
  assert.equal(line.total, null);
  assert.equal(line.quote, null);
  assert.equal(line.stats, null);
  assert.match(line.reviewReason!, /in time/);
  assert.equal(line.kind, 'kit');
  assert.equal(line.qty, 2);
  const ok = await priceKit(e.id, e.cfg, e.qty, newBudget()); // it was not cached as a failure: a fresh budget prices it
  assert.equal(ok.priceStatus, undefined);
  // a long build leaves less time than it needs: the next miss is refused too
  const b = { deadline: Date.now() + 5, longest: 60_000 };
  const t = templateById('spacer-set')!;
  assert.equal((await priceTpl(t, { ...Object.fromEntries(t.fields.map((f) => [f.key, f.default])) }, 1, b)).priceStatus, 'review');
});

test('build failure (kernel throws, or no closed mesh): a review result, not a rejected order, and not cached', async () => {
  setup();
  const cfg = { a: 1 };
  assert.deepEqual(await partStats('x:y', cfg, () => { throw new Error('csg exploded'); }), { review: 'build failed' });
  assert.deepEqual(await partStats('x:y', cfg, () => null, newBudget()), { review: 'build failed' });
  const stats = { volumeCm3: 3, sizeMm: { x: 10, y: 10, z: 10 } };
  assert.deepEqual(await partStats('x:y', cfg, () => stats), { stats }); // the flaky kernel succeeds next time: the failure was remembered nowhere
  clearPriceCache();
  assert.deepEqual(await partStats('x:y', cfg, () => { throw new Error('now it would fail'); }), { stats }); // persisted success wins
});

test('the client price is never used: forged totals do not reach the line, review lines have no total', async () => {
  setup();
  const e = entry('rc-car:gear', {});
  assert.deepEqual(Object.keys(e).sort(), ['cfg', 'id', 'kind', 'n', 'qty']);
  const review = await priceKit(e.id, e.cfg, e.qty, spent());
  assert.equal(review.total, null);
  assert.equal(JSON.stringify(review).includes('"total":1'), false);
  const good = await priceKit(e.id, e.cfg, e.qty);
  assert.equal(good.total, quote(good.stats!, good.material, e.qty).total);
  assert.notEqual(good.total, 1);
});

test('the owner email names the lines that need manual pricing and marks the total provisional', async () => {
  setup();
  const e = entry('rc-car:gear', {});
  const line = await priceKit(e.id, e.cfg, e.qty, spent());
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = 're_test'; process.env.ORDER_NOTIFY_TO = 'o@example.com';
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { sent.push(String(init?.body)); return new Response('{}', { status: 200 }); }) as typeof fetch;
  try {
    await notifyNewOrder({ id: 'x', status: 'needs_manual_quote', lines: [line], name: 'A', email: 'a@example.com', phone: '1', address: 'b', notes: '', total: null, unpricedCount: 1, provisional: true, currency: 'INR' });
  } finally { globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY; delete process.env.ORDER_NOTIFY_TO; }
  const body = sent.join('\n');
  assert.match(body, /NEEDS MANUAL PRICING/);
  assert.match(body, /PROVISIONAL/);
});

test('a build the CSG kernel never finishes is cut off at the deadline (worker terminated): review line, and the next build still works', async () => {
  setup();
  // transformer-kit:arm with clearance 0.25 and magnets off does not return (measured: minutes); the order must still be answered
  const cfg = checkEntry({ kind: 'kit', id: 'transformer-kit:arm', cfg: { clearance: 0.25, magnets: false }, qty: 1 }, 1);
  if (cfg.kind !== 'kit') throw new Error('kind');
  const t = Date.now();
  const line = await priceKit(cfg.id, cfg.cfg, 1, { deadline: Date.now() + 4000, longest: 0 });
  assert.equal(line.priceStatus, 'review');
  assert.equal(line.reviewReason, 'not priced in time');
  assert.ok(Date.now() - t < 15_000, `answered in ${Date.now() - t} ms`);
  const next = await priceKit('transformer-kit:head', { clearance: 0.35, magnets: true }, 1, newBudget()); // a fresh worker takes over
  assert.equal(next.priceStatus, undefined);
  assert.ok(next.total! > 0);
});
