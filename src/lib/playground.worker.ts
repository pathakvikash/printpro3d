// Runs buildMesh (or templateMesh, for a shop template, or kitPartMesh, for a printed part of a kit) off the main thread so a big design cannot freeze the tab.
import { buildMesh, type Shape } from './playground.ts';
import { templateMesh } from './templates.ts';
import { kitPartMesh } from './kits/adapt.ts';
import type { Cfg } from './templateDefs.ts';

type Msg = { shapes?: Shape[]; template?: boolean; kit?: { key: string; cfg: Cfg } };
self.onmessage = async (e: MessageEvent<Msg>) => {
  try {
    const { shapes = [], template, kit } = e.data;
    const tris = kit ? await kitPartMesh(kit.key, kit.cfg) : template ? templateMesh(shapes) : buildMesh(shapes);
    (self as unknown as Worker).postMessage({ tris }, tris ? [tris.buffer] : []);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) });
  }
};
