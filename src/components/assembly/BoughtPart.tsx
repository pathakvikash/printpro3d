'use client';
// Simplified but recognisable visuals for bought (not printed) parts, drawn inside the part's size box with its origin at the
// box centre. Low poly, shared materials. Cylinders stand along z (size[2] is the height), like the old grey placeholder.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { boughtKind } from '@/lib/boughtKind';
import type { AssemblyPart } from '@/lib/assembly';

const std = (color: string, metalness = 0, roughness = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const M = {
  bell: std('#1a1c20', 0.6, 0.35), base: std('#141518', 0.4, 0.5), stator: std('#b9bdc4', 0.8, 0.3), shaft: std('#c9a24a', 0.9, 0.25),
  blade: std('#9aa3ad', 0, 0.4, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
  pcb: std('#1f6b45', 0, 0.55), chip: std('#111111', 0.1, 0.5), gold: std('#d4af37', 0.9, 0.3),
  cell: std('#33363c', 0, 0.55), label: std('#f2c230', 0, 0.5), red: std('#d92d20'), black: std('#0b0b0c'),
  body: std('#17181b', 0.2, 0.5), lens: std('#202226', 0.8, 0.2),
  other: std('#6b7280', 0, 0.8),
  glass: new THREE.MeshPhysicalMaterial({ color: '#0d1a2b', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }),
};
const CYL = 24;
const Y = [Math.PI / 2, 0, 0] as const; // cylinder default axis is y: stand it along z
const X = [0, 0, -Math.PI / 2] as const; // ... or lay it along +x

function Motor({ d, h }: { d: number; h: number }) {
  const r = d / 2, bellH = h * 0.5, gap = h * 0.1, baseH = h - bellH - gap, sr = Math.max(r * 0.09, 0.2);
  return (
    <group rotation={Y}>
      <mesh position={[0, h / 2 - bellH / 2, 0]} material={M.bell}><cylinderGeometry args={[r, r, bellH, CYL]} /></mesh>
      {[0, 1, 2, 3].map((i) => ( // bell cutouts
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * r * 0.55, h / 2 + 0.01, Math.sin((i * Math.PI) / 2) * r * 0.55]} rotation={[-Math.PI / 2, 0, 0]} material={M.base}><circleGeometry args={[r * 0.14, 8]} /></mesh>
      ))}
      <mesh position={[0, h / 2 - bellH - gap / 2, 0]} material={M.stator}><cylinderGeometry args={[r * 0.82, r * 0.82, gap, CYL]} /></mesh>
      <mesh position={[0, -h / 2 + baseH / 2, 0]} material={M.base}><cylinderGeometry args={[r * 0.92, r * 0.92, baseH, CYL]} /></mesh>
      <mesh position={[0, h / 2 + h * 0.12, 0]} material={M.shaft}><cylinderGeometry args={[sr, sr, h * 0.3, 12]} /></mesh>
    </group>
  );
}

