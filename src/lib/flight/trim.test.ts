import test from 'node:test';
import assert from 'node:assert/strict';
import { trim } from './trim.ts';
import { quadX } from './components.ts';
import { G } from './rotor.ts';
import { EXAMPLES } from '../examples.ts';

const M = 'gr2306-buttercutter';
const mass = (g: number | null, y = 0, name = 'body') => ({ id: name + y, name, massG: g, pos: [0, y, 0] as [number, number, number] });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('symmetric quad: equal thrusts, sum = m g, zero moments', () => {
  const t = trim({ motors: quadX(100, 100, M), components: [mass(500)] });
  const T = t.motors.map((m) => m.thrustN);
  T.forEach((v) => assert.ok(Math.abs(v - T[0]) < 1e-6));
  assert.ok(Math.abs(sum(T) - 0.5 * G) < 1e-6);
  assert.ok(t.feasible && Math.abs(t.residual.Mz) < 1e-9);
  assert.ok(t.thrustToWeight > 2 && !t.warnings.some((w) => ['low-tw', 'infeasible', 'spin-imbalance', 'prop-overlap', 'cg-offset'].includes(w.code)));
  assert.ok(t.hoverThrottlePct > 0 && t.hoverThrottlePct < 50 && t.hoverAmps > 0);
});

test('mirrored spins give Mz = 0; same-spin warns and cannot hold yaw', () => {
  const good = trim({ motors: quadX(100, 100, M), components: [mass(500)] });
  const spinMoment = good.motors.reduce((s, m) => s + (['fr', 'rl'].includes(m.id) ? 1 : -1) * m.op.kappaM * m.thrustN, 0);
  assert.ok(Math.abs(spinMoment) < 1e-9);
  const same = trim({ motors: quadX(100, 100, M).map((m) => ({ ...m, spin: 'cw' as const })), components: [mass(500)] });
  assert.ok(same.warnings.some((w) => w.code === 'spin-imbalance'));
  assert.equal(same.feasible, false);
});

test('CG shifted forward raises front thrusts', () => {
  const a = trim({ motors: quadX(100, 100, M), components: [mass(500)] });
  const b = trim({ motors: quadX(100, 100, M), components: [mass(400), mass(100, 40, 'batt')] });
  const front = (t: typeof a) => sum(t.motors.filter((m) => m.id === 'fr' || m.id === 'fl').map((m) => m.thrustN));
  assert.ok(front(b) > front(a) + 0.01);
  assert.ok(Math.abs(sum(b.motors.map((m) => m.thrustN)) - 0.5 * G) < 1e-6);
});

test('blank mass is flagged and counted as zero', () => {
  const t = trim({ motors: quadX(100, 100, M), components: [mass(500), mass(null, 0, 'camera')] });
  assert.ok(t.warnings.some((w) => w.code === 'blank-mass' && w.message.includes('camera')));
  assert.ok(Math.abs(t.massKg - 0.5) < 1e-12);
});

test('motor-out: reported honestly as unable to hold', () => {
  const t = trim({ motors: quadX(100, 100, M), components: [mass(500)] });
  assert.equal(t.motorOut.length, 4);
  assert.ok(t.motorOut.every((o) => !o.holdsAll && !o.yawHeld && /Cannot hold/.test(o.note)));
});

test('payload at T/W=2, flight time, ESC warning, low T/W', () => {
  const t = trim({ motors: quadX(100, 100, M), components: [mass(500)], batteryAh: 1.3, escAmps: 1 });
  const sumMax = sum(t.motors.map((m) => m.maxThrustN));
  assert.ok(Math.abs(t.maxPayloadG - (sumMax / (2 * G) - 0.5) * 1000) < 1e-6);
  assert.ok(Math.abs(t.flightMin! - ((1.3 * 0.8) / t.hoverAmps) * 60) < 1e-9);
  assert.ok(t.warnings.some((w) => w.code === 'esc-current'));
  assert.ok(trim({ motors: quadX(100, 100, M), components: [mass(4000)] }).warnings.some((w) => w.code === 'low-tw'));
});

test('CG offset over 5% of span warns', () => {
  assert.ok(trim({ motors: quadX(100, 100, M), components: [mass(500, 40)] }).warnings.some((w) => w.code === 'cg-offset'));
});

test('drone-plate example: motors at +/-28 mm overlap for 5x5x3 props', () => {
  const holes = EXAMPLES.find((e) => e.id === 'drone-plate')!.shapes.filter((s) => s.mode === 'hole');
  assert.equal(holes.length, 4);
  const motors = quadX(Math.abs(holes[0].position.x), Math.abs(holes[0].position.y), M);
  assert.equal(motors[0].pos[0], 28);
  const t = trim({ motors, components: [mass(300)] });
  assert.ok(t.warnings.some((w) => w.code === 'prop-overlap'));
});
