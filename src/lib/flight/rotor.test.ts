import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRotor, propDiameterMm, thrustN, maxThrustN, throttleForThrust, operating, thrustFromRpm, ETA_ASSUMED } from './rotor.ts';

const r = makeRotor('gr2306-buttercutter');

test('prop diameter parsed from 5x5x3', () => assert.equal(propDiameterMm(r.motor.prop), 127));

test('thrust matches measured points; basis measured inside, model below', () => {
  assert.ok(Math.abs(thrustN(r, 100).value - 1.611 * 9.80665) < 1e-9);
  assert.equal(thrustN(r, 50).basis, 'measured');
  assert.equal(thrustN(r, 10).basis, 'model');
});

test('Ct model T = Ct rho n^2 D^4 agrees with the measured max within 15%', () => {
  const p = r.run.points[3];
  assert.ok(Math.abs(thrustFromRpm(r, p.rpm) / maxThrustN(r) - 1) < 0.15);
});

test('thrust <-> throttle round trip', () => {
  for (const t of [30, 55, 80, 97]) assert.ok(Math.abs(throttleForThrust(r, thrustN(r, t).value).throttlePct - t) < 1e-6);
  assert.equal(throttleForThrust(r, 1e6).saturated, 'high');
});

test('operating: amps measured, torque = eta P / omega and labelled assumed', () => {
  const o = operating(r, 5.472); // ~558 g, the 50% point
  assert.ok(Math.abs(o.amps - 10.38) < 0.05);
  assert.equal(o.basis.torque, 'assumed'); assert.equal(o.basis.current, 'measured');
  assert.ok(Math.abs(o.torqueNm - (ETA_ASSUMED * o.watts) / ((o.rpm * 2 * Math.PI) / 60)) < 1e-12);
});

test('unknown or non-prop motor throws', () => {
  assert.throws(() => makeRotor('nope')); assert.throws(() => makeRotor('adafruit-tt-48'));
});
