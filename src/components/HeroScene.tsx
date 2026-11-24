'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import SafeCanvas from './WebGLCanvas';
import { PrintMesh, StudioLight, prepGeometry, TRUE_LAYER_MM, useDark } from './PrintMaterial';
import { kitById } from '@/lib/kits';
import { isKitKey } from '@/lib/kits/adapt';
import { buildTemplate } from '@/lib/templates';
import { normalizeCfg, templateById } from '@/lib/templateDefs';
import { buildOffThread, kitMeshOffThread } from '@/lib/buildOffThread';
import { meshStats } from '@/lib/quote';
import type { AssemblyPart, V3 } from '@/lib/assembly';

const KIT = 'whoop-kit';
const DEG = Math.PI / 180;
const PROP_RPM = 90; // a real prop is a blur on screen; this turns visibly

type Built = { parts: AssemblyPart[]; geos: Record<string, THREE.BufferGeometry> };

// The assembled whoop kit from the kit file itself: printed parts built in the worker, bought parts as grey placeholders.
function useKit(): Built | null {
  const [built, setBuilt] = useState<Built | null>(null);
  useEffect(() => {
    let on = true;
    const made: THREE.BufferGeometry[] = [];
    const kit = kitById(KIT);
    if (!kit?.assembly) return;
    const asm = kit.assembly;
    void Promise.all(kit.items.map(async (i) => {
      const t = isKitKey(i.templateId) ? null : templateById(i.templateId);
      const m = isKitKey(i.templateId) ? await kitMeshOffThread(i.templateId, i.config) : t ? await buildOffThread(buildTemplate(t, normalizeCfg(t, i.config)).shapes, true) : null;
      return [i.templateId, m] as const;
    })).then((rows) => {
      const geos: Record<string, THREE.BufferGeometry> = {}, sizes: Record<string, V3> = {};
      for (const [id, m] of rows) {
        const st = m && meshStats(m);
        if (!m || !st) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(m, 3));
        geos[id] = prepGeometry(g);
        made.push(geos[id]);
        sizes[id] = [st.sizeMm.x, st.sizeMm.y, st.sizeMm.z];
      }
      if (on) setBuilt({ parts: asm(sizes), geos });
    }).catch(() => {});
    return () => { on = false; made.forEach((g) => g.dispose()); };
  }, []);
  return built;
}

function Kit({ built, onShown }: { built: Built; onShown: () => void }) {
  const turn = useRef<THREE.Group>(null);
  const spinners = useRef(new Map<string, THREE.Group>());
  const wide = useThree((s) => s.size.width >= 1024);
  const radius = useMemo(() => Math.max(1, ...built.parts.map((p) => Math.hypot(p.position[0], p.position[1]) + Math.max(p.size[0], p.size[1]) / 2)), [built]);
  const k = (wide ? 1.45 : 1.3) / radius;
  useEffect(onShown, [onShown]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (turn.current) { turn.current.rotation.z = t * 0.3; turn.current.rotation.x = Math.sin(t * 0.5) * 0.08; }
    const q = new THREE.Quaternion();
    for (const p of built.parts) {
      const g = spinners.current.get(p.id);
      if (g && p.spin) g.quaternion.setFromAxisAngle(new THREE.Vector3(...p.spin.axis).normalize(), Math.sign(p.spin.rpm) * ((Math.min(Math.abs(p.spin.rpm), PROP_RPM) * 6 * t) * DEG)).multiply(q);
    }
  });
  return (
    <group position={[wide ? 2.5 : 1, 0, 0]}>
      <group ref={turn} scale={k}>
        {built.parts.map((p) => {
          const geo = typeof p.geometry === 'string' ? built.geos[p.geometry] : p.geometry;
          const [sx, sy, sz] = p.size;
          const bought = p.bought || p.material === 'bought';
          if (!bought && !geo) return null;
          return (
            <group key={p.id} position={p.position} rotation={[p.rotation[0] * DEG, p.rotation[1] * DEG, p.rotation[2] * DEG]}>
              <group ref={(g) => { if (g && p.spin) spinners.current.set(p.id, g); else spinners.current.delete(p.id); }}>
                {bought ? (
                  <>
                    <mesh rotation={p.shape === 'cylinder' ? [Math.PI / 2, 0, 0] : undefined}>
                      {p.shape === 'cylinder' ? <cylinderGeometry args={[sx / 2, sx / 2, sz, 24]} /> : <boxGeometry args={[sx, sy, sz]} />}
                      <meshStandardMaterial color="#9ca3af" roughness={0.85} transparent opacity={p.spin ? 0.35 : 1} />
                    </mesh>
                    {p.spin && ( // a bar across the prop disc, so it visibly turns
                      <mesh position={[0, 0, sz / 2]}><boxGeometry args={[sx * 0.95, sx * 0.1, Math.max(sz, 0.8)]} /><meshStandardMaterial color="#374151" roughness={0.7} /></mesh>
                    )}
                  </>
                ) : geo && (
                  <group position={[0, 0, -((geo.boundingBox?.min.z ?? 0) + (geo.boundingBox?.max.z ?? 0)) / 2]}>
                    <PrintMesh geometry={geo} material={p.material as 'PLA'} layerMm={TRUE_LAYER_MM * 3} view="solid" clipZ={1e4} />
                  </group>
                )}
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

export default function HeroScene({ onShown }: { onShown: () => void }) {
  const dark = useDark();
  const built = useKit();
  return (
    <div className="absolute inset-0 h-full w-full">
      <SafeCanvas camera={{ position: [0, -6, 3.4], up: [0, 0, 1], fov: 40 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <StudioLight dark={dark} />
          {built && <Kit built={built} onShown={onShown} />}
        </Suspense>
      </SafeCanvas>
    </div>
  );
}
