import test from 'node:test';
import assert from 'node:assert/strict';
import { aiUsage, canPlaceOrder, canUndo, defaultStep, diffRows, mapError, noteItems, parseStoredId, partRows, prefillPrompt, previousRevision, revisionRows, settleStep, stepAllowed, stepViews, PROMPT_MAX, reassign, type ProjectView } from './buildFlow.ts';
import { diffBlueprints, shapesToBlueprint } from './designBlueprint.ts';
import type { Shape } from './playground.ts';

const box = (id: string, x: number): Shape => ({ id, kind: 'box', mode: 'solid', position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x, y: 10, z: 10 } });
const bp = (x: number) => shapesToBlueprint([box('a', x)], 'T', 'Assumed 3 mm walls. Guessed the width.');
const proj = (status: ProjectView['status'], current = 2): ProjectView => ({
  id: 'x', createdAt: '', source: 'prompt', status, current, aiRevisions: 3,
  revisions: [{ n: 1, parent: null, by: 'ai', blueprint: bp(10), createdAt: '' }, { n: 2, parent: 1, by: 'manual', blueprint: bp(20), createdAt: '' }],
});

test('steps open only as the status allows', () => {
  assert.deepEqual((['plan', 'approve', 'build', 'order'] as const).map((s) => stepAllowed(s, 'draft')), [true, true, false, false]);
  assert.deepEqual((['plan', 'approve', 'build', 'order'] as const).map((s) => stepAllowed(s, 'approved')), [true, true, true, false]);
  assert.equal(stepAllowed('order', 'finalized'), true);
  assert.equal(stepAllowed('order', 'ordered'), true);
  assert.deepEqual(['draft', 'approved', 'finalized', 'ordered'].map((s) => defaultStep(s as 'draft')), ['plan', 'build', 'order', 'order']);
  assert.equal(settleStep('order', 'draft'), 'plan'); // a stale step falls back
  assert.equal(settleStep('approve', 'approved'), 'approve');
});

test('stepViews marks done and current', () => {
  const v = stepViews('approved', 'build');
  assert.deepEqual(v.map((s) => s.done), [true, true, false, false]);
  assert.deepEqual(v.map((s) => s.current), [false, false, true, false]);
  assert.equal(v[3].allowed, false);
});

test('order is enabled only for a finalized project', () => {
  assert.deepEqual((['draft', 'approved', 'finalized', 'ordered'] as const).map(canPlaceOrder), [false, false, true, false]);
});

test('server errors map to UI states', () => {
  assert.equal(mapError(429, 'Daily limit').kind, 'rate_limit');
  assert.equal(mapError(503).kind, 'ai_off');
  assert.deepEqual(mapError(422, 'A solid does not overlap any other solid'), { kind: 'invalid', text: 'A solid does not overlap any other solid' });
  assert.equal(mapError(404).kind, 'missing');
  assert.equal(mapError(409, 'This design is approved').kind, 'conflict');
  assert.equal(mapError(0).kind, 'network');
  assert.equal(mapError(500).kind, 'server');
});

test('AI usage reads "3 of 5 used" and caps at zero left', () => {
  assert.equal(aiUsage(proj('draft'), 5).text, '3 of 5 used');
  assert.equal(aiUsage(proj('draft'), 5).left, 2);
  assert.equal(aiUsage(proj('draft'), 3).exhausted, true);
  assert.equal(aiUsage(proj('draft'), 0).left, 0);
});

test('revisions: rows, previous, undo', () => {
  const p = proj('draft');
  assert.deepEqual(revisionRows(p).map((r) => [r.label, r.current]), [['v1', false], ['v2', true]]);
  assert.equal(previousRevision(p)?.n, 1);
  assert.equal(canUndo(p), true);
  assert.equal(canUndo(proj('approved')), false); // frozen
  assert.equal(canUndo(proj('draft', 1)), false); // nothing before v1
  assert.equal(previousRevision(proj('draft', 1)), null);
});

test('part rows, notes and diff rows', () => {
  assert.deepEqual(partRows(bp(20)).map((r) => [r.name, r.dims]), [['Part', '20 × 10 × 10 mm']]);
  assert.deepEqual(noteItems('Assumed 3 mm walls. Guessed the width.'), ['Assumed 3 mm walls.', 'Guessed the width.']);
  const rows = diffRows(diffBlueprints(bp(10), bp(20)));
  assert.ok(rows.some((r) => r.kind === 'changed' && r.detail === 'size x: 10 mm → 20 mm'));
  assert.equal(diffRows({ added: ['P/box'], removed: [], changed: [] })[0].kind, 'added');
});

test('stored id and prefill are sanitised', () => {
  assert.equal(parseStoredId('7B0C9A0E-1111-4222-8333-444455556666'), '7b0c9a0e-1111-4222-8333-444455556666');
  assert.equal(parseStoredId('../etc'), null);
  assert.equal(parseStoredId(null), null);
  assert.equal(prefillPrompt('  a\n\nb  '), 'a b');
  assert.equal(prefillPrompt('x'.repeat(900)).length, PROMPT_MAX);
  assert.equal(prefillPrompt(null), '');
});

test('reassign keeps shapes in their parts and puts new ones in an Added part', () => {
  const b = bp(10);
  const out = reassign(b, [box('a', 30), box('n', 5)]);
  assert.deepEqual(out.parts.map((p) => [p.id, p.shapes.map((s) => s.id)]), [['part1', ['a']], ['added', ['n']]]);
  assert.equal(out.envelope.x, 30);
  assert.deepEqual(reassign(b, [box('n', 5)]).parts.map((p) => p.id), ['added']); // the old part is gone
});
