import test from 'node:test';
import assert from 'node:assert/strict';
import { CRR_ASSUMED, DEFAULT_WHEEL_MM, KGCM_TO_NM, gearMotor, groundAt, groundMassKg, topRun } from './ground.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);
const hp = topRun(gearMotor('pololu-n20-hp-50')!); // 6 V, 590 rpm no-load, 0.86 kg cm stall

test('defaults: wheel from the motor-wheel template (65 mm), crr 0.03, TT motor uses its 6 V run', () => {
  assert.equal(DEFAULT_WHEEL_MM, 65);
  assert.equal(CRR_ASSUMED, 0.03);
  assert.equal(topRun(gearMotor('adafruit-tt-48')!).volts, 6);
  assert.equal(gearMotor('gr2306-buttercutter'), null);
});

test('hand-checked: 2 x N20 HP, 60 mm wheel, 0.2 kg', () => {
  // r = 0.03 m; tau_s = 0.86 * 0.0980665 = 0.084337 N m; Fs = 2 * 0.084337 / 0.03 = 5.6225 N
  // v0 = 590 * 2pi/60 * 0.03 = 1.8534 m/s; R = 0.03 * 0.2 * 9.80665 = 0.05884 N
  // vTop = 1.8534 * (1 - 0.05884/5.6225) = 1.8340 m/s; t90 = ln10 * 0.2 * 1.8534 / 5.6225 = 0.1518 s; slope capped at 90 (Fs > m g)
  const g = groundAt({ run: hp, motors: 2, wheelMm: 60, massKg: 0.2 });
  near(KGCM_TO_NM * 0.86, 0.084337, 1e-6);
  near(g.stallForceN, 5.6225, 1e-3); near(g.noLoadMs, 1.8534, 1e-3); near(g.rollingN, 0.05884, 1e-5);
  near(g.topSpeedMs, 1.8340, 1e-3); near(g.t90S!, 0.1518, 1e-3);
  assert.equal(g.maxSlopeDeg, 90);
});

test('hand-checked slope: same car at 1 kg climbs about 33.2 degrees', () => {
  // k = 5.6225 / 9.80665 = 0.57332; A = sqrt(1 + 0.03^2) = 1.00045; asin(k/A) = 34.96 deg; minus atan(0.03) = 1.718 deg
  const g = groundAt({ run: hp, motors: 2, wheelMm: 60, massKg: 1 });
  near(g.maxSlopeDeg, 33.25, 0.05);
  near(Math.sin((g.maxSlopeDeg * Math.PI) / 180) + CRR_ASSUMED * Math.cos((g.maxSlopeDeg * Math.PI) / 180), g.stallForceN / 9.80665, 1e-4); // force balance at stall
  near(g.maxGradePct, Math.tan((g.maxSlopeDeg * Math.PI) / 180) * 100, 1e-9);
  near(g.topSpeedMs, 1.8534 * (1 - 0.2942 / 5.6225), 2e-3); // R = 0.03 * 9.80665 = 0.2942 N
});

test('too heavy to move: stall force below rolling resistance gives zero speed, no time', () => {
  const g = groundAt({ run: hp, motors: 1, wheelMm: 60, massKg: 10 }); // Fs 2.81 N < R 2.94 N
  assert.equal(g.moves, false); assert.equal(g.topSpeedMs, 0); assert.equal(g.t90S, null); assert.equal(g.maxSlopeDeg, 0);
});

test('bigger wheel: faster, weaker (speed and force scale with radius)', () => {
  const a = groundAt({ run: hp, motors: 2, wheelMm: 60, massKg: 0.5 }), b = groundAt({ run: hp, motors: 2, wheelMm: 90, massKg: 0.5 });
  assert.ok(b.topSpeedMs > a.topSpeedMs && b.stallForceN < a.stallForceN && b.maxSlopeDeg < a.maxSlopeDeg);
});

test('invalid inputs throw', () => {
  for (const bad of [{ motors: 0 }, { wheelMm: 0 }, { massKg: 0 }, { crr: -1 }, { wheelMm: NaN }]) assert.throws(() => groundAt({ run: hp, motors: 2, wheelMm: 60, massKg: 1, ...bad }));
});

test('groundMassKg: typed parts plus frame, blanks count 0', () => {
  const c = (massG: number | null) => ({ id: 'a', name: 'x', massG, pos: [0, 0, 0] as [number, number, number] });
  near(groundMassKg([c(100), c(null), c(50)]), 0.15, 1e-12);
  near(groundMassKg([c(100)], { massKg: 0.05, cgMm: [0, 0, 0], I: { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 } }), 0.15, 1e-12);
});
