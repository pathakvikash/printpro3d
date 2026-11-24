import test from 'node:test';
import assert from 'node:assert/strict';
import { KITS, kitById } from './kits.ts';
import { defaultCfg, normalizeCfg, templateById } from './templateDefs.ts';
import { buildTemplate } from './templates.ts';
import { defaults as whoopDefaults, assembly as whoopAssembly, frameShapes as whoopFrame, validate as whoopValidate } from './kits/whoop-kit.ts';
import type { AssemblyPart } from './assembly.ts';

// Every kit whose assembly draws propellers: the prop discs must not touch each other or the centre stack, and the motors must
// sit exactly on a hole of the frame. A hover-rotor kit (heli) has one big rotor over the body, not a quad: not a case for this.
const GAP = 3; // mm of air kept between prop tips, and between a prop tip and the flight controller
const flat = (ks: typeof KITS): typeof KITS => ks.flatMap((k) => [k, ...flat(k.variants ?? [])]);
const withProps = flat(KITS).filter((k) => k.id !== 'heli-kit' && k.assembly?.().some((p) => /^prop\d+$/.test(p.id)));

const props = (parts: AssemblyPart[]) => parts.filter((p) => /^prop\d+$/.test(p.id));
const xy = (p: AssemblyPart) => [p.position[0], p.position[1]] as const;
// distance from a point to a (rotated about z) box footprint
function toRect(px: number, py: number, r: AssemblyPart) {
  const a = (-r.rotation[2] * Math.PI) / 180, dx = px - r.position[0], dy = py - r.position[1];
  const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.hypot(Math.max(Math.abs(x) - r.size[0] / 2, 0), Math.max(Math.abs(y) - r.size[1] / 2, 0));
}

function checkDiscs(label: string, parts: AssemblyPart[]) {
  const ps = props(parts);
  assert.equal(ps.length, 4, `${label}: 4 props`);
  const disc = (p: AssemblyPart) => Math.max(p.size[0], p.size[1]) / 2;
  for (const [i, a] of ps.entries()) for (const b of ps.slice(i + 1)) {
    const gap = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]) - disc(a) - disc(b);
    assert.ok(gap >= GAP, `${label}: ${a.id} and ${b.id} prop discs are ${gap.toFixed(1)} mm apart (need ${GAP})`);
  }
  const stack = parts.find((p) => /^(stack|aio|fc)$/.test(p.id));
  assert.ok(stack, `${label}: the assembly draws the flight controller stack (id stack, aio or fc)`);
  for (const p of ps) {
    const gap = toRect(...xy(p), stack) - disc(p);
    assert.ok(gap >= GAP, `${label}: ${p.id} prop disc is ${gap.toFixed(1)} mm from the stack (need ${GAP})`);
  }
}

// a hole of the frame centred under every motor
function checkMotorHoles(label: string, parts: AssemblyPart[], holes: { x: number; y: number }[]) {
  const motors = parts.filter((p) => /^motor\d+$/.test(p.id));
  assert.equal(motors.length, 4, `${label}: 4 motors`);
  for (const m of motors) {
    const d = Math.min(...holes.map((h) => Math.hypot(h.x - m.position[0], h.y - m.position[1])));
    assert.ok(d <= 0.5, `${label}: ${m.id} is ${d.toFixed(2)} mm from the nearest frame hole`);
  }
}
const holesOf = (shapes: { mode: string; kind: string; position: { x: number; y: number } }[]) => shapes.filter((s) => s.mode === 'hole' && s.kind === 'cylinder').map((s) => ({ x: s.position.x, y: s.position.y }));

test('the kits with propellers are the ones this test knows', () => {
  assert.deepEqual(withProps.map((k) => k.id).sort(), ['fpv-3in-kit', 'whoop-kit']);
});

test('every kit with props: prop discs clear each other and the stack', () => {
  for (const k of withProps) checkDiscs(k.id, k.assembly!());
  const whoop75 = whoopValidate({ ...whoopDefaults, duct: '75' }, true);
  checkDiscs('whoop-kit 75 mm', whoopAssembly(whoop75));
});

test('every kit with props: each motor sits on a hole of the frame mesh data', () => {
  const fpv = kitById('fpv-3in-kit')!;
  const item = fpv.items.find((i) => i.templateId === 'fpv-frame-3in')!;
  const t = templateById(item.templateId)!;
  checkMotorHoles('fpv-3in-kit', fpv.assembly!(), holesOf(buildTemplate(t, normalizeCfg(t, item.config, true)).shapes));
  for (const duct of ['65', '75']) {
    const c = whoopValidate({ ...whoopDefaults, duct }, true);
    checkMotorHoles(`whoop-kit ${duct}`, whoopAssembly(c), holesOf(whoopFrame(c)));
  }
});

test('the 3 inch frame: motor spacing leaves room for 3 inch props across its whole diagonal range, and the kit blurb states both', () => {
  const t = templateById('fpv-frame-3in')!;
  const diag = t.fields.find((f) => f.key === 'diag')!;
  assert.ok(diag.type === 'range');
  for (const d of [diag.min, diag.default, diag.max]) {
    const b = buildTemplate(t, normalizeCfg(t, { ...defaultCfg(t), diag: d }, true));
    assert.ok(d / Math.SQRT2 - 76.2 >= GAP, `${d} mm diagonal`);
    assert.ok(b.description.includes(`${Math.round((d / Math.SQRT2) * 10) / 10} mm apart`), b.description);
  }
  const kit = kitById('fpv-3in-kit')!;
  assert.ok(kit.blurb.includes('3 inch (76.2 mm)') && kit.blurb.includes('160 mm motor to motor') && kit.blurb.includes('113 mm apart'));
});
