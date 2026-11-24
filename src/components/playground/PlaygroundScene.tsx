'use client';

import { useMemo, useRef, useState } from 'react';
import { Edges, Html, OrbitControls, TransformControls } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import SafeCanvas from '../WebGLCanvas';
import { BED_MM } from '@/lib/quote';
import { MIN_SIZE, unitGeometry, type Shape } from '@/lib/playground';
import { MOTORS } from '@/lib/motors';
import { propDiameterMm } from '@/lib/flight/rotor';
import { snapToMount, roundPos, type Parts } from '@/lib/flight/layout';
import type { Vec3 } from '@/lib/flight/mass';
import { dimsFor } from '@/lib/suggest/validate';
import { massHalfHeight } from '@/lib/suggest/plan';

export type Tool = 'translate' | 'rotate' | 'scale';
export type Pose = Pick<Shape, 'position' | 'rotation' | 'size'>;

const DEG = Math.PI / 180;
export type Placing = { kind: 'motor'; spin: 'cw' | 'ccw'; motorId: string } | { kind: 'mass'; name: string };
/** A suggested spot drawn as a ghost: strong = the armed suggestion, faint = the hint shown for a part picked with the chips. */
export type Hint = { pos: Vec3; yawDeg: number; tiltDeg: number; glyph: Placing; strong: boolean };
export type SimView = { cg: Vec3; arrows: { pos: Vec3; thrustN: number; maxN: number }[] };
const BELL_R = 14, BELL_H = 12, PROP_Z = 14; // mm: a 2306-class bell, prop disc just above it
const isGear = (motorId: string) => MOTORS.some((x) => x.id === motorId && x.kind === 'gear');
const propMm = (motorId: string) => { const m = MOTORS.find((x) => x.id === motorId); return m && m.kind === 'prop' ? propDiameterMm(m.prop) : 127; };
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

