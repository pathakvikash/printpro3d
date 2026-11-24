import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_HELI_KIT as K, HOLES, defaultConfig, partSizes, validate } from './heli-kit.ts';
import { fitsBed, meshStats, quote } from '../quote.ts';
import { analyzeMesh } from '../meshAnalysis.ts';

const CONFIGS = {
  default: {},
  min: { len: 150, shaft: '2', servos: '2', servoClass: '1.7' },
  minThreeServos: { len: 150, shaft: '2', servos: '3', servoClass: '1.7' },
  max: { len: 220, shaft: '3', servos: '3', servoClass: '3.7' },
};
const built = Object.fromEntries(Object.entries(CONFIGS).map(([k, raw]) => {
  const cfg = validate({ ...defaultConfig(), ...raw }, true);
  return [k, { cfg, parts: K.printedParts.map((p) => ({ p, pos: p.build(cfg).attributes.position.array as Float32Array })) }];
}));

test('config: defaults, strict validation and the servo/length rule', () => {
  assert.deepEqual(validate(defaultConfig(), true), defaultConfig());
  assert.throws(() => validate({ ...defaultConfig(), len: 149 }, true));
  assert.throws(() => validate({ ...defaultConfig(), shaft: '4' }, true));
  assert.throws(() => validate({ ...defaultConfig(), nope: 1 }, true));
  assert.throws(() => validate({ ...defaultConfig(), servos: '3', servoClass: '3.7', len: 160 }, true));
  assert.equal(validate({ servos: '3', servoClass: '3.7', len: 160 }).servos, '2'); // lenient: drops to 2 servos
});

test('every printed part is one closed piece, fits the bed in its print orientation, and has the size and holes we state', () => {
  for (const [name, { cfg, parts }] of Object.entries(built)) {
    const expect: Record<string, number> = {
      'side-frame': HOLES.frameFixed + +cfg.servos, 'bearing-bridge': HOLES.bridgeBearing, canopy: HOLES.canopyVents + HOLES.canopyMast,
      'boom-clamp': HOLES.clamp, 'boom-holder': HOLES.holder, skid: HOLES.skid, 'servo-mount': HOLES.servoMount,
    };
    const want = partSizes(cfg);
    for (const { p, pos } of parts) {
      const tag = `${name}/${p.id}`;
      const st = meshStats(pos);
      assert.ok(st, `${tag} closed`);
      assert.ok(fitsBed(st.sizeMm), `${tag} fits the bed`);
      [st.sizeMm.x, st.sizeMm.y, st.sizeMm.z].forEach((v, i) => assert.ok(Math.abs(v - want[p.id][i]) < 0.6, `${tag} size ${i}: ${v} vs ${want[p.id][i]}`));
      const t = analyzeMesh(pos)!;
      assert.equal(t.pieces, 1, `${tag} pieces`);
      assert.equal(t.throughHoles, expect[p.id], `${tag} through holes`);
      let zmin = Infinity;
      for (let i = 2; i < pos.length; i += 3) zmin = Math.min(zmin, pos[i]);
      assert.ok(Math.abs(zmin) < 1e-3, `${tag} rests on z = 0`);
      assert.equal(p.qty(cfg), p.id === 'side-frame' || p.id === 'bearing-bridge' || p.id === 'skid' ? 2 : p.id === 'servo-mount' ? +cfg.servos : 1);
    }
  }
});

test('prices come only from the mesh through quote.ts, and a longer body costs more', () => {
  const cost = (k: keyof typeof built) => built[k].parts.reduce((s, { p, pos }) => s + quote(meshStats(pos)!, p.material, 1).unitPrice * p.qty(built[k].cfg), 0);
  assert.ok(cost('max') > cost('min') && cost('min') > 0);
});

test('assembly: unique ids, every printed part is placed qty times, sensible joints, spin and bought placeholders', () => {
  for (const [name, { cfg }] of Object.entries(built)) {
    const parts = K.assembly(cfg);
    const ids = parts.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, `${name} unique ids`);
    for (const p of K.printedParts) assert.equal(parts.filter((a) => a.geometry === p.id).length, p.qty(cfg), `${name} ${p.id} placed qty times`);
    for (const a of parts) {
      assert.ok(a.size.every((v) => v > 0) && a.position.every(Number.isFinite) && a.explode.every(Number.isFinite), `${name} ${a.id}`);
      if (a.bought) assert.ok(a.material === 'bought' && a.geometry === undefined);
      else assert.ok(typeof a.geometry === 'string' && K.printedParts.some((p) => p.id === a.geometry && p.material === a.material), `${name} ${a.id} references a printed part`);
      if (a.joint) { assert.ok(a.joint.min <= 0 && a.joint.max >= 0 && a.joint.min >= -180 && a.joint.max <= 180 && a.joint.min < a.joint.max && Math.hypot(...a.joint.axis) > 0); }
      if (a.spin) assert.ok(Math.hypot(...a.spin.axis) > 0 && a.spin.rpm > 0);
    }
    assert.ok(parts.some((a) => a.joint) && parts.some((a) => a.spin && a.id === 'rotor-blades'), 'canopy hinge and spinning rotor');
    assert.equal(parts.filter((a) => a.id.startsWith('servo-mount-')).length, +cfg.servos);
    assert.equal(parts.filter((a) => /^servo-\d$/.test(a.id)).length, +cfg.servos);
    assert.ok(parts.find((a) => a.id === 'boom')!.size[2] > 20, 'boom has a length');
  }
});

test('blurb states the bought parts and its hole counts, with no prices or links', () => {
  const b = K.blurb;
  assert.match(b, /rotor head.*blades.*motors.*bought, never printed/i);
  for (const n of [HOLES.frameFixed, HOLES.canopyVents, HOLES.clamp, HOLES.holder]) assert.ok(b.includes(String(n)));
  assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(b + K.boughtParts.map((x) => x.name + x.spec).join(' ')));
  assert.ok(K.boughtParts.length >= 8 && K.boughtParts.every((x) => x.typical === true && x.qty >= 1));
  assert.equal(K.category, 'Drone & RC');
});
