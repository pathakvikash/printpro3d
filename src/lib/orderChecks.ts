// Pure checks for /api/orders, kept out of the route file so they can be tested. No fs, no React.
import type { Item } from './catalog.ts';
import { MAX_QTY } from './quote.ts';

// the same model extensions /api/upload accepts (upload names keep their extension)
const MODEL_RE = /\.(stl|obj|glb|gltf|3mf)$/i;
export const isModelFile = (name: string) => MODEL_RE.test(name);

// One checked entry of an order request. `n` is its 1-based position, for error messages.
export type Checked =
  | { n: number; kind: 'shop'; item: Item; qty: number }
  | { n: number; kind: 'model'; file: string; material: string; qty: number };

// Same shop item, or same upload + material, becomes one line with the summed quantity.
// A sum over MAX_QTY is refused, not capped: the customer must get the quantity they asked for.
export function mergeChecked(reqs: Checked[]): Checked[] {
  const out: Checked[] = [];
  const at = new Map<string, number>();
  for (const r of reqs) {
    const key = JSON.stringify(r.kind === 'shop' ? ['shop', r.item.id] : ['model', r.file, r.material]);
    const i = at.get(key);
    if (i === undefined) {
      at.set(key, out.length);
      out.push(r);
      continue;
    }
    const cur = out[i];
    const qty = cur.qty + r.qty;
    if (qty > MAX_QTY) throw new Error(`item ${r.n}: quantity over ${MAX_QTY} after merging`);
    out[i] = { ...cur, qty };
  }
  return out;
}
