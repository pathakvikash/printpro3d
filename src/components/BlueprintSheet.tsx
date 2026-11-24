'use client';
// Renders a blueprint SVG string (from lib/blueprint.ts) with PNG and print buttons. No three.js.
import Icon from './Icon';
import { useRef } from 'react';

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

  return (
    <div>
      <style>{`@page{size:landscape;margin:10mm}@media print{body *{visibility:hidden}body *:not(:has(.bp-print)):not(.bp-print):not(.bp-print *){display:none!important}.bp-print,.bp-print *{visibility:visible}.bp-print{position:absolute;left:0;top:0;width:100%;border:0!important}}`}</style>
      <div ref={box} tabIndex={0} aria-label="Blueprint sheet, scrolls sideways on small screens" className="bp-print overflow-x-auto rounded-xl border border-gray-300 dark:border-gray-700 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:min-w-[760px]" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 sm:hidden">Swipe the sheet sideways to see all of it.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-label="Download PNG" title="Download PNG" className={btn} onClick={png}><Icon name="download" />PNG</button>
        <button type="button" aria-label="Print or save as PDF" title="Print or save as PDF" className={btn} onClick={() => window.print()}><Icon name="print" />PDF</button>
      </div>
    </div>
  );
}
