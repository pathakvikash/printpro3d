'use client';
// The /blueprint/[id] drawing: the CSG runs in a worker after mount, so prerender never builds a mesh.
import { useEffect, useState } from 'react';
import { CATALOG } from '@/lib/catalog';
import { exampleById } from '@/lib/examples';
import { blueprint } from '@/lib/blueprint';
import { buildOffThread } from '@/lib/buildOffThread';
import BlueprintSheet from './BlueprintSheet';

export default function ExampleBlueprint({ id }: { id: string }) {
  const [svg, setSvg] = useState<string | null | undefined>();
  useEffect(() => {
    const item = CATALOG.find((i) => i.id === id), ex = item && exampleById(item.exampleId);
    if (!item || !ex) { setSvg(null); return; }
    let on = true;
    buildOffThread(ex.shapes).then((m) => on && setSvg(m ? blueprint(m, { name: item.name, id: item.id, material: item.material }) : null), () => on && setSvg(null));
    return () => { on = false; };
  }, [id]);
  if (svg === undefined) return <div role="status" aria-label="Drawing the blueprint" className="h-[360px] animate-pulse rounded-xl bg-gray-200 sm:h-[480px] dark:bg-gray-800" />;
  return svg ? <BlueprintSheet svg={svg} filename={`${id}-blueprint`} /> : <p role="alert" className="text-sm text-gray-700 dark:text-gray-300">This drawing could not be built.</p>;
}
