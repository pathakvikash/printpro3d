import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblyBlueprint, assemblyData } from './assemblyBlueprint.ts';
import { KITS } from './kits.ts';
import { buildMesh } from './playground.ts';
import { templateById, normalizeCfg } from './templateDefs.ts';
import { buildTemplate } from './templates.ts';
import { partMesh } from './partModels.ts';
import { partById } from './parts.ts';
import { bounds } from './blueprint.ts';

const meshesFor = (kitId: string) => {
  const kit = KITS.find((k) => k.id === kitId)!;
  const meshes: Record<string, Float32Array | null> = {};
  for (const i of kit.items) {
    const t = templateById(i.templateId);
    if (t) meshes[i.templateId] = buildMesh(buildTemplate(t, normalizeCfg(t, i.config)).shapes);
  }
  return { kit, meshes };
};

for (const id of ['fpv-3in-kit', 'rover-kit']) {
  test(`${id}: every part in the BOM, bought flagged, balloons = distinct parts, bounds = union`, () => {
    const { kit, meshes } = meshesFor(id);
    const parts = kit.assembly!();
    const D = assemblyData(parts, meshes);
    const ids = new Set(D.bom.flatMap((r) => r.ids));
    for (const p of parts) assert.ok(ids.has(p.id), p.id);
    for (const r of D.bom) assert.equal(r.bought, r.material === 'Bought');
    assert.ok(D.bom.some((r) => r.bought) && D.bom.some((r) => !r.bought));
    const svg = assemblyBlueprint(parts, meshes, { name: kit.title });
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.equal((svg.match(/class="[bv] bl"/g) ?? []).length, D.bom.length);
    assert.ok(svg.includes('Assembly drawing — reference, not to scale for bought parts'));
    for (const d of [0, 1, 2]) {
      assert.equal(D.bounds.min[d], Math.min(...D.placed.map((p) => p.min[d])));
      assert.equal(D.bounds.max[d], Math.max(...D.placed.map((p) => p.max[d])));
    }
  });
}

test('reference models are used for bought parts when given', () => {
  const { kit, meshes } = meshesFor('fpv-3in-kit');
  const parts = kit.assembly!();
  const ref = (p: { id: string }) => (p.id === 'camera' ? partMesh(partById('camera-19')!) : null);
  const D = assemblyData(parts, meshes, ref);
  const cam = D.placed.find((p) => p.part.id === 'camera')!;
  const b = bounds(partMesh(partById('camera-19')!)!);
  assert.ok(Math.abs(cam.max[1] - cam.min[1] - b.size.y) < 0.01 || Math.abs(cam.max[1] - cam.min[1] - b.size.x) < 0.01);
});
