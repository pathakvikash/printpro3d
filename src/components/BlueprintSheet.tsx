'use client';
// Renders a blueprint SVG string (from lib/blueprint.ts) with PNG and print buttons. No three.js.
import Icon from './Icon';
import { useRef, useState } from 'react';

const btn = 'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700';

export default function BlueprintSheet({ svg, filename }: { svg: string; filename: string }) {
  const box = useRef<HTMLDivElement>(null);

  function png() {
    const el = box.current?.querySelector('svg');
    if (!el) return;
    const vb = el.viewBox.baseVal;
    const copy = el.cloneNode(true) as SVGSVGElement; // standalone: the svg carries its own colours
    copy.setAttribute('width', String(vb.width));
    copy.setAttribute('height', String(vb.height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = vb.width * 2;
      c.height = vb.height * 2;
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `${filename}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  }

  function full() {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <div>
      <style>{`@page{size:landscape;margin:10mm}@media print{body *{visibility:hidden}body *:not(:has(.bp-print)):not(.bp-print):not(.bp-print *){display:none!important}.bp-print,.bp-print *{visibility:visible}.bp-print{position:absolute;left:0;top:0;width:100%;border:0!important}}`}</style>
      <div ref={box} aria-label="Blueprint sheet" className="bp-print overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[75vh] [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-label="Open full size" title="Open full size in a new tab" className={btn} onClick={full}><Icon name="arrow" />Full size</button>
        <button type="button" aria-label="Download PNG" title="Download PNG" className={btn} onClick={png}><Icon name="download" />PNG</button>
        <button type="button" aria-label="Print or save as PDF" title="Print or save as PDF" className={btn} onClick={() => window.print()}><Icon name="print" />PDF</button>
      </div>
    </div>
  );
}

export type Sheet = { title: string; svg: string; filename: string };

/** One blueprint at a time with a compact pager; no pager for a single sheet. `index` jumps the pager (selecting a part). */
export function BlueprintPager({ sheets, index, onIndex }: { sheets: Sheet[]; index: number; onIndex: (i: number) => void }) {
  const n = sheets.length;
  const i = Math.min(index, n - 1);
  const go = (d: number) => onIndex((i + d + n) % n);
  const nb = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700';
  const cur = sheets[i];
  return (
    <div
      tabIndex={n > 1 ? 0 : undefined}
      onKeyDown={(e) => {
        if (n < 2 || (e.target as HTMLElement).closest('button')) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      }}
      className="space-y-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-semibold text-gray-900 dark:text-gray-100">Blueprint: {cur.title}</h3>
        {n > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" aria-label="Previous drawing" title="Previous drawing" className={nb} onClick={() => go(-1)}>{'\u2039'}</button>
            <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300" aria-live="polite">{i + 1} / {n}</span>
            <button type="button" aria-label="Next drawing" title="Next drawing" className={nb} onClick={() => go(1)}>{'\u203a'}</button>
          </div>
        )}
      </div>
      <BlueprintSheet key={i} svg={cur.svg} filename={cur.filename} />
    </div>
  );
}
