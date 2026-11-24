'use client';
// The shared "viral" presentation of a multi-part kit: assembled, exploded (slider) and unboxing flat-lay views, spinning
// props and wheels, a fold slider for joints, hover/tap part labels. Lazy-load it: it pulls three.
// Reuses PrintStage (lighting, layer-line PrintMesh, draggable camera, one canvas, draw-on-demand); this file only poses parts.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { PrintMesh, PrintStage, useReducedMotion } from '@/components/PrintMaterial';
import { explodedTransform, flatLayLayout, jointTransform, lerp, spinDeg, type AssemblyPart } from '@/lib/assembly';
import { BED_MM } from '@/lib/quote';

export type AssemblyMode = 'assembled' | 'exploded' | 'unboxing';
const RAD = Math.PI / 180;
const MAX_VISUAL_RPM = 90; // a real prop turns thousands of rpm, which on screen is just a flicker

type Targets = { e: number; f: number; j: number; spin: boolean };

// A text tag for a bought part, drawn on a canvas texture (no font download), always facing the camera and on top.
function Tag({ text, z }: { text: string; z: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 56;
    const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(255,255,255,.93)'; x.strokeStyle = '#4b5563'; x.lineWidth = 3; x.setLineDash([8, 5]);
    x.beginPath(); x.roundRect(3, 3, 314, 50, 10); x.fill(); x.stroke();
    x.setLineDash([]); x.fillStyle = '#111827'; x.font = '600 28px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 160, 30, 296);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={[0, 0, z]} scale={[44, 7.7, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} toneMapped={false} />
    </sprite>
  );
}

