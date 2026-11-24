import test from 'node:test';
import assert from 'node:assert/strict';
import { parseComponents, motorKind, quadX, typicalMass, MAX_MOTORS, MAX_COMPONENTS } from './components.ts';

const motor = { id: 'm1', pos: [10, 10, 0], spin: 'cw', motorId: 'gr2306-buttercutter' };
const ok = { motors: [motor], components: [{ id: 'c1', name: 'Battery', massG: null, pos: [0, 0, 0] }] };

test('valid input parses; null mass kept as blank', () => {
  const p = parseComponents(ok);
  assert.equal(p.components[0].massG, null);
});

test('strict rejections', () => {
  const bad = (o: unknown) => assert.throws(() => parseComponents(o));
  bad(null); bad({ ...ok, extra: 1 });
  bad({ ...ok, motors: [{ ...motor, extra: 1 }] });
  bad({ ...ok, motors: [{ ...motor, pos: [NaN, 0, 0] }] });
  bad({ ...ok, motors: [{ ...motor, pos: [5000, 0, 0] }] });
  bad({ ...ok, motors: [{ ...motor, spin: 'up' }] });
  bad({ ...ok, motors: [{ ...motor, motorId: 'nope' }] });
  bad({ ...ok, motors: [motor, { ...motor, id: 'm2', motorId: 'adafruit-tt-48' }] }); // no mixing prop and gear
  bad({ ...ok, components: [{ ...ok.components[0], yawDeg: 181 }] });
  bad({ ...ok, components: [{ ...ok.components[0], yawDeg: NaN }] });
  bad({ ...ok, components: [{ ...ok.components[0], tiltDeg: -91 }] });
  bad({ ...ok, components: [{ ...ok.components[0], rollDeg: 1 }] });
  bad({ ...ok, motors: [motor, motor] });
  bad({ ...ok, motors: Array.from({ length: MAX_MOTORS + 1 }, (_, i) => ({ ...motor, id: `m${i}` })) });
  bad({ ...ok, components: Array.from({ length: MAX_COMPONENTS + 1 }, (_, i) => ({ id: `c${i}`, name: 'x', massG: 1, pos: [0, 0, 0] })) });
  bad({ ...ok, components: [{ id: 'c', name: 'x', massG: -1, pos: [0, 0, 0] }] });
  bad({ ...ok, components: [{ id: 'c', name: 'x', massG: undefined, pos: [0, 0, 0] }] });
});

test('quadX: props-in spins, mirror flips all', () => {
  const q = Object.fromEntries(quadX(50, 50, 'x').map((m) => [m.id, m.spin]));
  assert.deepEqual(q, { fr: 'ccw', rl: 'ccw', fl: 'cw', rr: 'cw' });
  assert.ok(quadX(50, 50, 'x', true).every((m) => m.spin !== q[m.id]));
});

test('typicalMass is flagged as an estimate; unknown names give null', () => {
  assert.equal(typicalMass('4S battery')?.estimate, true);
  assert.equal(typicalMass('mystery'), null);
});

test('yaw and tilt are optional: old saves parse unchanged, new ones round-trip', () => {
  assert.equal('yawDeg' in parseComponents(ok).components[0], false);
  const c = { ...ok.components[0], yawDeg: -90, tiltDeg: 25 };
  assert.deepEqual(parseComponents({ ...ok, components: [c] }).components[0], c);
  assert.equal(parseComponents({ ...ok, components: [{ ...c, yawDeg: 180 }] }).components[0].yawDeg, 180);
});

test('gear motors parse alone, and kinds are told apart', () => {
  const g = { ...motor, motorId: 'pololu-n20-hp-50' };
  assert.equal(parseComponents({ ...ok, motors: [g, { ...g, id: 'm2' }] }).motors.length, 2);
  assert.deepEqual([motorKind(g.motorId), motorKind(motor.motorId), motorKind('x')], ['gear', 'prop', null]);
});

test('ESC + FC stack gets the stack mass (ESC 15 + FC 8), not the FC alone', () => {
  for (const n of ['ESC + FC stack', 'FC/ESC stack', 'Flight controller + ESC', 'stack']) assert.equal(typicalMass(n)?.massG, 23, n);
  assert.equal(typicalMass('ESC')?.massG, 15);
  assert.equal(typicalMass('Flight controller')?.massG, 8);
  assert.equal(typicalMass('ESC + FC stack')?.estimate, true);
});
