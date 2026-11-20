'use client';

import { useMemo, useState } from 'react';
import { Edges, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import SafeCanvas from '../WebGLCanvas';
import { BED_MM } from '@/lib/quote';
import { MIN_SIZE, unitGeometry, type Shape } from '@/lib/playground';

export type Tool = 'translate' | 'rotate' | 'scale';
export type Pose = Pick<Shape, 'position' | 'rotation' | 'size'>;

const DEG = Math.PI / 180;
const r = (v: number, k = 1000) => Math.round(v * k) / k;

// Z is up here exactly as in the exported STL: the plate is the XY plane centred on the origin.
function Plate() {
  const { grid, box } = useMemo(() => {
    const pts: number[] = [];
    for (let x = -BED_MM.x / 2; x <= BED_MM.x / 2 + 1e-6; x += 10) pts.push(x, -BED_MM.y / 2, 0, x, BED_MM.y / 2, 0);
    for (let y = -BED_MM.y / 2; y <= BED_MM.y / 2 + 1e-6; y += 10) pts.push(-BED_MM.x / 2, y, 0, BED_MM.x / 2, y, 0);
    const grid = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(BED_MM.x, BED_MM.y, BED_MM.z));
    return { grid, box };
  }, []);
  return (
    <>
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[BED_MM.x, BED_MM.y]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#818cf8" transparent opacity={0.3} />
      </lineSegments>
      {/* faint box: the maximum print height */}
      <lineSegments geometry={box} position={[0, 0, BED_MM.z / 2]}>
        <lineBasicMaterial color="#a5b4fc" transparent opacity={0.2} />
      </lineSegments>
    </>
  );
}

function ShapeMesh({ shape, selected, onSelect, setObj }: {
  shape: Shape; selected: boolean; onSelect: (id: string) => void; setObj: (o: THREE.Mesh | null) => void;
}) {
  const g = unitGeometry(shape.kind);
  const hole = shape.mode === 'hole';
  const { position: p, rotation: q, size: s } = shape;
  return (
    <mesh
      ref={selected ? setObj : undefined}
      geometry={g}
      position={[p.x, p.y, p.z]}
      rotation={[q.x * DEG, q.y * DEG, q.z * DEG]}
      scale={[s.x, s.y, s.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(shape.id); }}
    >
      {hole
        ? <meshStandardMaterial color="#ef4444" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        : <meshStandardMaterial color="#6366f1" metalness={0.2} roughness={0.55} />}
      {hole && (
        // red stripes: a wireframe over the translucent body
        <mesh geometry={g}>
          <meshBasicMaterial color="#b91c1c" wireframe transparent opacity={0.55} />
        </mesh>
      )}
      {selected && <Edges color="#ffffff" />}
    </mesh>
  );
}

export default function PlaygroundScene({ shapes, selectedId, tool, onSelect, onPose }: {
  shapes: Shape[]; selectedId: string | null; tool: Tool;
  onSelect: (id: string | null) => void; onPose: (id: string, pose: Pose) => void;
}) {
  const [obj, setObj] = useState<THREE.Mesh | null>(null);
  const grab = () => {
    const cur = shapes.find((x) => x.id === selectedId);
    if (!obj || !cur) return;
    const next: Pose = {
      position: { x: r(obj.position.x), y: r(obj.position.y), z: r(obj.position.z) },
      rotation: { x: r(obj.rotation.x / DEG), y: r(obj.rotation.y / DEG), z: r(obj.rotation.z / DEG) },
      size: { x: Math.max(MIN_SIZE, r(Math.abs(obj.scale.x))), y: Math.max(MIN_SIZE, r(Math.abs(obj.scale.y))), z: Math.max(MIN_SIZE, r(Math.abs(obj.scale.z))) },
    };
    if (JSON.stringify(next) !== JSON.stringify({ position: cur.position, rotation: cur.rotation, size: cur.size })) onPose(cur.id, next); // a click without a move is not an edit
  };
  return (
    <SafeCanvas
      camera={{ position: [100, -125, 100], up: [0, 0, 1], fov: 45, near: 1, far: 4000 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[120, -160, 300]} intensity={1.1} />
      <directionalLight position={[-200, 100, 100]} intensity={0.35} color="#818cf8" />
      <Plate />
      {shapes.map((s) => (
        <ShapeMesh key={s.id} shape={s} selected={s.id === selectedId} onSelect={onSelect} setObj={setObj} />
      ))}
      {obj && selectedId && <TransformControls object={obj} mode={tool} onMouseUp={grab} />}
      <OrbitControls makeDefault target={[0, 0, 15]} maxPolarAngle={Math.PI / 2 - 0.02} enableDamping={false} />
    </SafeCanvas>
  );
}
