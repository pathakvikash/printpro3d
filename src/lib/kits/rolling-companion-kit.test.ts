import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMesh } from '../meshAnalysis.ts';
import { buildMesh } from '../playground.ts';
import { fitsBed, meshStats, quote } from '../quote.ts';
import type { Cfg } from '../templateDefs.ts';
import { GENUS, KIT_ROLLING_COMPANION_KIT as K, RECESS, WINDOW, buildPart, placement, rawShapes, type PartId } from './rolling-companion-kit.ts';

const CONFIGS: Cfg[] = [K.config.defaults(), { diameter: 96, wall: 4, motor: 'n20-enc' }, { diameter: 110, wall: 2.4, motor: 'n20' }, { diameter: 104, wall: 3.2, motor: 'n20-enc' }];
const ids = K.printedParts.map((p) => p.id as PartId);

test('config: defaults valid, junk rejected', () => {
  assert.deepEqual(K.config.defaults(), { diameter: 100, wall: 2.4, motor: 'n20' });
  for (const c of CONFIGS) assert.deepEqual(K.config.validate(c), c);
  assert.throws(() => K.config.validate({ diameter: 90, wall: 2.4, motor: 'n20' }));
  assert.throws(() => K.config.validate({ diameter: 100, wall: 2.4, motor: 'n20', x: 1 }));
});

test('every part builds closed on the first CSG attempt, one piece, right holes, fits the bed, prices', () => {
  for (const cfg of CONFIGS) for (const id of ids) {
    const exact = buildMesh(rawShapes(id, cfg), { grow: false });
    assert.ok(exact && meshStats(exact), `${id} closed without retry ${JSON.stringify(cfg)}`);
    const b = buildPart(id, cfg);
    assert.ok(fitsBed(b.stats.sizeMm), `${id} fits the bed`);
    const t = analyzeMesh(b.print)!;
    assert.equal(t.pieces, 1, `${id} pieces`);
    assert.equal(t.throughHoles, GENUS(id), `${id} holes ${JSON.stringify(cfg)}`);
    const p = K.printedParts.find((x) => x.id === id)!;
    assert.ok(quote(b.stats, p.material, p.qty).total > 0);
  }
});

test('shells are a ball of the chosen diameter; the chassis and wheels sit inside it', () => {
  for (const cfg of CONFIGS) {
    const d = cfg.diameter as number;
    const f = buildPart('shell-front', cfg).stats.sizeMm, r = buildPart('shell-rear', cfg).stats.sizeMm;
    assert.ok(Math.abs(f.x - d) < 0.3 && Math.abs(r.x - d) < 0.3, 'shell diameter');
    const { ri, pb, deckZ, xw, wc } = placement(cfg);
    const inside = (m: Float32Array, z0: number) => {
      for (let i = 0; i < m.length; i += 3) {
        const x = m[i], y = m[i + 1], z = m[i + 2] + z0;
        assert.ok(Math.hypot(x, y, z) <= ri - 0.2, `${JSON.stringify(cfg)} point ${x},${y},${z} r=${Math.hypot(x, y, z)} ri=${ri}`);
      }
    };
    inside(buildPart('chassis', cfg).raw, pb);
    inside(buildPart('deck', cfg).raw, deckZ);
    // wheel (lens) outline: its lowest point touches the shell, none pokes out more than a TPU tyre compresses
    for (let a = 0; a < 360; a += 5) for (const dx of [-2.6, 0, 2.6]) {
      const rr = 13 * Math.sqrt(1 - (dx / 3.5) ** 2), p = [xw + dx, 7.1 + rr * Math.cos((a * Math.PI) / 180), wc + rr * Math.sin((a * Math.PI) / 180)];
      assert.ok(Math.hypot(p[0], p[1], p[2]) <= ri + 0.5, 'wheel within shell');
    }
  }
});

test('assembly geometry keys are the printed parts; blurb states the geometry; no prices', () => {
  const asm = K.assembly(K.config.defaults());
  for (const id of ids) assert.ok(asm.some((a) => a.geometry === id), id);
  assert.match(K.blurb, new RegExp(`${RECESS[0]} x ${RECESS[1]} mm recess`));
  assert.match(K.blurb, new RegExp(`${WINDOW[0]} x ${WINDOW[1]} mm window`));
  assert.ok(!/[$₹]|https?:|\d+\s?(usd|inr)/i.test(K.blurb + JSON.stringify(K.boughtParts)));
});
