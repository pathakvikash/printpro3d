import test from 'node:test';
import assert from 'node:assert/strict';
import { blueprint, blueprintData } from './blueprint.ts';
import { buildMesh } from './playground.ts';
import { exampleById } from './examples.ts';
import { CATALOG } from './catalog.ts';
import { LAYER_MM } from './printSpec.ts';

const mesh = (id: string) => buildMesh(exampleById(id)!.shapes)!;

test('pi-case: 90 x 62 x 12 mm, 21.83 cm3, 60 layers', () => {
  const D = blueprintData(mesh('pi-case'), 'PETG');
  assert.ok(D.stats);
  for (const [got, want] of [[D.size.x, 90], [D.size.y, 62], [D.size.z, 12]]) assert.ok(Math.abs(got - want) < 0.01, `${got} vs ${want}`);
  assert.ok(Math.abs(D.stats.volumeCm3 - 21.83) < 0.05, String(D.stats.volumeCm3));
  assert.equal(LAYER_MM, 0.2);
  assert.equal(D.layers, 60);
  assert.ok(D.fits);
  const svg = blueprint(mesh('pi-case'), { name: 'Raspberry Pi case base', id: 'pi-case', material: 'PETG' });
  assert.ok(svg.includes('90.0 × 62.0 × 12.0 mm') && svg.includes('60 at 0.2 mm') && svg.includes('Not a tolerance guarantee.'));
});

test('all catalog items produce a valid SVG', () => {
  assert.equal(CATALOG.length, 7);
  for (const it of CATALOG) {
    const svg = blueprint(mesh(it.exampleId), { name: it.name, id: it.id, material: it.material });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), it.id);
    assert.ok(!/NaN|Infinity|undefined/.test(svg), `${it.id} has a bad number`);
    assert.ok((svg.match(/<path class="v" d="M/g) ?? []).length === 3, `${it.id} has three views with linework`);
  }
});

test('layers follow the modelled pose when it fits: a pawn stays upright', () => {
  for (const id of ['pawn', 'shelf-bracket']) {
    const D = blueprintData(mesh(id), 'PLA');
    assert.equal(D.orientation, 'Flat base on the bed (Z up)', id);
    assert.equal(D.layers, Math.round(D.size.z / LAYER_MM), id);
  }
  assert.equal(blueprintData(mesh('pawn'), 'PLA').layers, 205);
});

test('pi-case text matches the model: mounting holes, no posts', () => {
  const text = CATALOG.find((i) => i.id === 'pi-case')!.description + ' ' + exampleById('pi-case')!.blurb;
  assert.ok(!/post/i.test(text), 'the mesh has holes, not posts');
  assert.ok(/four mounting holes/.test(text));
  const holes = exampleById('pi-case')!.shapes.filter((s) => s.mode === 'hole' && s.kind === 'cylinder');
  assert.equal(holes.length, 4);
});

test('material card swatches use the same colours as the 3D print presets', async () => {
  const { readFile } = await import('node:fs/promises');
  const grab = async (f: string, re: RegExp) => Object.fromEntries([...(await readFile(new URL(f, import.meta.url), 'utf8')).matchAll(re)].map((m) => [m[1], m[2]]));
  const cards = await grab('../components/MaterialCards.tsx', /(PLA|PETG|ABS|TPU): '(#[0-9a-f]{6})'/g);
  const presets = await grab('../components/PrintMaterial.tsx', /(PLA|PETG|ABS|TPU): \{ color: '(#[0-9a-f]{6})'/g);
  assert.equal(Object.keys(cards).length, 4);
  assert.deepEqual(cards, presets);
});

test('phone stand and cable clip texts match their meshes', () => {
  const text = (id: string) => CATALOG.find((i) => i.id === id)!.description + ' ' + exampleById(id)!.blurb;
  // the cable opening is a round hole through the base
  const hole = exampleById('phone-stand')!.shapes.find((s) => s.mode === 'hole')!;
  assert.equal(hole.kind, 'cylinder');
  assert.ok(!/notch/i.test(text('phone-stand')) && /hole in the base/.test(text('phone-stand')));
  // the ring axis is Z (upright), so the cable runs up through it, not along the desk
  const ring = exampleById('cable-clip')!.shapes.find((s) => s.kind === 'cylinder' && s.mode === 'solid')!;
  assert.deepEqual(ring.rotation, { x: 0, y: 0, z: 0 });
  assert.ok(!/against a desk/i.test(text('cable-clip')) && /slot/.test(text('cable-clip')));
});
