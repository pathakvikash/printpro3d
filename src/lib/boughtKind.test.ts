import test from 'node:test';
import assert from 'node:assert/strict';
import { boughtKind, type BoughtKind } from './boughtKind.ts';
import { adaptedKits } from './kits/adapt.ts';

// every bought part of every kit's default assembly (and each variant's)
type P = { bought?: boolean; material?: string; id: string; label: string; shape?: 'box' | 'cylinder' };
const kits = adaptedKits().flatMap((k) => [k, ...(k.variants ?? [])]);
const bought = kits.flatMap((k) => (k.assembly?.() as P[] ?? []).filter((p) => p.bought || p.material === 'bought').map((p) => ({ kit: k.id, ...p, kind: boughtKind(p.label, p.id, p.shape) })));
const kindsOf = (kit: string) => bought.filter((b) => b.kit === kit).map((b) => b.kind);

// hand-picked: [label, id, shape, expected]
const CASES: [string, string, 'box' | 'cylinder' | undefined, BoughtKind][] = [
  ['Main motor (typical 8.5 mm coreless)', 'main-motor', 'cylinder', 'motor'],
  ['Main shaft (2 mm) and 2 bearings', 'main-shaft', 'cylinder', 'other'],
  ['Rotor blades', 'rotor-blades', undefined, 'prop'],
  ['N20 gear motor', 'motor-a', 'box', 'other'], // a box motor draws as a box, not a cylinder motor
  ['SG90 servo', 'servo', undefined, 'other'],
  ['ESP32 dev board', 'bought-esp32', 'box', 'board'],
  ['WS2812 LED strip (wound)', 'bought-led-strip', 'cylinder', 'other'],
  ['M3 x 8 screw', 'screw-1', 'cylinder', 'other'],
];

test('boughtKind picks the visual for known labels', () => {
  for (const [label, id, shape, want] of CASES) assert.equal(boughtKind(label, id, shape), want, label);
});

test('every kit assembly has bought parts, each resolving to a kind', () => {
  assert.ok(bought.length > 20);
  for (const b of bought) assert.ok(['motor', 'prop', 'board', 'battery', 'camera', 'other'].includes(b.kind), `${b.kit}: ${b.label}`);
});

test('whoop gets motors, 4 props, AIO, battery and camera', () => {
  const k = kindsOf('whoop-kit');
  assert.deepEqual([...new Set(k)].sort(), ['battery', 'board', 'camera', 'motor', 'prop']);
  assert.equal(k.filter((x) => x === 'prop').length, 4);
  assert.ok(k.filter((x) => x === 'motor').length >= 1);
});
