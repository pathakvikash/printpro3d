'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { PrintMesh, PrintStage, prepGeometry } from './PrintMaterial';
import { buildMesh, unitGeometry, solidsSize, type Shape } from '@/lib/playground';
import type { MaterialKey } from '@/lib/quote';

const DEG = Math.PI / 180;

/** The finished part (solids minus holes) as one print-ready geometry, or null if the shapes cannot be combined. */
export function useBuiltGeometry(shapes: Shape[]) {
  return useMemo(() => {
    try {
      const tris = buildMesh(shapes);
      if (!tris) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(tris, 3));
      return prepGeometry(geo);
    } catch {
      return null;
    }
  }, [shapes]);
}

/** Live preview of an example as a printed part: layer lines, studio light, draggable turntable.
 * Static when the visitor prefers reduced motion. interactive (the dialog): zoom, Solid / Mesh / Layers, print bed. */
export default function ExamplePreview({ shapes, reduceMotion, interactive = false, material = 'PETG' }: {
  shapes: Shape[]; reduceMotion: boolean; interactive?: boolean; material?: MaterialKey;
}) {
  const size = solidsSize(shapes) ?? { x: 20, y: 20, z: 20 };
  const built = useBuiltGeometry(shapes);
  return (
    <PrintStage size={size} material={material} interactive={interactive} reduceMotion={reduceMotion}>
      {built ? <PrintMesh geometry={built} /> : (
        // fallback: the plain solids (all sit on z = 0 by catalog rule)
        shapes.filter((s) => s.mode === 'solid').map((s) => (
          <group key={s.id} position={[s.position.x, s.position.y, s.position.z]} rotation={[s.rotation.x * DEG, s.rotation.y * DEG, s.rotation.z * DEG]} scale={[s.size.x, s.size.y, s.size.z]}>
            <PrintMesh geometry={unitGeometry(s.kind)} />
          </group>
        ))
      )}
    </PrintStage>
  );
}
