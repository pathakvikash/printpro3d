// Fixed-price shop items joined to their example design, with size/weight computed from the mesh (never typed in).
import { CATALOG, shopVisible, type Item } from './catalog.ts';
import { exampleById, type Example } from './examples.ts';
import { buildMesh, solidsSize } from './playground.ts';
import { blueprintData } from './blueprint.ts';
import { MATERIALS, quote } from './quote.ts';

export type Product = { item: Item; ex: Example; dims: string };
const fmt = (n: number) => n.toFixed(1);
// products without a design are left out, so every card has a real 3D model
export const PRODUCTS: Product[] = shopVisible(CATALOG).flatMap((item) => {
  const ex = exampleById(item.exampleId);
  const s = ex ? solidsSize(ex.shapes) : null;
  return ex && s ? [{ item, ex, dims: `${fmt(s.x)} × ${fmt(s.y)} × ${fmt(s.z)} mm` }] : [];
});
export const productById = (id: string) => PRODUCTS.find((p) => p.item.id === id);

// the print mesh the price is computed from; built once per item, on first use
const meshes = new Map<string, Float32Array | null>();
export const meshOf = (p: Product) => {
  if (!meshes.has(p.item.id)) meshes.set(p.item.id, buildMesh(p.ex.shapes));
  return meshes.get(p.item.id) ?? null;
};
export const cachedMesh = (p: Product) => meshes.get(p.item.id); // undefined: not built yet
export const specOf = (p: Product, finish: string) => specFromMesh(p, meshOf(p), finish);
// same numbers from a mesh built elsewhere (the shop grid builds it in a worker so the CSG does not block the page)
export function specFromMesh(p: Product, m: Float32Array | null, finish: string) {
  if (m && !meshes.has(p.item.id)) meshes.set(p.item.id, m);
  const D = m ? blueprintData(m, p.item.material) : null;
  const grams = D?.stats && Object.hasOwn(MATERIALS, finish) ? quote(D.stats, finish, 1).grams : null;
  return { volume: D?.stats?.volumeCm3 ?? null, grams, layers: D?.layers ?? null };
}
