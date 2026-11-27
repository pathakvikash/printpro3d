'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PrintMesh, PrintStage, STAGE_BG, StageLoading, prepGeometry, useReducedMotion, type StageOptions } from './PrintMaterial';
import type { MaterialKey } from '@/lib/quote';
import { scalePositions } from '@/lib/blueprint';

// A fresh geometry from a triangle soup; with scaleTo, a scaled copy whose longest side is scaleTo mm (the source array is never touched).
function fromPositions(p: Float32Array, scaleTo?: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(scaleTo ? scalePositions(p, scaleTo) : p.slice(), 3));
  return prepGeometry(g);
}

function useGeometry(url: string, ext: 'stl' | 'obj', scaleTo?: number) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await import('three-stdlib');
        if (cancelled) return;
        const done = (g: THREE.BufferGeometry) => {
          if (cancelled) return;
          const a = g.getAttribute('position').array as Float32Array;
          setGeometry(scaleTo ? fromPositions(a, scaleTo) : prepGeometry(g));
        };
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
  }, [url, ext, scaleTo]);
  return { geometry, error };
}

// onPositions: hands the loaded triangle soup (mm) to the parent, e.g. for the blueprint; material: the finish shown (the quote's pick, PLA by default like the quote)
// positions: show a triangle soup already in memory instead of loading url; scaleTo: show (and report) a copy scaled so its longest side is that many mm
export default function ModelViewer({ url, positions, scaleTo, onPositions, material = 'PLA', className = 'h-full min-h-[320px] sm:min-h-[400px]', stage }: { stage?: StageOptions; url?: string; positions?: Float32Array | null; scaleTo?: number; onPositions?: (p: Float32Array) => void; material?: MaterialKey; className?: string }) {
  const reduce = useReducedMotion();
  const ext = url?.split('.').pop()?.toLowerCase();
  const kind = ext === 'stl' || ext === 'obj' ? ext : null;
  const loaded = useGeometry(!positions && kind ? url! : '', kind ?? 'stl', scaleTo);
  const own = useMemo(() => (positions && positions.length >= 9 ? fromPositions(positions, scaleTo) : null), [positions, scaleTo]);
  const geometry = own ?? loaded.geometry;
  const error = loaded.error;
  useEffect(() => {
    const a = geometry?.getAttribute('position')?.array;
    if (a && onPositions) onPositions(a as Float32Array);
  }, [geometry, onPositions]);
  const size = useMemo(() => {
    const b = geometry?.boundingBox;
    return b ? { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z } : { x: 40, y: 40, z: 40 };
  }, [geometry]);
  const pending = !geometry && !error && !!(kind || positions);
  return (
    <div className={`relative w-full rounded-xl overflow-hidden ${STAGE_BG} ${className}`}>
      {/* the stage mounts once the geometry is ready, then the canvas fades in; key: refit the camera when a different model loads */}
      <div className={`h-full w-full transition-opacity duration-250 motion-reduce:transition-none ${geometry ? 'opacity-100' : 'opacity-0'}`}>
        {geometry && <PrintStage key={geometry.uuid} size={size} material={material} interactive reduceMotion={reduce} stage={stage}><PrintMesh geometry={geometry} /></PrintStage>}
      </div>
      {!geometry && <StageLoading reduce={reduce} text={pending ? undefined : error ? 'Could not load the 3D model' : 'No 3D preview'} />}
    </div>
  );
}