function Prop({ sx, sy, sz }: { sx: number; sy: number; sz: number }) {
  const bar = sx >= sy * 1.8; // a flat bar (heli rotor blades): two blades along x
  const dia = bar ? sx : Math.max(sx, sy);
  const n = bar ? 2 : dia <= 40 ? 4 : 3;
  const len = dia / 2 - dia * 0.06, w = bar ? sy * 0.9 : dia * 0.13, t = Math.max(sz * 0.6, 0.4);
  return (
    <group>
      <mesh rotation={Y} material={M.bell}><cylinderGeometry args={[dia * 0.06, dia * 0.06, t * 3, 16]} /></mesh>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} rotation={[0, 0, (i * 2 * Math.PI) / n]}>
          <mesh position={[dia * 0.04 + len / 2, 0, 0]} rotation={[0.22, 0, 0]} material={M.blade}><boxGeometry args={[len, w, t]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Board({ sx, sy, sz }: { sx: number; sy: number; sz: number }) {
  // the thin axis is z, or y for a panel laid flat in xz (the LED panel): turn that one up
  const flat = sy < sx && sy < sz;
  const [w, l, h] = flat ? [sx, sz, sy] : [sx, sy, sz];
  const t = Math.min(h, Math.max(1.2, h * 0.25)), ch = Math.max((h - t) * 0.8, 0.4);
  return (
    <group rotation={flat ? [-Math.PI / 2, 0, 0] : undefined}>
      <mesh position={[0, 0, -h / 2 + t / 2]} material={M.pcb}><boxGeometry args={[w, l, t]} /></mesh>
      {[[-0.22, 0.12, 0.3, 0.3], [0.2, -0.15, 0.25, 0.22], [0.02, 0.2, 0.16, 0.14]].map(([x, y, cw, cl], i) => (
        <mesh key={i} position={[x * w, y * l, -h / 2 + t + ch / 2]} material={M.chip}><boxGeometry args={[cw * w, cl * l, ch]} /></mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => ( // gold pad row along one edge
        <mesh key={i} position={[(i - 2.5) * (w / 8), -l / 2 + l * 0.05, -h / 2 + t + 0.05]} material={M.gold}><boxGeometry args={[w / 14, l * 0.07, 0.12]} /></mesh>
      ))}
    </group>
  );
}

function Battery({ sx, sy, sz }: { sx: number; sy: number; sz: number }) {
  const rad = Math.min(sy, sz) * 0.15, lead = Math.max(Math.min(sy, sz) * 0.06, 0.25);
  return (
    <group>
      <RoundedBox args={[sx, sy, sz]} radius={rad} smoothness={2} material={M.cell} />
      <mesh material={M.label}><boxGeometry args={[sx * 0.3, sy * 1.01, sz * 1.01]} /></mesh>
      {([[M.red, 0.2], [M.black, -0.2]] as const).map(([m, k], i) => (
        <mesh key={i} position={[sx / 2 + sx * 0.1, sy * k, 0]} rotation={X} material={m}><cylinderGeometry args={[lead, lead, sx * 0.2, 6]} /></mesh>
      ))}
    </group>
  );
}

// The lens looks along +x, the drone's front (the canopy's camera sleeve points that way).
function Camera({ sx, sy, sz }: { sx: number; sy: number; sz: number }) {
  const bodyL = sx * 0.5, lensL = sx - bodyL, lr = Math.min(sy, sz) * 0.28;
  return (
    <group>
      <RoundedBox args={[bodyL, sy, sz]} radius={Math.min(sy, sz) * 0.12} smoothness={2} position={[-sx / 2 + bodyL / 2, 0, 0]} material={M.body} />
      <mesh position={[-sx / 2 + bodyL + lensL / 2, 0, 0]} rotation={X} material={M.lens}><cylinderGeometry args={[lr, lr, lensL, CYL]} /></mesh>
      <mesh position={[sx / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={M.glass}><circleGeometry args={[lr * 0.8, CYL]} /></mesh>
    </group>
  );
}

export default function BoughtPart({ part }: { part: Pick<AssemblyPart, 'id' | 'label' | 'size' | 'shape'> }) {
  const [sx, sy, sz] = part.size;
  const kind = boughtKind(part.label, part.id, part.shape);
  const cyl = part.shape === 'cylinder';
  const other = useMemo(() => (kind !== 'other' ? null : cyl ? new THREE.CylinderGeometry(sx / 2, sx / 2, sz, CYL) : new THREE.BoxGeometry(sx, sy, sz)), [kind, cyl, sx, sy, sz]);
  useEffect(() => () => other?.dispose(), [other]);
  if (kind === 'motor') return <Motor d={sx} h={sz} />;
  if (kind === 'prop') return <Prop sx={sx} sy={sy} sz={sz} />;
  if (kind === 'board') return <Board sx={sx} sy={sy} sz={sz} />;
  if (kind === 'battery') return <Battery sx={sx} sy={sy} sz={sz} />;
  if (kind === 'camera') return <Camera sx={sx} sy={sy} sz={sz} />;
  return <mesh geometry={other ?? undefined} rotation={cyl ? Y : undefined} material={M.other} />;
}