function Scene({ parts, geometries, flat, targets, tags, reduce, onHover, onPick }: {
  parts: AssemblyPart[]; geometries?: Record<string, THREE.BufferGeometry>; flat: Record<string, [number, number, number]>;
  targets: Targets; tags: boolean; reduce: boolean; onHover: (id: string | null) => void; onPick: (id: string) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const groups = useRef(new Map<string, THREE.Group>());
  const tgt = useRef(targets);
  const cur = useRef({ e: reduce ? targets.e : 0, f: reduce ? targets.f : 0, j: targets.j, spinT: 0 });
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), id: new THREE.Quaternion(), s: new THREE.Quaternion(), a: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  useEffect(() => { tgt.current = targets; invalidate(); }, [targets, parts, flat, reduce, invalidate]); // the poses are set by hand, not by props: ask for a frame

  useFrame((_, dt) => {
    const t = tgt.current, c = cur.current;
    const k = reduce ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 7);
    let moving = false;
    for (const key of ['e', 'f', 'j'] as const) {
      c[key] += (t[key] - c[key]) * k;
      if (Math.abs(t[key] - c[key]) < 0.0008) c[key] = t[key]; else moving = true;
    }
    if (t.spin && !reduce) c.spinT += Math.min(dt, 0.05);
    for (const p of parts) {
      const g = groups.current.get(p.id);
      if (!g) continue;
      let pose = explodedTransform(p, c.e);
      if (p.joint) pose = jointTransform(p, lerp(p.joint.min, p.joint.max, c.j), pose);
      const fp = flat[p.id];
      tmp.p.set(...pose.position);
      if (fp) tmp.p.lerp(tmp.a.set(...fp), c.f);
      g.position.copy(tmp.p);
      g.quaternion.set(...pose.quaternion).slerp(tmp.id, c.f); // unboxing shows parts as printed: unrotated
      if (p.spin && c.spinT > 0) g.quaternion.multiply(tmp.s.setFromAxisAngle(tmp.a.set(...p.spin.axis).normalize(), spinDeg({ rpm: Math.min(p.spin.rpm, MAX_VISUAL_RPM) }, c.spinT) * RAD));
    }
    if (moving || (t.spin && !reduce)) invalidate();
  });

  return (
    <>
      {parts.map((p) => {
        const geo = typeof p.geometry === 'string' ? geometries?.[p.geometry] : p.geometry;
        const [sx, sy, sz] = p.size;
        const lift = geo?.boundingBox ? -(geo.boundingBox.min.z + geo.boundingBox.max.z) / 2 : -sz / 2;
        return (
          <group
            key={p.id}
            ref={(g) => { if (g) groups.current.set(p.id, g); else groups.current.delete(p.id); }}
            onPointerOver={(e) => { e.stopPropagation(); onHover(p.id); }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onPick(p.id); }}
          >
            {p.bought || p.material === 'bought' ? (
              <>
                <mesh rotation={p.shape === 'cylinder' ? [Math.PI / 2, 0, 0] : undefined}>
                  {p.shape === 'cylinder' ? <cylinderGeometry args={[sx / 2, sx / 2, sz, 32]} /> : <boxGeometry args={[sx, sy, sz]} />}
                  <meshStandardMaterial color="#9ca3af" transparent opacity={0.55} roughness={0.9} />
                  <Edges color="#4b5563" />
                </mesh>
                {p.spin && ( // a bar across the top, so a turning placeholder visibly turns
                  <mesh position={[0, 0, sz / 2 + 0.3]}>
                    <boxGeometry args={[Math.max(sx, sy) * 0.9, Math.max(sx, sy) * 0.14, 0.6]} />
                    <meshStandardMaterial color="#374151" roughness={0.7} />
                  </mesh>
                )}
                {tags && <Tag text={`Bought · ${p.label}`} z={sz / 2 + 7} />}
              </>
            ) : geo ? (
              <group position={[0, 0, lift]}><PrintMesh geometry={geo} material={p.material as Exclude<AssemblyPart['material'], 'bought'>} /></group>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

const ICONS = {
  assembled: 'M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7L12 12l8.7-5M12 22V12',
  exploded: 'M12 2v6M9 5l3-3 3 3M12 22v-6M9 19l3 3 3-3M2 12h6M5 9l-3 3 3 3M22 12h-6M19 9l3 3-3 3',
  unboxing: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  spin: 'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
  fold: 'M4 20L12 4l8 16M12 4v16',
} as const;
const Ico = ({ n }: { n: keyof typeof ICONS }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d={ICONS[n]} /></svg>
);
const btn = (on: boolean) => `flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 ${on ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900' : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'}`;

/** geometries: builder key -> geometry, for parts whose `geometry` is a string (a part whose key is missing is skipped until it arrives). */
export default function AssemblyViewer({ parts, geometries, className = 'h-[360px] sm:h-[480px]' }: { parts: AssemblyPart[]; geometries?: Record<string, THREE.BufferGeometry>; className?: string }) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<AssemblyMode>('assembled');
  const [explode, setExplode] = useState(1); // slider, 0..1
  const [fold, setFold] = useState(0); // slider, 0..1 of each joint's range
  const [spin, setSpin] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const lay = useMemo(() => flatLayLayout(parts, BED_MM), [parts]);
  const size = useMemo(() => { // room for every view, so the camera never has to move between them
    let x = 1, y = 1, z = 1;
    for (const p of parts) {
      for (const pos of [p.position, [p.position[0] + p.explode[0], p.position[1] + p.explode[1], p.position[2] + p.explode[2]], lay.positions[p.id]]) {
        x = Math.max(x, Math.abs(pos[0]) + p.size[0] / 2); y = Math.max(y, Math.abs(pos[1]) + p.size[1] / 2); z = Math.max(z, pos[2] + p.size[2] / 2);
      }
    }
    return { x: 1.5 * x, y: 1.5 * y, z: 0.7 * z }; // PrintStage frames 1.9x the largest side: roomy for one part, loose for a kit
  }, [parts, lay]);
  const targets = useMemo<Targets>(() => ({ e: mode === 'exploded' ? explode : 0, f: mode === 'unboxing' ? 1 : 0, j: fold, spin }), [mode, explode, fold, spin]);
  const stage = useMemo(() => ({ pan: true, autoRotate: false }), []);
  const hasSpin = parts.some((p) => p.spin), hasJoint = parts.some((p) => p.joint);
  const shown = parts.find((p) => p.id === (hover ?? picked));
  const MODES: [AssemblyMode, string][] = [['assembled', 'Assembled'], ['exploded', 'Exploded'], ['unboxing', 'Unboxing']];

  return (
    <div className="space-y-3">
      <div className={`relative w-full overflow-hidden rounded-xl ${className}`}>
        <PrintStage size={size} interactive reduceMotion={reduce} stage={stage}>
          <Scene parts={parts} geometries={geometries} flat={lay.positions} targets={targets} tags={mode !== 'assembled'} reduce={reduce} onHover={setHover} onPick={(id) => setPicked((c) => (c === id ? null : id))} />
        </PrintStage>
        <p role="status" aria-live="polite" className="pointer-events-none absolute left-2 top-2 max-w-[70%] rounded border border-gray-300/70 bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-900/90 dark:text-gray-100">
          {shown ? `${shown.label} · ${shown.bought || shown.material === 'bought' ? 'bought separately, not printed' : `printed in ${shown.material}`}` : 'Hover or tap a part'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex flex-wrap gap-2">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={btn(mode === m)}><Ico n={m} />{label}</button>
          ))}
        </div>
        {hasSpin && (
          <button type="button" aria-pressed={spin} disabled={reduce} title={reduce ? 'Off because your device asks for reduced motion' : undefined} onClick={() => setSpin((s) => !s)} className={btn(spin)}><Ico n="spin" />Spin</button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {mode === 'exploded' && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            <span className="w-20 shrink-0">Explode {Math.round(explode * 100)}%</span>
            <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="Explode amount" className="h-8 min-w-0 flex-1" />
          </label>
        )}
        {hasJoint && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            <span className="flex w-20 shrink-0 items-center gap-1"><Ico n="fold" />Fold</span>
            <input type="range" min={0} max={1} step={0.01} value={fold} onChange={(e) => setFold(+e.target.value)} aria-label="Fold amount" className="h-8 min-w-0 flex-1" />
          </label>
        )}
      </div>
      {mode === 'unboxing' && !lay.fits && <p className="text-xs text-amber-700 dark:text-amber-300">These parts need more than one {BED_MM.x} mm bed.</p>}

      <ul aria-label="Parts" className="flex flex-wrap gap-2">
        {parts.map((p) => {
          const bought = p.bought || p.material === 'bought';
          return (
            <li key={p.id}>
              <button type="button" aria-pressed={picked === p.id} onClick={() => setPicked((c) => (c === p.id ? null : p.id))} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${bought ? 'border-dashed' : ''} ${picked === p.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-400 bg-white text-gray-800 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-100'}`}>
                {p.label}{bought ? ' (bought)' : ''}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
