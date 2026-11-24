'use client';
// Static picture of a kit's finished build for its shop card: the kit's assembly() rendered once in a throwaway WebGL context
// (printed meshes from the same worker as every other card, bought parts as grey placeholders), kept as a PNG data URL per kit.
// No live canvas is left behind: the context is lost and disposed right after the single frame.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PRESETS, prepGeometry } from '@/components/PrintMaterial';
import { buildOffThread, kitMeshOffThread } from '@/lib/buildOffThread';
import type { Cfg } from '@/lib/templateDefs';
import { meshStats } from '@/lib/quote';
import type { Kit } from '@/lib/kits';
import type { Shape } from '@/lib/playground';
import type { V3 } from '@/lib/assembly';

export type ThumbSource = { id: string; shapes: Shape[]; template: boolean; kit?: { key: string; cfg: Cfg } };

const W = 800, H = 480, DEG = Math.PI / 180;
const cache = new Map<string, string>();
const KEY = (id: string) => `kitthumb:v1:${id}`;
let queue: Promise<unknown> = Promise.resolve(); // one render at a time: never more than one throwaway context alive

function render(kit: Kit, sources: ThumbSource[]): Promise<string | null> {
  const run = async () => {
    const meshes = await Promise.all(sources.map((s) => (s.kit ? kitMeshOffThread(s.kit.key, s.kit.cfg) : buildOffThread(s.shapes, s.template)).catch(() => null)));
    const geometries: Record<string, THREE.BufferGeometry> = {}, sizes: Record<string, V3> = {};
    sources.forEach((s, i) => {
      const m = meshes[i], st = m && meshStats(m);
      if (!m || !st) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m, 3));
      geometries[s.id] = prepGeometry(g);
      sizes[s.id] = [st.sizeMm.x, st.sizeMm.y, st.sizeMm.z];
    });
    const disposables: { dispose(): void }[] = Object.values(geometries);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.9;
      disposables.push(pmrem, env);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(300, -400, 600);
      scene.add(sun);
      for (const p of kit.assembly!(sizes)) {
        const geo = typeof p.geometry === 'string' ? geometries[p.geometry] : p.geometry;
        const g = new THREE.Group();
        g.position.set(...p.position);
        g.rotation.set(p.rotation[0] * DEG, p.rotation[1] * DEG, p.rotation[2] * DEG, 'XYZ');
        const [sx, sy, sz] = p.size;
        if (p.bought || p.material === 'bought') {
          const cyl = p.shape === 'cylinder';
          const bg = cyl ? new THREE.CylinderGeometry(sx / 2, sx / 2, sz, 32) : new THREE.BoxGeometry(sx, sy, sz);
          const mat = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.85 });
          const eg = new THREE.EdgesGeometry(bg), em = new THREE.LineBasicMaterial({ color: '#4b5563' });
          const m = new THREE.Mesh(bg, mat), l = new THREE.LineSegments(eg, em);
          if (cyl) { m.rotation.x = l.rotation.x = Math.PI / 2; }
          g.add(m, l);
          disposables.push(bg, mat, eg, em);
        } else if (geo) {
          geo.computeBoundingBox();
          const pr = PRESETS[p.material as keyof typeof PRESETS];
          const mat = new THREE.MeshPhysicalMaterial({ color: pr.color, roughness: pr.rough, clearcoat: pr.clearcoat, clearcoatRoughness: 0.3 });
          const m = new THREE.Mesh(geo, mat);
          m.position.z = -(geo.boundingBox!.min.z + geo.boundingBox!.max.z) / 2;
          g.add(m);
          disposables.push(mat);
        } else continue;
        scene.add(g);
      }
      // 3/4 view from the same side as the live cards, fitted to the model's bounding sphere
      const sphere = new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
      const cam = new THREE.PerspectiveCamera(40, W / H, 1, 5000);
      cam.up.set(0, 0, 1);
      const dist = (sphere.radius / Math.sin((40 * DEG) / 2)) * 0.8;
      cam.position.copy(sphere.center).addScaledVector(new THREE.Vector3(0.8, -1, 0.75).normalize(), dist);
      cam.lookAt(sphere.center);
      renderer.render(scene, cam);
      return renderer.domElement.toDataURL('image/png');
    } finally {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => null);
  return p.catch(() => null);
}

export default function KitThumb({ kit, sources }: { kit: Kit; sources: ThumbSource[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => cache.get(kit.id) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (src || !kit.assembly) return;
    let on = true;
    const el = box.current!;
    const io = new IntersectionObserver((e) => { // only cards that scroll into view cost a render
      if (!e[0].isIntersecting) return;
      io.disconnect();
      try { const s = sessionStorage.getItem(KEY(kit.id)); if (s) { cache.set(kit.id, s); setSrc(s); return; } } catch { /* storage blocked */ }
      void render(kit, sources).then((url) => {
        if (!on) return;
        if (!url) { setFailed(true); return; }
        cache.set(kit.id, url);
        try { sessionStorage.setItem(KEY(kit.id), url); } catch { /* quota or blocked */ }
        setSrc(url);
      });
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { on = false; io.disconnect(); };
  }, [kit, sources, src]);
  return (
    <div ref={box} className="h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL: nothing for next/image to optimise */}
      {src ? <img src={src} alt={`Assembled ${kit.title}`} className="h-full w-full object-contain" /> : failed ? null : <div role="status" aria-label={`Building ${kit.title}`} className="h-full w-full animate-pulse bg-gray-200/60 dark:bg-gray-800/60" />}
    </div>
  );
}
