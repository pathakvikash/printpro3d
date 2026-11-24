// Runs buildMesh (or templateMesh, for a shop template) off the main thread so a big design cannot freeze the tab.
import { buildMesh, type Shape } from './playground.ts';
import { templateMesh } from './templates.ts';

self.onmessage = (e: MessageEvent<{ shapes: Shape[]; template?: boolean }>) => {
  try {
    const tris = e.data.template ? templateMesh(e.data.shapes) : buildMesh(e.data.shapes);
    (self as unknown as Worker).postMessage({ tris }, tris ? [tris.buffer] : []);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) });
  }
};
