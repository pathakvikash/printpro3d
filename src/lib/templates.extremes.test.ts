import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, defaultCfg, normalizeCfg, templateById, cfgKey, type Cfg, type TemplateDef } from './templateDefs.ts';
import { fitsBed } from './quote.ts';
import { claim, topology } from './templates.testkit.ts';

// Split from templates.test.ts so node --test runs the slow CSG sweeps in parallel processes.
test('config extremes and options still build closed meshes that fit and match', () => {
  const edge = (t: TemplateDef, pick: 'min' | 'max'): Cfg =>
    Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'range' ? f[pick] : f.default]));
  const cases: [string, Cfg][] = [];
  for (const t of TEMPLATES) {
    cases.push([t.id, edge(t, 'min')], [t.id, edge(t, 'max')]);
    for (const f of t.fields) {
      if (f.type === 'select') for (const o of f.options) cases.push([t.id, { ...defaultCfg(t), [f.key]: o.value }]);
      if (f.type === 'bool') cases.push([t.id, { ...defaultCfg(t), [f.key]: !f.default }]);
    }
  }
  for (const [id, raw] of cases) {
    const t = templateById(id)!;
    const cfg = normalizeCfg(t, raw, true);
    const { b, mesh, stats } = claim(t, cfg);
    const top = topology(mesh);
    const label = `${id} ${cfgKey(t, cfg)}`;
    assert.ok(fitsBed(stats.sizeMm), `${label} fits: ${JSON.stringify(stats.sizeMm)}`);
    assert.deepEqual([top.pieces, top.genus], [b.parts, b.holes], label);
  }
});

