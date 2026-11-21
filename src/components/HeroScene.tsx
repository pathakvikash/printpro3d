'use client';

import { OrbitControls, MeshTransmissionMaterial, ContactShadows } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import SafeCanvas from './WebGLCanvas';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

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
      <MeshTransmissionMaterial
        backside
        samples={4}
        thickness={0.8}
        chromaticAberration={0.15}
        anisotropicBlur={0.2}
        clearcoat={0.4}
        transparent
        opacity={0.8}
        color="#6366f1"
        roughness={0.1}
        metalness={0.2}
      />
    </mesh>
  );
}

function OrbitingParticles() {
  const count = 80;
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 1.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        color="#818cf8"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

export default function HeroScene() {
  return (
    <div className="w-full h-full absolute inset-0">
      <SafeCanvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <directionalLight position={[-5, -5, -5]} intensity={0.2} color="#818cf8" />
          <pointLight position={[0, 2, 2]} intensity={0.3} color="#6366f1" />
          <TorusKnot />
          <OrbitingParticles />
          <ContactShadows
            position={[0, -2.2, 0]}
            opacity={0.25}
            scale={6}
            blur={3}
            color="#6366f1"
          />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            enableRotate={false}
            autoRotate={false}
          />
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
