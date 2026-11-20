'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import SafeCanvas from './WebGLCanvas';
import { buildMesh, unitGeometry, solidsSize, type Shape } from '@/lib/playground';

const DEG = Math.PI / 180;

function Model({ shapes, spin, lift }: { shapes: Shape[]; spin: boolean; lift: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin && g.current) g.current.rotation.z += dt * 0.6; });
  // Show the real result (solids minus holes), so customers see the finished part, not the cutting tools.
  // Falls back to the plain solids if the shapes cannot be combined.
  const built = useMemo(() => {
    try {
      const tris = buildMesh(shapes);
      if (!tris) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(tris, 3));
      geo.computeVertexNormals();
      return geo;
    } catch {
      return null;
    }
  }, [shapes]);
  return (
    <group ref={g}>
      <group position={[0, 0, -lift]}>
        {built && (
          <mesh geometry={built}>
            <meshStandardMaterial color="#6366f1" metalness={0.2} roughness={0.55} />
          </mesh>
        )}
        {!built && shapes.filter((s) => s.mode === 'solid').map((s) => (
          <mesh
            key={s.id}
            geometry={unitGeometry(s.kind)}
            position={[s.position.x, s.position.y, s.position.z]}
            rotation={[s.rotation.x * DEG, s.rotation.y * DEG, s.rotation.z * DEG]}
            scale={[s.size.x, s.size.y, s.size.z]}
          >
            <meshStandardMaterial color="#6366f1" metalness={0.2} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Small live preview of an example: the finished part in indigo. Static when the visitor prefers reduced motion.
 * interactive: drag to rotate, scroll or pinch to zoom, and no spin. */
export default function ExamplePreview({ shapes, reduceMotion, interactive = false }: { shapes: Shape[]; reduceMotion: boolean; interactive?: boolean }) {
  const size = solidsSize(shapes) ?? { x: 20, y: 20, z: 20 };
  const d = Math.max(size.x, size.y, size.z) * 1.9;
  return (
    <SafeCanvas
      frameloop={reduceMotion ? 'demand' : 'always'}
      dpr={[1, 1.5]}
      camera={{ position: [d * 0.8, -d, d * 0.75], up: [0, 0, 1], fov: 40, near: 1, far: 2000 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, -120, 200]} intensity={1.1} />
      <directionalLight position={[-120, 60, 40]} intensity={0.35} color="#818cf8" />
      <Model shapes={shapes} spin={!reduceMotion && !interactive} lift={size.z / 2} />
      {interactive && <OrbitControls />}
    </SafeCanvas>
  );
}
