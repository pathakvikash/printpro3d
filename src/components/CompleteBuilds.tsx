'use client';
// "Complete builds": finished kits first (photo), then the rest. Pure light data (kitMeta), no three or geometry, so it is safe on home and /shop first load.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { shopCatLabel } from '@/lib/catalog';
import { KIT_METAS, kitMetaPartCount, type KitMeta } from '@/lib/kitMeta';

// photo kits in this order, then the SO-101 arm (3D only), then everything else as listed
const FIRST = ['robot-dog', 'car-robot', 'open-rc-car', 'pocket-drone', 'humanoid-biped', 'so101-arm'];
const rank = (k: KitMeta) => { const i = FIRST.indexOf(k.id); return i < 0 ? FIRST.length : i; };
// the 3D thumbnail (three.js) loads only once the card is near the viewport; the cube tile stays until then
const loadKit = () => import('./KitShop');
function Thumb({ kit }: { kit: KitMeta }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mod, setMod] = useState<Awaited<ReturnType<typeof loadKit>> | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || mod) return;
    let on = true;
    const go = () => void loadKit().then((m) => on && setMod(m));
    if (typeof IntersectionObserver === 'undefined') { go(); return () => { on = false; }; }
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => { on = false; io.disconnect(); };
  }, [mod]);
  return (
    <span ref={ref} aria-hidden className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300">
      <Icon name="cube" className="h-12 w-12" />
      {mod && <span className="absolute inset-0 bg-white dark:bg-gray-900"><mod.KitThumbById id={kit.id} /></span>}
    </span>
  );
}

const ORDERED = KIT_METAS.filter((k) => k.hasAssembly).map((k, i) => ({ k, i })).sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i).map((x) => x.k);

export default function CompleteBuilds({ limit, id = 'builds-h', anchor }: { limit?: number; id?: string; anchor?: string }) {
  const kits = ORDERED.slice(0, limit);
  return (
    <section id={anchor} aria-labelledby={id} className="scroll-mt-20">
      <h2 id={id} className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Complete builds you can print</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Every printed part, ready to assemble. Electronics listed separately.</p>
      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {kits.map((k, i) => (
          <li key={k.id} className="w-64 shrink-0 snap-start sm:w-auto">
            <Link href={`/shop/${k.id}`} className="pp-lift group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-800 dark:bg-gray-900">
              {k.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={k.photo} alt={`${k.title}, finished build`} width={640} height={480} loading={i < 2 && limit === undefined ? 'eager' : 'lazy'} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <Thumb kit={k} />
              )}
              <span className="flex flex-1 flex-col gap-2 p-4">
                <span className="w-fit rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{shopCatLabel(k.category)}</span>
                <span className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">{k.title}</span>
                <span className="mt-auto flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{kitMetaPartCount(k)} printed parts</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">See price</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {limit !== undefined && (
        <p className="mt-3"><Link href="/shop#kits" className="font-medium text-indigo-600 underline underline-offset-4 hover:no-underline dark:text-indigo-400">See all kits</Link></p>
      )}
    </section>
  );
}
