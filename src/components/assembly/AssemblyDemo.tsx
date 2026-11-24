'use client';
// Demo kit for /playground: the drone frame plate and camera mount from the repo's own meshes, four bought motors (spinning)
// and a bought battery. Shows what any multi-part kit gets from AssemblyViewer by filling in AssemblyPart[].
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import AssemblyViewer from './AssemblyViewer';
import { prepGeometry } from '@/components/PrintMaterial';
import { EXAMPLES } from '@/lib/examples';
import type { AssemblyPart, V3 } from '@/lib/assembly';

const geo = (tris: Float32Array | null) => {
  if (!tris) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(tris, 3));
  return prepGeometry(g);
};
const dims = (g: THREE.BufferGeometry): V3 => { const b = g.boundingBox!; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; };

export default function AssemblyDemo() {
  const [geos, setGeos] = useState<{ plate: THREE.BufferGeometry; mount: THREE.BufferGeometry | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    const made: THREE.BufferGeometry[] = [];
    (async () => {
      const [{ buildOffThread }, { buildTemplate }, { templateById, defaultCfg, normalizeCfg }] = await Promise.all([import('@/lib/buildOffThread'), import('@/lib/templates'), import('@/lib/templateDefs')]);
      const ex = EXAMPLES.find((e) => e.id === 'drone-plate');
      const t = templateById('drone-camera-mount');
      const plate = geo(ex ? await buildOffThread(ex.shapes) : null);
      const mount = t ? geo(await buildOffThread(buildTemplate(t, normalizeCfg(t, defaultCfg(t))).shapes, true)) : null;
      for (const g of [plate, mount]) if (g) made.push(g);
      if (!on) return;
      if (plate) setGeos({ plate, mount }); else setFailed(true);
    })().catch(() => on && setFailed(true));
    return () => { on = false; made.forEach((g) => g.dispose()); };
  }, []);

  const parts = useMemo<AssemblyPart[] | null>(() => {
    if (!geos) return null;
    const [px, py, pz] = dims(geos.plate);
    const list: AssemblyPart[] = [{ id: 'plate', label: 'Frame plate', geometry: geos.plate, material: 'PETG', size: [px, py, pz], position: [0, 0, pz / 2], rotation: [0, 0, 0], explode: [0, 0, 0] }];
    const motor: V3 = [22, 22, 12];
    for (const [i, [sx, sy]] of ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).entries()) {
      list.push({ id: `motor${i}`, label: `Motor ${i + 1}`, material: 'bought', bought: true, shape: 'cylinder', size: motor, position: [sx * 28, sy * 28, pz + motor[2] / 2], rotation: [0, 0, 0], explode: [sx * 22, sy * 22, 30], spin: { axis: [0, 0, 1], rpm: i % 2 ? 60 : -60 } });
    }
    list.push({ id: 'battery', label: 'Battery', material: 'bought', bought: true, size: [55, 28, 20], position: [0, -12, pz + 10], rotation: [0, 0, 0], explode: [0, -30, 55] });
    if (geos.mount) {
      const [mx, my, mz] = dims(geos.mount);
      const y = 3 + my / 2;
      list.push({ id: 'mount', label: 'Camera mount', geometry: geos.mount, material: 'TPU', size: [mx, my, mz], position: [0, y, pz + mz / 2], rotation: [0, 0, 0], explode: [0, 30, 55], joint: { axis: [1, 0, 0], pivot: [0, y - my / 2, pz], min: 0, max: 35 } });
    }
    return list;
  }, [geos]);

  if (failed) return <p role="status" className="text-sm text-amber-700 dark:text-amber-300">The demo parts could not be built here.</p>;
  if (!parts) return <div role="status" aria-label="Building the demo parts" className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" />;
  return <AssemblyViewer parts={parts} />;
}
