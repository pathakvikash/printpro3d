import test from 'node:test';
import assert from 'node:assert/strict';
import { addMass, addMotor, loadParts, makeQuad, mountPoints, NO_PARTS, pushHistory, redoHistory, savedParts, snapToMount, undoHistory, type History } from './layout.ts';
import { EXAMPLES } from '../examples.ts';
import { MAX_MOTORS } from './components.ts';

const M = 'gr2306-buttercutter';
const plate = EXAMPLES.find((e) => e.id === 'drone-plate')!.shapes;

test('drone-plate exposes exactly its 4 mounts at the plate top; snap within 8 mm, else the raw point', () => {
  const m = mountPoints(plate);
  assert.equal(m.length, 4);
  assert.ok(m.every((p) => Math.abs(Math.abs(p[0]) - 28) < 1e-9 && Math.abs(Math.abs(p[1]) - 28) < 1e-9 && p[2] === 3));
  assert.deepEqual(snapToMount([24, 30, 3], m), { pos: [28, 28, 3], snapped: true });
  assert.deepEqual(snapToMount([0, 0, 3], m), { pos: [0, 0, 3], snapped: false });
});

test('add motor/mass: unique ids, caps, alternating spin', () => {
  let p = NO_PARTS;
  for (let i = 0; i < MAX_MOTORS + 2; i++) p = addMotor(p, [i, 0, 0], M).parts;
  assert.equal(p.motors.length, MAX_MOTORS);
  assert.equal(new Set(p.motors.map((m) => m.id)).size, MAX_MOTORS);
  assert.deepEqual(p.motors.slice(0, 3).map((m) => m.spin), ['ccw', 'cw', 'ccw']);
  assert.equal(addMass(NO_PARTS, 'Battery', [0, 0, 5]).parts.components[0].massG, null);
});

test('makeQuad gives 4 balanced motors from one; storage round-trips and rejects junk', () => {
  const one = addMotor(NO_PARTS, [28, 28, 3], M).parts;
  const q = makeQuad(one, 'm1');
  assert.equal(q.motors.length, 4);
  assert.ok(q.motors.every((m) => m.pos[2] === 3 && Math.abs(m.pos[0]) === 28));
  assert.equal(q.motors.filter((m) => m.spin === 'cw').length, 2);
  assert.deepEqual(loadParts(savedParts(q)), q);
  assert.equal(savedParts(NO_PARTS), null);
  assert.deepEqual(loadParts('{"motors":[]}'), NO_PARTS);
  assert.deepEqual(loadParts('not json'), NO_PARTS);
});

test('history covers parts: undo and redo restore them', () => {
  const d0 = { shapes: plate, parts: NO_PARTS };
  const d1 = { shapes: plate, parts: addMotor(NO_PARTS, [1, 2, 3], M).parts };
  let h: History = { past: [], now: d0, future: [] };
  h = pushHistory(h, d1, undefined, 0);
  assert.equal(h.now.parts.motors.length, 1);
  h = undoHistory(h);
  assert.equal(h.now.parts.motors.length, 0);
  h = redoHistory(h);
  assert.equal(h.now.parts.motors.length, 1);
});
