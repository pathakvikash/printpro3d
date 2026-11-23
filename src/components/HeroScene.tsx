'use client';

import { Suspense, useRef } from 'react';
import SafeCanvas from './WebGLCanvas';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

// Solid slate print-like surface: reads on both the light and the dark hero.
function TorusKnot() {
  const mesh = useRef<THREE.Mesh>(null);
  const wide = useThree((st) => st.size.width >= 1024);
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.1;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.15;
      mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15;
    }
  });

  return (
    <mesh ref={mesh} scale={wide ? 1.1 : 0.85} position-x={wide ? 2.2 : 0}>
      <torusKnotGeometry args={[1, 0.35, 128, 16]} />
      <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.15} />
    </mesh>
  );
}

export default function HeroScene() {
  return (
    <div className="w-full h-full absolute inset-0">
      <SafeCanvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, 5, 5]} intensity={1.6} />
          <directionalLight position={[-5, -3, 3]} intensity={0.6} />
          <TorusKnot />
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