function ShapeMesh({ shape, selected, onSelect, setObj, inert }: {
  shape: Shape; selected: boolean; onSelect: (id: string) => void; setObj: (o: THREE.Object3D | null) => void; inert: boolean;
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
      onClick={(e) => { if (inert) return; e.stopPropagation(); onSelect(shape.id); }}
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

/** Grey bell, translucent prop disc of the dataset's prop diameter, and an arc arrow showing the spin seen from above. */
function MotorGlyph({ spin, motorId, ghost, faint, selected }: { spin: 'cw' | 'ccw'; motorId: string; ghost?: boolean; faint?: boolean; selected?: boolean }) {
  const d = propMm(motorId), op = faint ? 0.25 : ghost ? 0.5 : 1;
  const arc = d * 0.42;
  return (
    <group>
      <mesh position={[0, 0, BELL_H / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[BELL_R, BELL_R, BELL_H, 24]} />
        <meshStandardMaterial color={selected ? '#e5e7eb' : '#9ca3af'} transparent={ghost} opacity={op} />
      </mesh>
      <mesh position={[0, 0, PROP_Z]}>
        <circleGeometry args={[d / 2, 48]} />
        <meshBasicMaterial color={ghost ? '#fbbf24' : '#38bdf8'} transparent opacity={ghost ? 0.22 : 0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* CCW seen from +Z is the positive rotation about Z; CW is the mirror image */}
      <group position={[0, 0, PROP_Z + 0.5]} scale={[spin === 'cw' ? -1 : 1, 1, 1]}>
        <mesh>
          <torusGeometry args={[arc, 1.2, 6, 32, Math.PI * 1.5]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
        <mesh position={[Math.cos(Math.PI * 1.5) * arc, Math.sin(Math.PI * 1.5) * arc, 0]} rotation={[0, 0, Math.PI * 1.5 + Math.PI]}>
          <coneGeometry args={[4, 9, 12]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
      </group>
    </group>
  );
}

/** Gear motor: a yellow can along x with the wheel (diameter wheelMm, 10 mm wide, spokes so the turn shows) on the outer side. spin = rad/s, 0 = still. */
function GearGlyph({ pos, wheelMm, spin, ghost, selected }: { pos: Vec3; wheelMm: number; spin: number; ghost?: boolean; selected?: boolean }) {
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (wheel.current && spin) wheel.current.rotation.x += spin * Math.min(dt, 0.05); });
  const side = pos[0] >= 0 ? 1 : -1, op = ghost ? 0.5 : 1, R = wheelMm / 2;
  return (
    <group position={[0, 0, 6]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 24, 20]} />
        <meshStandardMaterial color={selected ? '#fde68a' : '#eab308'} transparent={ghost} opacity={op} />
      </mesh>
      <group position={[side * 22, 0, 0]} ref={wheel}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[R, R, 10, 40]} />
          <meshStandardMaterial color="#374151" transparent opacity={ghost ? 0.4 : 0.9} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} rotation={[a, 0, 0]} position={[side * 5.2, 0, 0]}>
            <boxGeometry args={[0.6, 2 * R * 0.9, 3]} />
            <meshBasicMaterial color="#f9fafb" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A mass part drawn as its real-size box (ESC 30x30x6, battery 60x30x20 ...), centred on its position, turned by yaw and tilted. */
function MassGlyph({ name, massG, estimate, ghost, faint, selected, yawDeg = 0, tiltDeg = 0 }: { name: string; massG: number | null; estimate: boolean; ghost?: boolean; faint?: boolean; selected?: boolean; yawDeg?: number; tiltDeg?: number }) {
  const [w, d, h] = dimsFor(name) ?? [24, 14, 8];
  return (
    <group>
      <group rotation={[tiltDeg * DEG, 0, yawDeg * DEG]}>
        <mesh>
          <boxGeometry args={[w, d, h]} />
          <meshStandardMaterial color={selected ? '#fcd34d' : '#f59e0b'} transparent={ghost || faint} opacity={faint ? 0.25 : ghost ? 0.5 : 0.9} />
        </mesh>
      </group>
      {!faint && (
        <Html position={[0, 0, h / 2 + 8]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[10px] text-white">
            {name} · {massG === null ? '? g' : `${massG} g${estimate ? ' (est.)' : ''}`}
          </span>
        </Html>
      )}
    </group>
  );
}

/** CG marker plus one thrust arrow per motor, length = thrust (1 N = 12 mm, at least 6 mm). */
function SimOverlay({ view }: { view: SimView }) {
  return (
    <>
      <mesh position={view.cg}>
        <sphereGeometry args={[3.5, 16, 12]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} />
      </mesh>
      <Html position={view.cg} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span className="ml-3 whitespace-nowrap rounded bg-red-600 px-1 py-0.5 text-[10px] text-white">CG</span></Html>
      {view.arrows.map((a, i) => {
        const len = Math.max(6, Math.max(0, a.thrustN) * 12);
        return (
          <group key={i} position={a.pos}>
            <mesh position={[0, 0, len / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1.2, 1.2, len, 8]} />
              <meshBasicMaterial color="#22c55e" depthTest={false} />
            </mesh>
            <mesh position={[0, 0, len + 3]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[3.5, 7, 12]} />
              <meshBasicMaterial color="#22c55e" depthTest={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export default function PlaygroundScene({ shapes, selectedId, tool, onSelect, onPose, parts, partSel, onSelectPart, onMovePart, placing, mounts, onPlace, locked, sim, estimated, hints = [], wheelMm = 65, wheelSpin = 0 }: {
  shapes: Shape[]; selectedId: string | null; tool: Tool;
  onSelect: (id: string | null) => void; onPose: (id: string, pose: Pose) => void;
  parts: Parts; partSel: string | null; onSelectPart: (id: string) => void; onMovePart: (id: string, pos: Vec3) => void;
  placing: Placing | null; mounts: Vec3[]; onPlace: (pos: Vec3) => void; locked: boolean; sim: SimView | null; estimated: string[]; hints?: Hint[]; wheelMm?: number; wheelSpin?: number;
}) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const [ghost, setGhost] = useState<{ pos: Vec3; snapped: boolean } | null>(null);
  const grab = () => {
    if (!obj) return;
    if (partSel) {
      const next = roundPos([obj.position.x, obj.position.y, obj.position.z]);
      const cur = parts.motors.find((m) => m.id === partSel)?.pos ?? parts.components.find((c) => c.id === partSel)?.pos;
      if (cur && next.some((v, i) => v !== cur[i])) onMovePart(partSel, next);
      return;
    }
    const cur = shapes.find((x) => x.id === selectedId);
    if (!cur) return;
    const next: Pose = {
      position: { x: r(obj.position.x), y: r(obj.position.y), z: r(obj.position.z) },
      rotation: { x: r(obj.rotation.x / DEG), y: r(obj.rotation.y / DEG), z: r(obj.rotation.z / DEG) },
      size: { x: Math.max(MIN_SIZE, r(Math.abs(obj.scale.x))), y: Math.max(MIN_SIZE, r(Math.abs(obj.scale.y))), z: Math.max(MIN_SIZE, r(Math.abs(obj.scale.z))) },
    };
    if (JSON.stringify(next) !== JSON.stringify({ position: cur.position, rotation: cur.rotation, size: cur.size })) onPose(cur.id, next); // a click without a move is not an edit
  };
  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>): { pos: Vec3; snapped: boolean } => {
    const p: Vec3 = [e.point.x, e.point.y, e.point.z];
    return placing?.kind === 'motor' ? snapToMount(p, mounts) : { pos: p, snapped: false };
  };
  const pick = (id: string) => (e: ThreeEvent<MouseEvent>) => { if (placing || locked) return; e.stopPropagation(); onSelectPart(id); };
  const selObj = (id: string) => (id === partSel ? setObj : undefined);
  const showGhost = placing && ghost && !locked;
  return (
    <SafeCanvas
      camera={{ position: [100, -125, 100], up: [0, 0, 1], fov: 45, near: 1, far: 4000 }}
      dpr={[1, 2]}
      onPointerMissed={() => { if (!placing && !locked) onSelect(null); }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[120, -160, 300]} intensity={1.1} />
      <directionalLight position={[-200, 100, 100]} intensity={0.35} color="#818cf8" />
      <group
        onPointerMove={placing ? (e) => setGhost(hit(e)) : undefined}
        onPointerLeave={() => setGhost(null)}
        onClick={placing ? (e) => { e.stopPropagation(); onPlace(roundPos(hit(e).pos)); } : undefined}
      >
        <Plate />
        {shapes.map((s) => (
          <ShapeMesh key={s.id} shape={s} selected={!partSel && s.id === selectedId} onSelect={onSelect} setObj={setObj} inert={!!placing || locked} />
        ))}
      </group>
      {parts.motors.map((m) => (
        <group key={m.id} ref={selObj(m.id)} position={m.pos} onClick={pick(m.id)}>
          {isGear(m.motorId) ? <GearGlyph pos={m.pos} wheelMm={wheelMm} spin={wheelSpin} selected={m.id === partSel} /> : <MotorGlyph spin={m.spin} motorId={m.motorId} selected={m.id === partSel} />}
        </group>
      ))}
      {parts.components.map((c) => (
        <group key={c.id} ref={selObj(c.id)} position={c.pos} onClick={pick(c.id)}>
          <MassGlyph name={c.name} massG={c.massG} estimate={estimated.includes(c.id)} selected={c.id === partSel} yawDeg={c.yawDeg} tiltDeg={c.tiltDeg} />
        </group>
      ))}
      {showGhost && (
        <group position={placing.kind === 'mass' ? [ghost.pos[0], ghost.pos[1], ghost.pos[2] + massHalfHeight(placing.name)] : ghost.pos} raycast={() => null}>
          {placing.kind === 'motor'
            ? (isGear(placing.motorId) ? <GearGlyph pos={ghost.pos} wheelMm={wheelMm} spin={0} ghost /> : <MotorGlyph spin={placing.spin} motorId={placing.motorId} ghost />)
            : <MassGlyph name={placing.name} massG={null} estimate={false} ghost />}
          {ghost.snapped && (
            <mesh position={[0, 0, 0.3]}>
              <ringGeometry args={[BELL_R + 2, BELL_R + 4, 32]} />
              <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      )}
      {!locked && hints.map((h, i) => (
        <group key={i} position={h.pos} raycast={() => null}>
          {h.glyph.kind === 'motor'
            ? <MotorGlyph spin={h.glyph.spin} motorId={h.glyph.motorId} ghost={h.strong} faint={!h.strong} />
            : <MassGlyph name={h.glyph.name} massG={null} estimate={false} ghost={h.strong} faint={!h.strong} yawDeg={h.yawDeg} tiltDeg={h.tiltDeg} />}
          <mesh position={[0, 0, h.glyph.kind === 'motor' ? 0.3 : -(dimsFor(h.glyph.name)?.[2] ?? 8) / 2 + 0.3]}>
            <ringGeometry args={[BELL_R + 2, BELL_R + (h.strong ? 4 : 3), 32]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={h.strong ? 1 : 0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {sim && <SimOverlay view={sim} />}
      {obj && !locked && !placing && (partSel || selectedId) && <TransformControls object={obj} mode={partSel ? 'translate' : tool} onMouseUp={grab} />}
      <OrbitControls makeDefault target={[0, 0, 15]} maxPolarAngle={Math.PI / 2 - 0.02} enableDamping={false} />
    </SafeCanvas>
  );
}
