// Pure helpers for drag-and-drop building in the Playground: grid snap, template -> grouped shapes, moving / turning / copying a group.
// A group is the set of shapes sharing `group` (one dropped template); a loose shape is a group of one. Same Z-up mm space as playground.ts.
import { Euler, Quaternion, Vector3 } from 'three';
import { minZ, worldVertices, type Shape, type V3 } from './playground.ts';

export const GRID_MM = 5;
export const NUDGE_MM = 5;
export const NUDGE_FINE_MM = 1;

/** Nearest grid line (never -0). */
export const snapGrid = (v: number, step = GRID_MM) => Math.round(v / step) * step + 0;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Ids of the shapes that move together with `id`: its whole group, or just itself. */
export function membersOf(shapes: Shape[], id: string): string[] {
  const s = shapes.find((o) => o.id === id);
  if (!s) return [];
  return s.group ? shapes.filter((o) => o.group === s.group).map((o) => o.id) : [id];
}

function centreXY(shapes: Shape[]): { x: number; y: number } {
  const vs = shapes.flatMap(worldVertices);
  const xs = vs.map((v) => v.x), ys = vs.map((v) => v.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** A built template as grouped shapes, its footprint centred on the grid point nearest `at` and its lowest solid on the plate (z = 0).
 * Ids get a `~group` suffix, so a shape id that starts with LATE keeps that prefix. */
export function placeTemplate(built: Shape[], tpl: string, group: string, at: { x: number; y: number }): Shape[] {
  const solids = built.filter((s) => s.mode === 'solid');
  const c = centreXY(solids.length ? solids : built);
  const dx = snapGrid(at.x) - c.x, dy = snapGrid(at.y) - c.y;
  const dz = -Math.min(...(solids.length ? solids : built).map(minZ));
  return built.map((s) => ({
    ...s, id: `${s.id}~${group}`, group, tpl,
    position: { x: r3(s.position.x + dx), y: r3(s.position.y + dy), z: r3(s.position.z + dz) },
    rotation: { ...s.rotation }, size: { ...s.size },
  }));
}

export function moveBy(shapes: Shape[], ids: string[], d: V3): Shape[] {
  return shapes.map((s) => (ids.includes(s.id) ? { ...s, position: { x: r3(s.position.x + d.x), y: r3(s.position.y + d.y), z: r3(s.position.z + d.z) } } : s));
}

/** Turn the shapes 90 degrees about Z (counter-clockwise seen from above) around the centre of their footprint, as one rigid body. */
export function rotateZ90(shapes: Shape[], ids: string[]): Shape[] {
  const mine = shapes.filter((s) => ids.includes(s.id));
  if (!mine.length) return shapes;
  const c = centreXY(mine);
  const d = Math.PI / 180, qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  return shapes.map((s) => {
    if (!ids.includes(s.id)) return s;
    const q = qz.clone().multiply(new Quaternion().setFromEuler(new Euler(s.rotation.x * d, s.rotation.y * d, s.rotation.z * d, 'XYZ')));
    const e = new Euler().setFromQuaternion(q, 'XYZ');
    return {
      ...s,
      position: { x: r3(c.x - (s.position.y - c.y)), y: r3(c.y + (s.position.x - c.x)), z: s.position.z },
      rotation: { x: r3(e.x / d + 0), y: r3(e.y / d + 0), z: r3(e.z / d + 0) },
    };
  });
}

/** Copies of the shapes, offset by `off`; a group gets a new group id so the copy is its own group. `uid` makes a fresh id. */
export function cloneShapes(shapes: Shape[], ids: string[], off: V3, uid: () => string): Shape[] {
  const group = uid();
  return shapes.filter((s) => ids.includes(s.id)).map((s) => ({
    ...s, id: `${s.id.startsWith('late') ? 'late' : ''}${uid()}`, ...(s.group ? { group } : {}),
    position: { x: r3(s.position.x + off.x), y: r3(s.position.y + off.y), z: r3(s.position.z + off.z) },
    rotation: { ...s.rotation }, size: { ...s.size },
  }));
}
