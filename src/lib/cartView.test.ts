import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLines, lineName, lineSettings } from './cartView.ts';
import type { CartLine } from './cart.ts';
import { TEMPLATES, defaultCfg } from './templateDefs.ts';

const kit = (id: string, label: string, note?: string): CartLine => ({ kind: 'kit', id, label, ...(note ? { note } : {}), cfg: {}, qty: 1, unitPrice: 10 });

test('kit lines group under their kit, in order of first appearance', () => {
  const lines: CartLine[] = [kit('rover-kit:wheel', 'Rover build kit (4WD) · Wheel'), { kind: 'shop', id: 'pawn', qty: 1 }, kit('rover-kit:tray', 'Rover build kit (4WD) · Tray', 'Large')];
  const s = groupLines(lines);
  assert.equal(s.length, 2);
  assert.equal(s[0].kind, 'kit');
  assert.deepEqual(s[0].kind === 'kit' && s[0].lines.map(lineName), ['Wheel', 'Tray']);
  assert.equal(s[0].kind === 'kit' && s[0].title, 'Rover build kit (4WD)');
  assert.deepEqual(lineSettings(lines[2]), ['Large']);
});

test('template settings read as labels', () => {
  const t = TEMPLATES[0];
  const out = lineSettings({ kind: 'tpl', id: t.id, cfg: defaultCfg(t), qty: 1, unitPrice: 1 });
  assert.equal(out.length, t.fields.length);
  assert.match(out[0], new RegExp(`^${t.fields[0].label}: `));
});
