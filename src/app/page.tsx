import { Suspense } from 'react';
import Link from 'next/link';
import ProjectFlow from '@/components/ProjectFlow';
import HomeShop from '@/components/HomeShop';
import HeroPart from '@/components/HeroPart';
import { modelFor, pickProvider } from '@/lib/aiDesign';
import { CATALOG } from '@/lib/catalog';
import { BED_MM, MATERIALS, MAX_QTY, type MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

// read per request: the AI choice depends on MESHY_API_KEY at runtime, not at build time
export const dynamic = 'force-dynamic';

const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

const FACTS = [
  { value: String(MATERIAL_KEYS.length), label: 'Plastics', note: MATERIAL_KEYS.join(', ') },
  { value: String(CATALOG.length), label: 'Ready-made parts', note: 'Our own designs, printed to order' },
  { value: `${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`, label: 'Largest part', note: 'Print volume' },
  { value: `1 to ${MAX_QTY}+`, label: 'Pieces per order', note: 'More on request' },
];

const STEPS = [
  { title: 'Start your way', text: 'Upload a file, describe an idea, or open one of our designs.' },
  { title: 'Choose material and quantity', text: 'The price updates as you choose.' },
  { title: 'We check, confirm and print', text: 'We review every order and send you a payment link before we print.' },
];

const CHECKS = [
  'Instant price for most STL and OBJ files',
  'No file? Describe it, or start from one of our designs',
  'One piece up to 100+ units',
];

// OWNER: confirm this statement matches how you handle files
const FILE_PROMISE = 'We use your files only to quote and print your order.';

export default function Home() {
  const provider = pickProvider(process.env);
  const designEnabled = (provider !== null && modelFor(provider, process.env) !== null) || process.env.NODE_ENV !== 'production';
  return (
    <>
      {/* Hero: text first, one primary action, one text link. The 3D part is a client island (desktop only). */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Upload a file.
              <br />
              Get a price.
              <br />
              We print it.
            </h1>
            <ul className="mt-8 space-y-3 text-lg text-gray-300">
              {CHECKS.map((c) => (
                <li key={c} className="flex gap-3">
                  <span aria-hidden className="text-indigo-400">–</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/?start=file#start"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Get an instant quote
              </Link>
              <Link
                href="/?start=build&example=shelf-bracket&price=1#start"
                className="inline-flex items-center justify-center px-2 py-4 text-lg font-medium text-indigo-300 underline underline-offset-4 hover:text-white"
              >
                Try a sample
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-400">{FILE_PROMISE}</p>
          </div>
          <HeroPart />
        </div>
      </section>

      {/* Facts: computed from the config, so they stay true when the price list or bed size changes */}
      <section aria-label="At a glance" className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-gray-200 dark:lg:divide-gray-800">
          {FACTS.map((f, i) => (
            <div key={f.label} className={`${i === 0 ? '' : 'lg:pl-8'} ${i === FACTS.length - 1 ? '' : 'lg:pr-8'}`}>
              <dt className="text-sm text-gray-500 dark:text-gray-400">{f.label}</dt>
              <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{f.value}</dd>
              <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">{f.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Suspense fallback={null}>
        <ProjectFlow aiEnabled={Boolean(process.env.MESHY_API_KEY)} designEnabled={designEnabled} />
      </Suspense>

      {/* Ready to print: the shop itself, so the parts are the first thing a visitor sees */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Ready to print</h2>
          <p className="mt-3 text-center text-gray-500 dark:text-gray-400">
            Our own designs, printed to order. Tap a part to see it in 3D.
          </p>
          <div className="mt-10">
            <HomeShop />
          </div>
          <p className="mt-10 text-center text-gray-600 dark:text-gray-400">
            Not in the list?{' '}
            <Link href="/?start=idea#start" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">
              Describe your idea
            </Link>{' '}
            or{' '}
            <Link href="/?start=file#start" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">
              Upload a 3D file
            </Link>
            .
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How it works</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-indigo-600 pt-5">
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Step {i + 1}</p>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Materials: a plain list, one line per material */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Materials</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Each material has its own live price on the quote step.</p>
          <dl className="mt-10 divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
            {MATERIAL_KEYS.map((k) => (
              <div key={k} className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt className="font-semibold text-gray-900 dark:text-white">{MATERIAL_INFO[k].label}</dt>
                <dd className="text-gray-600 dark:text-gray-300">{MATERIAL_INFO[k].blurb}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* One closing call to action */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-indigo-500">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">From one piece to wholesale</h2>
          <p className="mt-4 text-lg text-indigo-100">
            Enter a quantity to see the price. We check every order before we print it.
          </p>
          <Link
            href="/#start"
            className="mt-8 inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-indigo-600 font-semibold text-lg hover:bg-indigo-50 transition-all duration-300 shadow-xl"
          >
            Get an instant quote
          </Link>
        </div>
      </section>
    </>
  );
}
