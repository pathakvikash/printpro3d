import test from 'node:test';
import assert from 'node:assert/strict';
import { addLine, cartTotal, lineKey, lineTotal, parseCart, parseSaved, removeLine, setQty, toggleSaved, MAX_LINES, type CartLine } from './cart.ts';
import { CATALOG } from './catalog.ts';
import { MAX_QTY } from './quote.ts';

const shop = (qty = 1): CartLine => ({ kind: 'shop', id: CATALOG[0].id, qty });
const model = (qty = 1, estimate: number | null = 120): CartLine => ({ kind: 'model', file: 'a.stl', label: 'Part', material: 'PLA', qty, estimate });

test('parseCart keeps only well-formed lines', () => {
  const lines = parseCart([
    shop(2),
    { kind: 'shop', id: 'nope', qty: 1 }, // unknown catalogue id
    { kind: 'shop', id: CATALOG[0].id, qty: 0 },
    { kind: 'shop', id: CATALOG[0].id, qty: 2.5 },
    { kind: 'shop', id: CATALOG[0].id, qty: MAX_QTY + 1 },
    { kind: 'model', file: '', material: 'PLA', qty: 1 },
    { kind: 'model', file: 'b.stl', material: 'PLA', qty: 1, estimate: -5 },
    { kind: 'model', file: 'c.stl', material: 'PLA', qty: 3, estimate: 50, label: 'x'.repeat(500), notes: 'n'.repeat(500) },
    null,
    'text',
    { kind: '__proto__', qty: 1 },
  ]);
  assert.equal(lines.length, 3);
  assert.equal(lines[1].kind === 'model' && lines[1].estimate, null); // negative estimate dropped
  assert.equal(lines[2].kind === 'model' && lines[2].label.length, 80);
  assert.equal(lines[2].kind === 'model' && lines[2].notes?.length, 300);
  assert.deepEqual(parseCart('x'), []);
  assert.equal(parseCart(Array.from({ length: 100 }, () => shop())).length, MAX_LINES);
});

test('addLine merges identical lines and caps quantity', () => {
  let l = addLine([], shop(2));
  l = addLine(l, shop(3));
  assert.equal(l.length, 1);
  assert.equal(l[0].qty, 5);
  l = addLine(l, shop(MAX_QTY));
  assert.equal(l[0].qty, MAX_QTY);
  l = addLine(l, model(1, 120));
  l = addLine(l, model(1, 120));
  assert.equal(l.length, 2);
  const m = l[1];
  assert.equal(m.kind === 'model' && m.estimate, null); // merged model quantity is re-quoted by us
});

test('total counts priced lines and flags unpriced ones', () => {
  const price = CATALOG[0].price;
  assert.deepEqual(cartTotal([shop(2), model(1, 120), model(1, null)].map((x, i) => (i === 2 ? { ...x, file: 'z.stl' } as CartLine : x))), { total: price * 2 + 120, unpriced: 1 });
  assert.deepEqual(cartTotal([]), { total: 0, unpriced: 0 });
});

test('setQty and removeLine', () => {
  const l = [shop(1), model(1)];
  assert.equal(setQty(l, lineKey(l[0]), 7)[0].qty, 7);
  assert.equal(setQty(l, lineKey(l[0]), 0)[0].qty, 1); // invalid qty ignored
  assert.equal(removeLine(l, lineKey(l[0])).length, 1);
});

test('setQty on a model line re-opens its quote; same qty keeps it; shop lines keep their price', () => {
  const priced = [model(1, 250)];
  const changed = setQty(priced, lineKey(model()), 10);
  assert.equal(changed[0].kind === 'model' && changed[0].estimate, null);
  assert.equal(changed[0].qty, 10);
  assert.deepEqual(cartTotal(changed), { total: 0, unpriced: 1 });
  const same = setQty(priced, lineKey(model()), 1)[0];
  assert.equal(same.kind === 'model' && same.estimate, 250);
  const shops = setQty([shop(1)], lineKey(shop()), 4);
  assert.equal(shops[0].qty, 4);
  assert.equal(cartTotal(shops).unpriced, 0);
});

test('saved list', () => {
  assert.deepEqual(parseSaved(['shop:pi-case', 'shop:pi-case', 'example:pawn', 'bad', 'shop:../x', 3]), ['shop:pi-case', 'example:pawn']);
  assert.deepEqual(toggleSaved(['shop:a'], 'shop:a'), []);
  assert.deepEqual(toggleSaved([], 'example:pawn'), ['example:pawn']);
});

test('design lines: parsed, keyed by project and material, estimate dropped when the quantity changes', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const [l] = parseCart([{ kind: 'design', project: id.toUpperCase(), material: 'PLA', qty: 2, estimate: 120, label: 'My bracket' }, { kind: 'design', project: 'nope', material: 'PLA', qty: 1 }]);
  assert.equal(parseCart([{ kind: 'design', project: 'nope', material: 'PLA', qty: 1 }]).length, 0);
  assert.equal(l.kind, 'design');
  assert.equal(lineKey(l), `design:${id}:PLA`);
  assert.equal(lineTotal(l), 120);
  assert.equal(lineTotal(setQty([l], lineKey(l), 3)[0]), null);
});
