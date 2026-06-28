'use client';

import { OrbitControls, MeshTransmissionMaterial, ContactShadows } from '@react-three/drei';
import { Suspense, useRef, useEffect, useState } from 'react';
import SafeCanvas from './WebGLCanvas';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

function FloatingShape() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.15;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.2;
      mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <mesh ref={mesh} scale={1.2}>
      <icosahedronGeometry args={[1, 1]} />
      <MeshTransmissionMaterial
        backside
        samples={4}
        thickness={0.5}
        chromaticAberration={0.1}
        anisotropicBlur={0.1}
        clearcoat={0.3}
        transparent
        opacity={0.85}
        color="#4f46e5"
      />
    </mesh>
  );
}

function WireframeSphere() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * -0.05;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <mesh ref={mesh} scale={2.5}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial wireframe color="#6366f1" transparent opacity={0.15} />
    </mesh>
  );
}

function PlaceholderScene() {
  return (
    <>
      <FloatingShape />
      <WireframeSphere />
    </>
  );
}

function StlModel({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { STLLoader } = await import('three-stdlib');
        if (cancelled) return;
        const loader = new STLLoader();
        loader.load(
          url,
          (geo) => {
            if (!cancelled) {
              geo.center();
              geo.computeVertexNormals();
              setGeometry(geo);
            }
          },
          undefined,
          () => setError(true)
        );
      } catch {
        setError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <PlaceholderScene />;
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} scale={0.5}>
      <meshStandardMaterial color="#6366f1" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

function ObjModel({ url }: { url: string }) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { OBJLoader } = await import('three-stdlib');
        if (cancelled) return;
        const loader = new OBJLoader();
        loader.load(
          url,
          (obj) => {
            if (!cancelled) {
              obj.scale.set(0.5, 0.5, 0.5);
              obj.position.set(0, 0, 0);
              obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: '#6366f1',
                    metalness: 0.3,
                    roughness: 0.6,
                  });
                }
              });
              setGroup(obj);
            }
          },
          undefined,
          () => setError(true)
        );
      } catch {
        setError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <PlaceholderScene />;
  if (!group) return null;
  return <primitive object={group} />;
}

function ModelContent({ url }: { url: string }) {
  const ext = url.split('.').pop()?.toLowerCase();

  if (ext === 'stl') return <StlModel url={url} />;
  if (ext === 'obj') return <ObjModel url={url} />;

  return <PlaceholderScene />;
}

function InnerScene({ url }: { url?: string }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#818cf8" />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#6366f1" />

      {url ? <ModelContent url={url} /> : <PlaceholderScene />}

      <ContactShadows position={[0, -1.8, 0]} opacity={0.4} scale={5} blur={2.5} />
      <OrbitControls
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={2}
      />
    </>
  );
}

export default function ModelViewer({ url }: { url?: string }) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950">
      <SafeCanvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <InnerScene url={url} />
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
