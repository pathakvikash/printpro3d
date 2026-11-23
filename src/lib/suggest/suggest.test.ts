import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../examples.ts';
import type { Parts } from '../flight/layout.ts';
import { trim } from '../flight/trim.ts';
import { quadX } from '../flight/components.ts';
import { suggestNext } from './next.ts';
import { suggestPlacement } from './placement.ts';
import { applyAiPlan, checkPlacement, SUGGEST_SCHEMA, validateSuggestion } from './validate.ts';

const plate = EXAMPLES.find((e) => e.id === 'drone-plate')!.shapes;
const M = 'gr2306-buttercutter';
const none: Parts = { motors: [], components: [] };
const comp = (name: string, pos: [number, number, number], massG: number | null = null) => ({ id: name, name, massG, pos });
const quad = (): Parts => ({ motors: quadX(28, 28, M).map((m) => ({ ...m, pos: [m.pos[0], m.pos[1], 3] as [number, number, number] })), components: [] });

test('next: drone order, never what exists, empty when complete', () => {
  assert.deepEqual(suggestNext(plate, none).map((s) => s.kind), ['motor', 'esc', 'battery', 'fc', 'camera']);
  assert.equal(suggestNext(plate, none)[0].count, 4);
  const half: Parts = { motors: quad().motors.slice(0, 3), components: [comp('Battery', [0, 0, 8])] };
  const n = suggestNext(plate, half);
  assert.deepEqual(n.map((s) => s.kind), ['motor', 'esc', 'fc', 'camera']);
  assert.equal(n[0].count, 1);
  assert.ok(n.every((s) => s.reason.length > 10 && !s.reason.includes('\n')));
  const full: Parts = { motors: quad().motors, components: ['Battery', 'ESC', 'Flight controller', 'Camera'].map((x) => comp(x, [0, 0, 5])) };
  assert.deepEqual(suggestNext(plate, full), []);
  assert.deepEqual(suggestNext([], none), []);
  assert.deepEqual(suggestNext(plate, none, { category: 'toy' }), []);
});

test('placement: 4 motors snap to the plate pads with the quad-X spin pattern', () => {
  let parts = none;
  const got: { pos: number[]; spin?: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const r = suggestPlacement('motor', plate, parts);
    assert.ok(r.posMm, r.reason);
    assert.equal(r.reason.includes('mount pad'), true);
    got.push({ pos: r.posMm, spin: 'spin' in r ? r.spin : undefined });
    parts = { ...parts, motors: [...parts.motors, { id: `m${i}`, pos: r.posMm, spin: ('spin' in r ? r.spin : 'cw') as 'cw', motorId: M }] };
  }
  for (const g of got) { assert.equal(Math.abs(g.pos[0]), 28); assert.equal(Math.abs(g.pos[1]), 28); assert.equal(g.pos[2], 3); }
  assert.equal(new Set(got.map((g) => g.pos.join())).size, 4);
  for (const g of got) assert.equal(g.spin, g.pos[0] * g.pos[1] > 0 ? 'ccw' : 'cw');
  const ref = quadX(28, 28, M); // matches the library's own quad-X
  for (const m of ref) assert.equal(got.find((g) => g.pos[0] === m.pos[0] && g.pos[1] === m.pos[1])!.spin, m.spin);
  assert.equal(suggestPlacement('motor', plate, parts).posMm, null);
});

test('placement: battery moves the CG toward the thrust centroid', () => {
  const parts: Parts = { ...quad(), components: [comp('ESC', [20, 0, 6], 15), comp('Flight controller', [18, 6, 6], 8)] };
  const r = suggestPlacement('battery', plate, parts);
  assert.ok(r.posMm && 'basis' in r && r.basis === 'physics', r.reason);
  const cg = (batt: [number, number, number]) => trim({ ...parts, components: [...parts.components, comp('Battery', batt, 160)] }).cgMm;
  const off = (c: number[]) => Math.hypot(c[0], c[1]);
  const without = trim(parts).cgMm;
  assert.ok(off(cg(r.posMm)) < off(without), 'CG offset must shrink');
  assert.ok(r.posMm[0] < 0, 'battery goes opposite the off-centre parts');
  assert.match(r.reason, /mm from the thrust centre/);
  assert.equal(checkPlacement('battery', r.posMm, plate), null);
});

test('placement: flight controller at centre, camera at front with typical tilt', () => {
  const fc = suggestPlacement('fc', plate, quad());
  assert.ok(fc.posMm && fc.posMm[0] === 0 && fc.posMm[1] === 0);
  const cam = suggestPlacement('camera', plate, quad());
  assert.ok(cam.posMm && 'tiltDeg' in cam);
  assert.ok(cam.tiltDeg >= 15 && cam.tiltDeg <= 35);
  assert.equal(cam.posMm[0], 0);
  assert.ok(cam.posMm[1] >= 15, 'front edge of the centre plate');
  assert.match(cam.reason, /typical \(FPV 15-35 deg\), adjust to taste/);
  assert.equal(cam.basis, 'typical');
});

