'use client';
// The one place a model is shown: the interactive 3D view AND its blueprint, both from the same triangle soup, so /quote and /build match.
// The blueprint is never a substitute for the 3D view. Size comes from bounds() over every vertex of the loaded geometry.
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { blueprint, bounds, type BlueprintReference } from '@/lib/blueprint';
import type { MaterialKey } from '@/lib/quote';

const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false, loading: () => <div role="status" aria-label="Loading the 3D viewer" className="pp-skeleton h-[320px] sm:h-[400px]" /> });
const BlueprintSheet = dynamic(() => import('./BlueprintSheet'), { ssr: false });

const mm = (n: number) => n.toFixed(1);

/** url: an uploaded STL/OBJ; positions: a triangle soup in memory instead. scaleTo: show a copy at that longest side in mm (the source is never changed). */
export default function ModelWithBlueprint({ url, positions, scaleTo, name, id, material = 'PLA', reference, onPositions }: {
  /** reference: a bought part's reference model: its own sheet rows, no print-material badge, layers or bed. */ reference?: BlueprintReference; id?: string;
  url?: string; positions?: Float32Array | null; scaleTo?: number; name: string; material?: MaterialKey; onPositions?: (p: Float32Array) => void;
}) {
  const [loaded, setLoaded] = useState<Float32Array | null>(null);
  const soup = positions ?? loaded; // what the viewer reports is what the sheet and the size line are drawn from
  const handle = (p: Float32Array) => { setLoaded(p); onPositions?.(p); };
  const shown = useMemo(() => (soup && soup.length >= 9 ? soup : null), [soup]);
  const sheet = useMemo(() => (shown ? blueprint(shown, { name, id, material, reference }) : null), [shown, name, id, material, reference]);
  const size = useMemo(() => (shown ? bounds(shown).size : null), [shown]);
  return (
    <div className="space-y-4">
      <div className="h-[320px] sm:h-[400px]">
        <ModelViewer url={url} positions={positions} scaleTo={scaleTo} onPositions={handle} material={material} stage={reference ? { reference: true } : undefined} />
      </div>
      {size && <p className="pp-fade text-sm font-medium text-gray-800 dark:text-gray-200">Overall size: {mm(size.x)} × {mm(size.y)} × {mm(size.z)} mm</p>}
      <section aria-label="Blueprint" className="space-y-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Blueprint</h4>
        {sheet ? (
          <div className="pp-fade space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">{reference ? 'Three views drawn from the reference model above, in mm. Standard dimensions only.' : 'Three views drawn from the model above, in mm. Check the size before you order.'}</p>
            <BlueprintSheet svg={sheet} filename="blueprint" />
          </div>
        ) : (
          <div role="status" aria-label="Drawing the blueprint" className="pp-skeleton h-48" />
        )}
      </section>
    </div>
  );
}
