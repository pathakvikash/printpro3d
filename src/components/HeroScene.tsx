'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import SafeCanvas from './WebGLCanvas';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial, ContactShadows } from '@react-three/drei';

// Tracks the html `dark` class (set by the theme toggle).
function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

// what the glass refracts: the canvas is transparent, so give it an indigo backdrop to read on dark
const GLASS_BG = new THREE.Color('#4f46e5');

function TorusKnot({ dark }: { dark: boolean }) {
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
    <mesh ref={mesh} scale={wide ? 1.1 : 0.8} position-x={wide ? 2.2 : 1.1}>
      <torusKnotGeometry args={[1, 0.35, 128, 16]} />
      {dark ? (
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.8}
          chromaticAberration={0.15}
          anisotropicBlur={0.2}
          clearcoat={0.4}
          color="#c7d2fe"
          background={GLASS_BG}
          roughness={0.1}
          metalness={0.2}
        />
      ) : (
        <meshStandardMaterial color="#4f5b93" roughness={0.45} metalness={0.2} />
      )}
    </mesh>
  );
}

function OrbitingParticles({ count, color, opacity }: { count: number; color: string; opacity: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 1.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [count]);
  const wide = useThree((st) => st.size.width >= 1024);

  useFrame((state) => {
    if (pointsRef.current) pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <points ref={pointsRef} geometry={geometry} position-x={wide ? 2.2 : 1.1}>
      <pointsMaterial size={0.05} color={color} transparent opacity={opacity} sizeAttenuation />
    </points>
  );
}

export default function HeroScene() {
  const dark = useDark();
  return (
    <div className="w-full h-full absolute inset-0">
      <SafeCanvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={dark ? 0.8 : 0.9} />
          <directionalLight position={[5, 5, 5]} intensity={dark ? 1.6 : 1.6} />
          <directionalLight position={[-5, -3, 3]} intensity={0.8} color="#818cf8" />
          <pointLight position={[0, 2, 2]} intensity={dark ? 40 : 0} color="#6366f1" />
          <TorusKnot dark={dark} />
          {dark ? (
            <>
              <OrbitingParticles count={80} color="#a5b4fc" opacity={0.8} />
              <ContactShadows position={[0, -2.2, 0]} opacity={0.4} scale={6} blur={3} color="#6366f1" />
            </>
          ) : (
            <OrbitingParticles count={20} color="#4f46e5" opacity={0.5} />
          )}
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
