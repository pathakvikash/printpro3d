import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NOTE_MAX, csvCell, filterRecs, noteError, toCsv, type ListRec } from './adminList.ts';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'alist-'));
const { putJson } = await import('./store.ts');
const { setNote } = await import('./trackingStore.ts');


test('note validation', () => {
  assert.equal(noteError(''), null);
  assert.equal(noteError('x'.repeat(NOTE_MAX)), null);
  assert.ok(noteError('x'.repeat(NOTE_MAX + 1)));
  assert.ok(noteError(5));
  assert.ok(noteError(null));
});

test('csv escaping and formula guard', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"\nnow'), '"say ""hi""\nnow"');
  for (const s of ['=1+1', '+9', '-2', '@SUM(A1)']) assert.equal(csvCell(s), `'${s}`);
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(12.5), '12.5');
  const r: ListRec = { type: 'order', id: 'i', createdAt: 't', status: 's', total: 10, contact: { name: '=cmd', email: '', phone: '+91 99', address: '' }, items: [{ name: 'a' }, { name: 'b' }], pin: '800001' };
  assert.equal(toCsv([r]).split('\r\n')[1], "i,order,t,s,'=cmd,'+91 99,,800001,10,2");
});

test('filter and search', () => {
  const mk = (id: string, type: 'order' | 'request', status: string, name: string, pin = ''): ListRec => ({ type, id, createdAt: '', status, total: null, contact: { name, email: '', phone: '', address: '' }, items: [{ name: 'Gear' }], pin });
  const rows = [mk('a1', 'order', 'paid', 'Ann', '800001'), mk('b2', 'request', 'new', 'Bo')];
  assert.equal(filterRecs(rows, { type: 'request' }).length, 1);
  assert.equal(filterRecs(rows, { status: 'paid' })[0].id, 'a1');
  assert.equal(filterRecs(rows, { q: '800001' }).length, 1);
  assert.equal(filterRecs(rows, { q: 'GEAR' }).length, 2);
});

test('setNote saves on the record and /track never returns it', async () => {
  const id = '11111111-2222-4333-8444-555555555566';
  await putJson('orders', `${id}.json`, { id, status: 'paid', name: 'Ann', phone: '999', total: 5, lines: [{ kind: 'shop', itemName: 'Gear', qty: 1 }] });
  assert.equal((await setNote(id, 'x'.repeat(NOTE_MAX + 1), 'order')).ok, false);
  assert.equal((await setNote('bad', 'hi')).ok, false);
  const r = await setNote(id, 'call after 6pm', 'order');
  assert.equal(r.ok, true);
  // the route cannot be imported under node:test (next/server), so check its source: explicit field whitelist, no record spread, no note
  const src = readFileSync(new URL('../app/api/track/[id]/route.ts', import.meta.url), 'utf8');
  assert.ok(!/note/i.test(src) && !/\.\.\.r\b/.test(src));
});
