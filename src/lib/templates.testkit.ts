import assert from 'node:assert/strict';
import type { Cfg, TemplateDef } from './templateDefs.ts';
import { buildTemplate, templateMesh } from './templates.ts';
import { meshStats } from './quote.ts';
import { analyzeMesh } from './meshAnalysis.ts';

export const topology = (p: Float32Array) => { const t = analyzeMesh(p)!; return { pieces: t.pieces, genus: t.throughHoles }; };

export const claim = (t: TemplateDef, cfg: Cfg) => {
  const b = buildTemplate(t, cfg);
  const mesh = templateMesh(b.shapes);
  assert.ok(mesh, `${t.id} builds`);
  const stats = meshStats(mesh);
  assert.ok(stats, `${t.id} mesh is closed`);
  return { b, mesh, stats };
};
