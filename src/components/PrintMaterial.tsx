'use client';

// Print-like preview kit: FDM material presets with layer-line shading, studio light, a draggable turntable stage
// and the Solid / Mesh / Layers + print-bed toggles. Procedural only: no HDRI or texture downloads.
// All geometry here is millimetres, Z up, the part standing on z = 0.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { toCreasedNormals } from 'three-stdlib';
import SafeCanvas from './WebGLCanvas';
import { BED_MM, type MaterialKey } from '@/lib/quote';

export const TRUE_LAYER_MM = 0.2; // assumed layer height until the owner confirms (see blueprint WP2 LAYER_MM)
const CARD_EXAGGERATION = 3; // layer lines drawn this much larger on small cards so they show

type Preset = { color: string; rough: number; clearcoat: number; opacity: number };
export const PRESETS: Record<MaterialKey, Preset> = {
  PLA: { color: '#bfb49c', rough: 0.78, clearcoat: 0, opacity: 1 }, // matte
  PETG: { color: '#3f86ad', rough: 0.25, clearcoat: 0.6, opacity: 0.9 }, // glossy, slightly translucent
  ABS: { color: '#4a4f57', rough: 0.5, clearcoat: 0.1, opacity: 1 }, // satin
  TPU: { color: '#c2553f', rough: 0.92, clearcoat: 0, opacity: 1 }, // dull
};

export type View = 'solid' | 'mesh' | 'layers';
type Ctx = { material: MaterialKey; layerMm: number; view: View; clipZ: number };
const StageCtx = createContext<Ctx>({ material: 'PETG', layerMm: TRUE_LAYER_MM * CARD_EXAGGERATION, view: 'solid', clipZ: 1e4 });

/** Tracks the html `dark` class (set by the theme toggle). */
export function useDark() {
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

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** Position-only, centred on X/Y, resting on z = 0, with smooth curves and crisp edges (30 degree crease). */
export function prepGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
  g = toCreasedNormals(g, (30 * Math.PI) / 180);
  g.computeBoundingBox();
  return g;
}

/** One mesh with the print material. Settings come from the surrounding PrintStage unless given. */
export function PrintMesh({ geometry, ...over }: { geometry: THREE.BufferGeometry } & Partial<Ctx>) {
  const c = { ...useContext(StageCtx), ...over };
  const uniforms = useMemo(() => ({ uPitch: { value: 1 }, uAmp: { value: 0.45 } }), []);
  uniforms.uPitch.value = c.layerMm;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4), []);
  plane.constant = c.clipZ; // set in render like uPitch: the prop change below invalidates, so frameloop="demand" redraws too
  const p = PRESETS[c.material];
  const onBeforeCompile = (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    sh.uniforms.uPitch = uniforms.uPitch;
    sh.uniforms.uAmp = uniforms.uAmp;
    // layer lines every uPitch mm of world height (the turntable turns the camera, so world z is the build axis)
    sh.vertexShader = 'varying float vLZ;varying vec3 vLD;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvLZ=(modelMatrix*vec4(transformed,1.)).z;vLD=normalize((viewMatrix*vec4(0.,0.,1.,0.)).xyz);',
    );
    sh.fragmentShader = 'varying float vLZ;varying vec3 vLD;uniform float uPitch;uniform float uAmp;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat lw=vLZ/uPitch*6.2831853;float lf=clamp(1.6-fwidth(lw)/2.2,0.,1.);diffuseColor.rgb*=1.-.16*lf*(.5+.5*cos(lw));')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(normal+vLD*sin(lw)*uAmp*lf*(1.-abs(dot(normal,vLD))));');
  };
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        key={`${c.material}-${c.view}`} // side and wireframe change the shader program: a new material, not a stale one
        color={c.view === 'mesh' ? '#94a3b8' : p.color}
        roughness={p.rough}
        clearcoat={p.clearcoat}
        clearcoatRoughness={0.3}
        opacity={c.view === 'mesh' ? 1 : p.opacity}
        transparent={c.view !== 'mesh' && p.opacity < 1}
        wireframe={c.view === 'mesh'}
        side={c.view === 'layers' ? THREE.DoubleSide : THREE.FrontSide}
        clippingPlanes={[plane]}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

