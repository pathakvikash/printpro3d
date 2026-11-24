import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ITEMS, parseItems, removeItem, saveItem, toCartLine, updateItem, type MyItem } from './myItems.ts';

const FILE = '1700000000000-12345678-1234-1234-1234-123456789abc.stl';
const item = (id = 'a', over: Partial<MyItem> = {}): MyItem => ({ id, name: 'Part', file: FILE, material: 'PLA', colour: 'red', qty: 2, notes: '', stats: null, ...over });

test('parseItems drops malformed items and caps the list', () => {
  const got = parseItems([item('a'), { ...item('b'), file: '../x.stl' }, { ...item('c'), material: 'GOLD' }, { ...item('d'), material: '__proto__' }, { ...item('e'), qty: 0 }, item('a'), null, 'x']);
  assert.deepEqual(got.map((i) => i.id), ['a']);
  assert.equal(parseItems(Array.from({ length: 50 }, (_, n) => item(String(n)))).length, MAX_ITEMS);
  assert.deepEqual(parseItems('x'), []);
  assert.equal(parseItems([{ ...item(), notes: 'n'.repeat(999) }])[0].notes.length, 300);
});

test('saveItem puts newest first, replaces same id, caps', () => {
  let l: MyItem[] = [];
  for (let n = 0; n < MAX_ITEMS + 3; n++) l = saveItem(l, item(String(n)));
  assert.equal(l.length, MAX_ITEMS);
  assert.equal(l[0].id, String(MAX_ITEMS + 2));
  assert.equal(saveItem(l, item('5', { qty: 9 })).filter((i) => i.id === '5').length, 1);
});

test('removeItem and updateItem', () => {
  const l = [item('a'), item('b')];
  assert.deepEqual(removeItem(l, 'a').map((i) => i.id), ['b']);
  assert.equal(updateItem(l, 'a', { qty: 5 })[0].qty, 5);
  assert.equal(updateItem(l, 'a', { qty: 500 }).length, 1); // an invalid edit drops the item, never keeps a bad one
});

test('toCartLine carries notes (capped, only when set)', () => {
  assert.equal((toCartLine({ ...item(), notes: 'Matte' }, null) as { notes?: string }).notes, 'Matte');
  assert.equal('notes' in toCartLine({ ...item(), notes: '' }, null), false);
});

test('toCartLine is a plain model line', () => {
  assert.deepEqual(toCartLine(item(), null), { kind: 'model', file: FILE, label: 'Part (red)', material: 'PLA', qty: 2, estimate: null });
});
