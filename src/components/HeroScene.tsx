'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import SafeCanvas from './WebGLCanvas';
import { PrintMesh, StudioLight, TRUE_LAYER_MM, useDark } from './PrintMaterial';
import { useBuiltGeometry } from './ExamplePreview';
import { EXAMPLES } from '@/lib/examples';
import { solidsSize } from '@/lib/playground';
import { buildOffThread } from '@/lib/buildOffThread';

const PART = EXAMPLES.find((e) => e.id === 'drone-plate') ?? EXAMPLES[0];

// A real catalog part, slowly turning beside the hero text.
function Part() {
  const g = useRef<THREE.Group>(null);
  const wide = useThree((st) => st.size.width >= 1024);
  // CSG in the worker: on a phone it was a ~1 s main-thread task on the home page
  const [mesh, setMesh] = useState<Float32Array | null>(null);
  useEffect(() => {
    let on = true;
    buildOffThread(PART.shapes).then((m) => on && setMesh(m), () => {});
    return () => { on = false; };
  }, []);
  const geo = useBuiltGeometry(PART.shapes, mesh);
  const size = useMemo(() => solidsSize(PART.shapes) ?? { x: 40, y: 40, z: 10 }, []);
  const k = (wide ? 3 : 1.6) / Math.max(size.x, size.y);
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    g.current.rotation.z = t * 0.25;
    g.current.rotation.x = Math.sin(t * 0.4) * 0.12;
  });
  if (!geo) return null;
  return (
    <group position={[wide ? 2.2 : 1.1, 0, 0]}>
      <group ref={g} scale={k} position={[0, 0, -size.z * k * 0.5]}>
        <PrintMesh geometry={geo} material="PETG" layerMm={TRUE_LAYER_MM * 3} view="solid" clipZ={1e4} />
      </group>
    </group>
  );
}

export default function HeroScene() {
  const dark = useDark();
  return (
    <div className="w-full h-full absolute inset-0">
      <SafeCanvas camera={{ position: [0, -5.5, 2.6], up: [0, 0, 1], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <StudioLight dark={dark} />
          <Part />
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
