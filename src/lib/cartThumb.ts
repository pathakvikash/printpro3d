// Flat silhouette of a cart line's part (no WebGL). Heavy (meshes and CSG): CartThumb loads this module only after the page shows,
// so /cart's first load has no three in it. Builds run one at a time and are cached per line.
import { buildOffThread, kitMeshOffThread } from './buildOffThread.ts';
import { exampleById } from './examples.ts';
import { CATALOG } from './catalog.ts';
import { lineKey, type CartLine } from './cart.ts';
import { meshThumb } from './partModels.ts';
import { buildTemplate } from './templates.ts';
import { normalizeCfg, templateById } from './templateDefs.ts';

export type Thumb = { d: string; vb: string } | null;
const done = new Map<string, Thumb>();
let queue: Promise<unknown> = Promise.resolve();

async function build(l: CartLine): Promise<Thumb> {
  if (l.kind === 'shop') {
    const ex = exampleById(CATALOG.find((i) => i.id === l.id)?.exampleId);
    return ex ? meshThumb(await buildOffThread(ex.shapes, false)) : null;
  }
  if (l.kind === 'tpl') {
    const t = templateById(l.id);
    return t ? meshThumb(await buildOffThread(buildTemplate(t, normalizeCfg(t, l.cfg)).shapes, true)) : null;
  }
  if (l.kind === 'kit') return meshThumb(await kitMeshOffThread(l.id, l.cfg));
  return null; // uploads and designs have no mesh in the browser
}

export function lineThumb(l: CartLine): Promise<Thumb> {
  const k = lineKey(l);
  if (done.has(k)) return Promise.resolve(done.get(k)!);
  const run = queue.then(() => build(l).catch(() => null)).then((t) => (done.set(k, t), t));
  queue = run;
  return run;
}
