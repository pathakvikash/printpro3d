import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, normalizeCfg, cfgKey } from './templateDefs.ts';
import { fitsBed } from './quote.ts';
import { claim, topology } from './templates.testkit.ts';

// Split from templates.test.ts so node --test runs the slow CSG sweeps in parallel processes.
test('seeded random configs build closed, fitting meshes whose pieces and holes match the description', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const t of TEMPLATES) {
    for (let i = 0; i < 6; i++) {
      const raw = Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f.min + rnd() * (f.max - f.min) : f.type === 'select' ? f.options[Math.floor(rnd() * f.options.length)].value : rnd() < 0.5]));
      const cfg = normalizeCfg(t, raw, true);
      const { b, mesh, stats } = claim(t, cfg);
      const top = topology(mesh);
      assert.ok(fitsBed(stats.sizeMm), `${t.id} ${cfgKey(t, cfg)}`);
        assert.deepEqual([top.pieces, top.genus], [b.parts, b.holes], `${t.id} ${cfgKey(t, cfg)}`);
    }
  }
});