/** Studio light box built from Lightformers (rendered once, no HDRI). Z-up. */
export function StudioLight({ dark }: { dark: boolean }) {
  return (
    <>
      <ambientLight intensity={dark ? 0.12 : 0.2} />
      <Environment resolution={256} environmentIntensity={dark ? 0.7 : 1}>
        <color attach="background" args={['#555960']} />
        <Lightformer form="rect" intensity={3} position={[0, 0, 9]} scale={[12, 12, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={3} position={[-9, -4, 4]} scale={[8, 10, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[9, -3, 2]} scale={[5, 9, 1]} color="#dfe6ff" />
        <Lightformer form="rect" intensity={1.5} position={[0, 9, 1]} scale={[14, 3, 1]} color="#fff1dc" />
      </Environment>
    </>
  );
}

// A soft blob under the part. (drei ContactShadows rendered nothing in this Z-up scene.) ponytail: not a true silhouette, just a footprint-sized glow.
export function Shadow({ scale, dark, z = 0 }: { scale: number; dark: boolean; z?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0, z + 0.01]} renderOrder={-1}>
      <planeGeometry args={[scale * 0.6, scale * 0.6]} />
      <meshBasicMaterial map={tex} transparent opacity={dark ? 0.9 : 0.5} depthWrite={false} color={dark ? '#000' : '#1a140a'} />
    </mesh>
  );
}

/** The 220 mm printer bed with a 10 mm grid. */
function Bed({ dark }: { dark: boolean }) {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(BED_MM.x, BED_MM.x / 10, 0x7f8794, 0x7f8794);
    g.rotation.x = Math.PI / 2;
    g.position.z = 0.02;
    const m = g.material as THREE.LineBasicMaterial;
    m.transparent = true;
    m.opacity = dark ? 0.35 : 0.5;
    return g;
  }, [dark]);
  useEffect(() => () => { grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); }, [grid]); // primitives are not auto-disposed
  return (
    <>
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[BED_MM.x, BED_MM.y]} />
        <meshBasicMaterial color={dark ? '#0b0d11' : '#c9c6bd'} transparent opacity={0.55} />
      </mesh>
      <primitive object={grid} />
    </>
  );
}

function FitCamera({ dist, target }: { dist: number; target: THREE.Vector3 }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { update?: () => void } | null;
  useEffect(() => {
    const dir = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    controls?.update?.();
  }, [dist, camera, controls, target]);
  return null;
}

const seg = (on: boolean) =>
  `px-2.5 py-1 text-xs font-medium border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${on ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-700 dark:text-gray-200'}`;

/** Draggable turntable with studio light. `interactive` adds zoom and the Solid / Mesh / Layers + bed controls. */
export function PrintStage({ size, material = 'PETG', interactive = false, reduceMotion, children }: {
  size: { x: number; y: number; z: number };
  material?: MaterialKey;
  interactive?: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const dark = useDark();
  const [view, setView] = useState<View>('solid');
  const [bed, setBed] = useState(false);
  const layerMm = interactive ? TRUE_LAYER_MM : TRUE_LAYER_MM * CARD_EXAGGERATION;
  const total = Math.max(1, Math.round(size.z / TRUE_LAYER_MM));
  const [layer, setLayer] = useState(total);
  const maxDim = Math.max(size.x, size.y, size.z);
  const d = maxDim * 1.9;
  const dist = bed ? Math.max(d * 1.2, 380) : d * 1.2;
  const target = useMemo(() => new THREE.Vector3(0, 0, size.z / 2), [size.z]);
  const ctx: Ctx = { material, layerMm, view, clipZ: view === 'layers' ? layer * TRUE_LAYER_MM + 0.01 : 1e4 };
  const [onControls, setControls] = useState<{ domElement: HTMLElement } | null>(null);
  useEffect(() => {
    // vertical swipes still scroll the page on touch screens; sideways drags turn the part
    if (!interactive && onControls) onControls.domElement.style.touchAction = 'pan-y';
  }, [onControls, interactive]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(120%_90%_at_50%_20%,#fbfaf7,#dedbd3)] dark:bg-[radial-gradient(120%_90%_at_50%_20%,#2a303b,#12151b)]">
      <SafeCanvas
        frameloop={reduceMotion ? 'demand' : 'always'}
        dpr={[1, 1.5]}
        gl={{ alpha: true }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        camera={{ position: [d * 0.8, -d, d * 0.75 + size.z / 2], up: [0, 0, 1], fov: 40, near: 1, far: 4000 }}
      >
        <StudioLight dark={dark} />
        <StageCtx.Provider value={ctx}>{children}</StageCtx.Provider>
        {bed ? <Bed dark={dark} /> : <Shadow scale={maxDim * 2.6} dark={dark} />}
        <FitCamera dist={dist} target={target} />
        <OrbitControls
          ref={(c) => setControls(c as unknown as { domElement: HTMLElement } | null)}
          makeDefault
          target={target}
          enablePan={false}
          enableZoom={interactive}
          autoRotate={!reduceMotion}
          autoRotateSpeed={1.2}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </SafeCanvas>
      <span className="pointer-events-none absolute right-2 top-2 rounded border border-gray-300/70 bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-300">
        {material} · {interactive ? `${TRUE_LAYER_MM} mm layers` : `layers drawn ${CARD_EXAGGERATION}× larger`}
      </span>
      {interactive && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/80 px-2 py-1.5 backdrop-blur dark:bg-gray-900/80">
          <div role="group" aria-label="View" className="flex overflow-hidden rounded border border-gray-300 dark:border-gray-600">
            {(['solid', 'mesh', 'layers'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={seg(view === v)}>
                {v === 'solid' ? 'Solid' : v === 'mesh' ? 'Mesh' : 'Layers'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={bed} onChange={(e) => setBed(e.target.checked)} /> On the print bed (10 mm grid)
          </label>
          {view === 'layers' && (
            <label className="flex min-w-40 flex-1 items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <span className="whitespace-nowrap font-mono">Layer {layer} of {total}</span>
              <input type="range" min={1} max={total} value={layer} onChange={(e) => setLayer(+e.target.value)} aria-label="Layer shown" className="min-w-0 flex-1" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
