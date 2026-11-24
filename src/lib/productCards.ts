// The fixed-price items a /shop card needs, without shopProducts.ts (which pulls three and the CSG through playground.ts).
// shopProducts.test.ts checks it lists the same items as PRODUCTS. Size and weight come from the mesh the card builds in a worker.
import { CATALOG, shopVisible, type Item } from './catalog.ts';
import { exampleById, type Example } from './examples.ts';

export type ProductCard = { item: Item; ex: Example };
export const PRODUCT_CARDS: ProductCard[] = shopVisible(CATALOG).flatMap((item) => {
  const ex = exampleById(item.exampleId);
  return ex && ex.shapes.some((s) => s.mode === 'solid') ? [{ item, ex }] : [];
});
