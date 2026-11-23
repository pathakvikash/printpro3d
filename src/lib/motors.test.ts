import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTORS, interp, fitK, propAt, gearAt, power, gramsPerWatt, thrustToWeight, clamp, type PropMotor, type GearMotor } from './motors.ts';

const prop = MOTORS.find((m) => m.kind === 'prop') as PropMotor;
const run = prop.runs[0];
const tt = MOTORS.find((m) => m.id === 'adafruit-tt-48') as GearMotor;

test('interp: midpoint, clamped ends', () => {
  assert.equal(interp([0, 10], [0, 100], 5), 50);
  assert.equal(interp([0, 10], [0, 100], -3), 0);
  assert.equal(interp([0, 10], [0, 100], 99), 100);
});

test('fitK: exact on k*rpm^2 data, NaN under 3 points', () => {
  const pts = [1000, 2000, 3000].map((rpm, i) => ({ throttle: 30 * (i + 1), rpm, thrustG: 2e-6 * rpm ** 2, amps: 1, watts: 1 }));
  assert.ok(Math.abs(fitK(pts) - 2e-6) < 1e-12);
  assert.ok(Number.isNaN(fitK(pts.slice(0, 2))));
});

test('prop data: power matches published watts, k is sane', () => {
  for (const p of run.points) assert.ok(Math.abs(power(p.watts / p.amps, p.amps) - p.watts) < 1e-9);
  const k = fitK(run.points);
  assert.ok(k > 1.4e-6 && k < 1.9e-6);
});

test('propAt: hits data points, clamps throttle, model below range', () => {
  assert.equal(propAt(run, 100).thrustG, 1611);
  assert.equal(propAt(run, 150).thrustG, 1611);
  assert.equal(propAt(run, 50).basis, 'measured');
  assert.equal(propAt(run, 62.5).thrustG, (558 + 1072) / 2);
  const lo = propAt(run, 10);
  assert.equal(lo.basis, 'model');
  assert.ok(lo.thrustG > 0 && lo.thrustG < 181);
  assert.deepEqual([propAt(run, -5).rpm, propAt(run, -5).thrustG], [0, 0]);
});

test('gearAt: published endpoints, stall, bounds', () => {
  const r = tt.runs[1];
  const free = gearAt(r, 100, 0);
  assert.equal(free.rpm, 250);
  assert.equal(free.amps, 0.16);
  const stall = gearAt(r, 100, 1);
  assert.equal(stall.stalled, true);
  assert.equal(stall.amps, 1.5);
  assert.equal(stall.rpm, 0);
  const half = gearAt(r, 100, 0.5);
  assert.equal(half.rpm, 125);
  assert.ok(half.effPct > 0 && half.effPct < 100);
  assert.equal(gearAt(r, 0, 0.5).watts, 0);
  assert.equal(gearAt(r, 50, 0.9).stalled, true); // half duty cannot turn 90% of full-voltage stall torque
});

test('helpers', () => {
  assert.equal(gramsPerWatt(100, 50), 2);
  assert.equal(gramsPerWatt(100, 0), 0);
  assert.equal(thrustToWeight(500, 4, 1000), 2);
  assert.equal(thrustToWeight(500, 4, 0), 0);
  assert.equal(clamp(5, 0, 1), 1);
});

test('every entry has a source url', () => {
  for (const m of MOTORS) assert.match(m.source.url, /^https:\/\//);
});
