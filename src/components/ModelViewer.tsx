'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PrintMesh, PrintStage, prepGeometry, useReducedMotion } from './PrintMaterial';

function useGeometry(url: string, ext: 'stl' | 'obj') {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await import('three-stdlib');
        if (cancelled) return;
        const done = (g: THREE.BufferGeometry) => { if (!cancelled) setGeometry(prepGeometry(g)); };
        if (ext === 'stl') new lib.STLLoader().load(url, done, undefined, () => setError(true));
        else new lib.OBJLoader().load(url, (obj) => {
          const parts: THREE.BufferGeometry[] = [];
          obj.updateMatrixWorld(true);
          obj.traverse((c) => {
            if (!(c instanceof THREE.Mesh)) return;
            const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()) as THREE.BufferGeometry;
            for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n);
            parts.push(g.applyMatrix4(c.matrixWorld));
          });
          const merged = lib.mergeBufferGeometries(parts);
          if (merged) done(merged); else setError(true);
        }, undefined, () => setError(true));
      } catch {
        setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, ext]);
  return { geometry, error };
}

function PlaceholderScene() {
  return (
    <mesh position={[0, 0, 20]}>
      <icosahedronGeometry args={[20, 1]} />
      <meshStandardMaterial color="#6366f1" roughness={0.5} />
    </mesh>
  );
}

// onPositions: hands the loaded triangle soup (mm) to the parent, e.g. for the blueprint
export default function ModelViewer({ url, onPositions }: { url?: string; onPositions?: (p: Float32Array) => void }) {
  const reduce = useReducedMotion();
  const ext = url?.split('.').pop()?.toLowerCase();
  const kind = ext === 'stl' || ext === 'obj' ? ext : null;
  const { geometry, error } = useGeometry(kind ? url! : '', kind ?? 'stl');
  useEffect(() => {
    const a = geometry?.getAttribute('position')?.array;
    if (a && onPositions) onPositions(a as Float32Array);
  }, [geometry, onPositions]);
  const size = useMemo(() => {
    const b = geometry?.boundingBox;
    return b ? { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z } : { x: 40, y: 40, z: 40 };
  }, [geometry]);
  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden">
      {/* key: refit the camera when a different model loads */}
      <PrintStage key={geometry?.uuid ?? 'none'} size={size} interactive reduceMotion={reduce}>
        {geometry ? <PrintMesh geometry={geometry} /> : (!kind || error) && <PlaceholderScene />}
      </PrintStage>
    </div>
  );
}