test('placement: every kind stays in the bed and clear of the frame; null with reasons', () => {
  for (const k of ['motor', 'esc', 'battery', 'fc', 'camera', 'payload'] as const) {
    const r = suggestPlacement(k, plate, k === 'motor' ? { ...quad(), motors: quad().motors.slice(0, 3) } : quad());
    assert.ok(r.posMm, `${k}: ${r.reason}`);
    assert.equal(checkPlacement(k, r.posMm, plate), null, k);
  }
  assert.equal(suggestPlacement('battery', [], none).posMm, null);
  const tiny = [{ ...plate[0], size: { x: 20, y: 20, z: 3 } }];
  assert.match(suggestPlacement('battery', tiny, none).reason, /No spot/);
  assert.match(suggestPlacement('fc', plate, { ...none, components: [comp('FC', [0, 0, 5])] }).reason, /already/);
});

test('validate: out-of-bed, frame overlap, unknown kinds, bad numbers, prototype keys rejected', () => {
  const ok = validateSuggestion({ kind: 'fc', reason: 'x\u0000y', posMm: [0, 0, 8], yawDeg: 90, tiltDeg: 200 }, plate);
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.value.tiltDeg, 90); assert.equal(ok.value.reason, 'x y'); }
  const bad = (x: unknown) => assert.equal(validateSuggestion(x, plate).ok, false, JSON.stringify(x));
  bad({ kind: 'fc', posMm: [500, 0, 8] }); // out of bed / frame
  bad({ kind: 'fc', posMm: [0, 0, 1] }); // inside the plate
  bad({ kind: 'fc', posMm: [0, 0, 5000] });
  bad({ kind: 'fc', posMm: [0, 0, NaN] });
  bad({ kind: 'fc', posMm: [1e12, 0, 5] });
  bad({ kind: 'laser' });
  bad({ kind: 'fc', yawDeg: NaN });
  bad({ kind: 'fc', extra: 1 });
  bad(JSON.parse('{"kind":"fc","__proto__":{"x":1}}'));
  bad(JSON.parse('{"kind":"fc","constructor":1}'));
  bad(null); bad([]); bad('fc');
  assert.equal(validateSuggestion({ kind: 'camera' }, plate, ['fc']).ok, false); // not a rule candidate
  assert.equal(({} as Record<string, unknown>).x, undefined); // prototype untouched
  assert.equal(SUGGEST_SCHEMA.properties.suggestions.items.properties.kind.enum.includes('motor'), true);
});

test('validate: AI plan only re-ranks or rewords; junk is rejected and nothing is dropped', () => {
  const cands = suggestNext(plate, none);
  const r = applyAiPlan(cands, { suggestions: [{ kind: 'battery', reason: 'Power first' }, { kind: 'laser' }, { kind: 'battery' }, { kind: 'fc', posMm: [900, 0, 5] }] }, plate);
  assert.deepEqual(r.ordered.map((c) => c.kind), ['battery', 'motor', 'esc', 'fc', 'camera']);
  assert.equal(r.ordered[0].reason, 'Power first');
  assert.equal(r.rejected.length, 3);
  assert.deepEqual(applyAiPlan(cands, 'nope', plate).ordered.map((c) => c.kind), cands.map((c) => c.kind));
  assert.deepEqual(applyAiPlan(cands, JSON.parse('{"__proto__":1,"suggestions":[]}'), plate).ordered.length, cands.length);
});

test('review fixes: parts sit on real material, turned battery is checked turned, yaw wraps, off-centre frame spins', () => {
  const cam = suggestPlacement('camera', plate, quad());
  assert.ok(cam.posMm && cam.posMm[1] <= 20, `camera must sit over the 40 mm centre plate, not the gap between arms: ${cam.posMm}`);
  assert.equal(validateSuggestion({ kind: 'fc', posMm: [0, 30, 8] }, plate).ok, false); // bbox of the X arms, but no material there
  // long thin rail along y: the battery only fits turned, and stacks on the ESC under it
  const rail = [{ ...plate[0], kind: 'box' as const, size: { x: 40, y: 160, z: 3 }, position: { x: 0, y: 0, z: 1.5 }, rotation: { x: 0, y: 0, z: 0 } }];
  const esc = comp('ESC', [0, 20, 6], 15);
  const b = suggestPlacement('battery', rail, { motors: [], components: [esc] });
  assert.ok(b.posMm && 'yawDeg' in b && b.yawDeg === 90, b.reason);
  if (Math.abs(b.posMm[1] - 20) < 45) assert.ok(b.posMm[2] - 10 >= 9 - 1e-9, `turned battery must stack on the ESC, z=${b.posMm[2]}`);
  const y = validateSuggestion({ kind: 'fc', yawDeg: 270 }, plate);
  assert.ok(y.ok && y.value.yawDeg === -90);
  const moved = plate.map((s) => ({ ...s, position: { ...s.position, x: s.position.x + 60 } }));
  const m = suggestPlacement('motor', moved, none);
  assert.ok(m.posMm && 'spin' in m, m.reason);
  assert.deepEqual([m.posMm[0], m.posMm[1], m.spin], [88, 28, 'ccw']); // front-right of the frame, not of the bed
});
