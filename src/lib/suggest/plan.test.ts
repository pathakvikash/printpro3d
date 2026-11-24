import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../examples.ts';
import type { Parts } from '../flight/layout.ts';
import { quadX } from '../flight/components.ts';
import { suggestNext } from './next.ts';
import { suggestPlacement } from './placement.ts';
import { mergeAi, nudge, suggestItems, describeAngle, kindOfMassName } from './plan.ts';
import { parseBody, rerank } from './ai.ts';
import { checkPlacement, classify, classifyAll, validateSuggestion, wrap180 } from './validate.ts';

const plate = EXAMPLES.find((e) => e.id === 'drone-plate')!.shapes;
const M = 'gr2306-buttercutter';
const none: Parts = { motors: [], components: [] };
const comp = (name: string, pos: [number, number, number], massG: number | null = null) => ({ id: name, name, massG, pos });
const quad = (): Parts => ({ motors: quadX(28, 28, M).map((m) => ({ ...m, pos: [m.pos[0], m.pos[1], 3] as [number, number, number] })), components: [] });

test('checkPlacement: floating in z is rejected, resting is fine', () => {
  assert.match(checkPlacement('fc', [0, 0, 20], plate) ?? '', /float/);
  assert.match(checkPlacement('fc', [0, 0, 8], plate) ?? '', /float/); // 2 mm in the air
  assert.equal(checkPlacement('fc', [0, 0, 6], plate), null); // plate top is 3, fc is 6 tall
});

test('checkPlacement: overlapping a placed part is rejected, stacking on it is fine', () => {
  const placed: Parts = { ...none, components: [comp('ESC', [0, 0, 6])] };
  assert.match(checkPlacement('fc', [0, 0, 7], plate, undefined, placed) ?? '', /overlap/);
  assert.equal(checkPlacement('fc', [0, 0, 12], plate, undefined, placed), null);
  assert.match(checkPlacement('fc', [0, 0, 12], plate) ?? '', /float/); // unaware of the ESC it would sit on
  const withMotor = quad();
  assert.match(checkPlacement('battery', [28, 28, 13], plate, undefined, withMotor) ?? '', /overlap/);
});

test('validateSuggestion: the AI yaw is validated, wrapped and used for the footprint', () => {
  // a wall 25..35 mm in front: the battery (60x30) clears it lengthwise but its turned footprint (30x60) would hit it
  const wall = { ...plate[0], id: 'wall', size: { x: 40, y: 10, z: 40 }, position: { x: 0, y: 30, z: 20 }, rotation: { x: 0, y: 0, z: 0 } };
  const rail = [{ ...plate[0], size: { x: 40, y: 160, z: 3 }, position: { x: 0, y: 0, z: 1.5 }, rotation: { x: 0, y: 0, z: 0 } }, wall];
  const at = [0, 0, 13] as const;
  assert.equal(validateSuggestion({ kind: 'battery', posMm: [...at], yawDeg: 0 }, rail).ok, true);
  assert.equal(validateSuggestion({ kind: 'battery', posMm: [...at], yawDeg: 90 }, rail).ok, false);
  assert.equal(validateSuggestion({ kind: 'battery', posMm: [...at], yawDeg: 450 }, rail).ok, false); // 450 wraps to 90
  assert.equal(validateSuggestion({ kind: 'battery', posMm: [...at] }, rail).ok, true);
  const v = validateSuggestion({ kind: 'fc', yawDeg: 450 }, plate);
  assert.ok(v.ok && v.value.yawDeg === 90);
  assert.equal(validateSuggestion({ kind: 'fc', yawDeg: Infinity }, plate).ok, false);
  assert.equal(validateSuggestion({ kind: 'camera', tiltDeg: -200 }, plate).ok && 0, 0);
  assert.equal(wrap180(180), 180); assert.equal(wrap180(-180), 180); assert.equal(wrap180(-270), 90); assert.equal(wrap180(359.96), 0);
});

test('classify: a combined ESC + FC stack counts as both', () => {
  assert.deepEqual(classifyAll('ESC + FC stack'), ['fc', 'esc']);
  assert.equal(classify('ESC + FC stack'), 'fc');
  assert.deepEqual(classifyAll('Flight stack'), ['fc', 'esc']);
  assert.deepEqual(classifyAll('Battery'), ['battery']);
  assert.deepEqual(classifyAll('Receiver'), []);
  const p: Parts = { motors: quad().motors, components: [comp('ESC + FC stack', [0, 0, 9]), comp('Battery', [0, 0, 25])] };
  assert.deepEqual(suggestNext(plate, p).map((s) => s.kind), ['camera']);
  assert.match(suggestPlacement('esc', plate, p).reason, /already/);
  assert.match(suggestPlacement('fc', plate, p).reason, /already/);
});

