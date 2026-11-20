// Runs buildMesh off the main thread so a big design cannot freeze the tab.
import { buildMesh, type Shape } from './playground.ts';

self.onmessage = (e: MessageEvent<Shape[]>) => {
  try {
    const tris = buildMesh(e.data);
    (self as unknown as Worker).postMessage({ tris }, tris ? [tris.buffer] : []);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) });
  }
};
