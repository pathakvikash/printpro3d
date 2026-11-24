import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS_MAX, parseDesigns, removeDesign, upsertDesign } from './designList.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('parseDesigns drops junk and duplicates, migrates the old single id once', () => {
  assert.deepEqual(parseDesigns('nope'), []);
  assert.deepEqual(parseDesigns(JSON.stringify([{ id: 'x' }, { id: id(1), title: 'A', updatedAt: 't' }, { id: id(1), title: 'dup' }])), [{ id: id(1), title: 'A', updatedAt: 't' }]);
  assert.deepEqual(parseDesigns(null, id(2), 'n'), [{ id: id(2), title: '', updatedAt: 'n' }]);
  assert.equal(parseDesigns(JSON.stringify([{ id: id(2), title: 'T', updatedAt: 't' }]), id(2)).length, 1);
  assert.equal(parseDesigns(null, 'not-a-uuid').length, 0);
});

test('upsertDesign adds, updates in place at the front, keeps the old title when new is empty', () => {
  let l = upsertDesign([], id(1), 'One', 'a');
  l = upsertDesign(l, id(2), 'Two', 'b');
  assert.deepEqual(l.map((e) => e.id), [id(2), id(1)]);
  l = upsertDesign(l, id(1), '', 'c');
  assert.deepEqual(l.map((e) => e.id), [id(1), id(2)]);
  assert.equal(l[0].title, 'One');
  assert.equal(l[0].updatedAt, 'c');
});

test('upsertDesign caps the list and removeDesign drops one entry', () => {
  let l = [] as ReturnType<typeof parseDesigns>;
  for (let i = 1; i <= DESIGNS_MAX + 5; i++) l = upsertDesign(l, id(i), `d${i}`);
  assert.equal(l.length, DESIGNS_MAX);
  assert.equal(l[0].id, id(DESIGNS_MAX + 5));
  assert.equal(removeDesign(l, id(DESIGNS_MAX + 5)).length, DESIGNS_MAX - 1);
  assert.equal(removeDesign(l, id(999)).length, DESIGNS_MAX);
});