test('placement: a battery never lands on a motor or an existing part', () => {
  const parts: Parts = { ...quad(), components: [comp('ESC + FC stack', [0, 0, 9])] };
  const r = suggestPlacement('battery', plate, parts);
  assert.ok(r.posMm, r.reason);
  assert.equal(checkPlacement('battery', r.posMm, plate, 'yawDeg' in r && r.yawDeg === 90 ? [30, 60, 20] : undefined, parts), null);
  assert.match(r.reason, /centre of mass/);
});

test('plan: items carry spot and angle; chip names map to kinds', () => {
  const items = suggestItems(plate, none, { category: 'drone' });
  assert.deepEqual(items.map((i) => i.kind), ['motor', 'esc', 'battery', 'fc', 'camera']);
  assert.ok(items.every((i) => i.place.posMm));
  assert.equal(kindOfMassName('Flight controller'), 'fc');
  assert.equal(kindOfMassName('Payload'), 'payload');
  assert.equal(describeAngle({ yawDeg: 0, tiltDeg: 25 }, 'camera'), 'tilted up 25 deg');
  assert.equal(describeAngle({ yawDeg: 0, tiltDeg: 0 }, 'fc'), '');
  assert.deepEqual(suggestItems(plate, none, { category: 'toy' }), []);
});

test('nudge: moves in steps, re-rests in z, refuses an off-frame spot', () => {
  const fc = suggestPlacement('fc', plate, quad());
  assert.ok(fc.posMm && 'yawDeg' in fc);
  const a = nudge('fc', fc, { dx: 2 }, plate, quad());
  assert.ok(a.ok && a.place.posMm[0] === 2 && a.place.basis === 'nudged');
  const far = nudge('fc', fc, { dx: 60 }, plate, quad());
  assert.equal(far.ok, false);
  const turned = nudge('fc', fc, { dYaw: 270 }, plate, quad());
  assert.ok(turned.ok && turned.place.yawDeg === -90);
});

test('mergeAi: AI order and reason used, bad spots fall back to the rule, junk ignored', () => {
  const rules = suggestItems(plate, none, { category: 'drone' });
  const good = { posMm: [0, 0, 6], yawDeg: 0, tiltDeg: 0, reason: 'x' };
  const m = mergeAi(rules, { items: [{ kind: 'fc', reason: 'FC first\u0000', place: good }, { kind: 'battery', place: { ...good, posMm: [500, 0, 6] } }, { kind: 'laser' }, { kind: 'fc' }] }, plate, none)!;
  assert.deepEqual(m.map((i) => i.kind), ['fc', 'battery', 'motor', 'esc', 'camera']);
  assert.equal(m[0].reason, 'FC first');
  assert.equal(m[0].ai, true);
  assert.deepEqual(m[0].place.posMm, [0, 0, 6]);
  assert.deepEqual(m[1].place, rules.find((r) => r.kind === 'battery')!.place);
  assert.equal(mergeAi(rules, 'nope', plate, none), null);
  assert.equal(mergeAi(rules, { items: [{ kind: 'laser' }] }, plate, none), null);
});

test('ai rerank: valid reply re-ranks, any failure returns null (rules stand)', async () => {
  const ok = await rerank(async () => JSON.stringify({ suggestions: [{ kind: 'battery', reason: 'Power first' }, { kind: 'fc', posMm: [900, 0, 5] }] }), plate, none);
  assert.deepEqual(ok!.map((i) => i.kind), ['battery', 'motor', 'esc', 'fc', 'camera']);
  assert.equal(ok![0].ai, true);
  assert.equal(ok![0].reason, 'Power first');
  assert.equal(await rerank(async () => { throw new Error('down'); }, plate, none), null);
  assert.equal(await rerank(async () => 'not json', plate, none), null);
  assert.equal(await rerank(async () => JSON.stringify({ suggestions: [{ kind: 'laser' }] }), plate, none), null);
  assert.equal(await rerank(async () => '{}', [], none), null);
});

test('parseBody: strict, motor-less parts allowed', () => {
  assert.equal(parseBody({ shapes: [] }), null);
  const b = parseBody({ shapes: plate, parts: { motors: [], components: [{ id: 'c1', name: 'Battery', massG: null, pos: [0, 0, 13] }] } });
  assert.ok(b && b.parts.motors.length === 0 && b.parts.components.length === 1);
  assert.equal(parseBody({ shapes: plate, parts: { motors: [], components: [{ id: 'c1', name: 'Battery', massG: 'x', pos: [0, 0, 13] }] } }), null);
});
