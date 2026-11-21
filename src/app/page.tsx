import Link from 'next/link';
import { redirect } from 'next/navigation';
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

// old links were /?start=<step>; keep them working
const START_ROUTES: Record<string, string> = { file: '/quote', idea: '/request', ai: '/ai', design: '/draw', shop: '/shop', build: '/build', track: '/track' };

// three starting points, in the order a visitor is likely to be ready; each says what to bring and what happens next
const STARTS = [
  { href: '/quote', title: 'Have a 3D file?', text: 'Upload your STL or OBJ file to check your print price.', action: 'Upload a file' },
  {
    href: '/request',
    title: 'Have an idea?',
    text: "Describe what you want to make or share a reference photo. We'll review it and get back to you with the next steps.",
    action: 'Describe your idea',
  },
  {
    href: '/request?type=replacement',
    title: 'Need a part reproduced?',
    text: "Share a photo and details of the original part. We'll review whether it can be reproduced.",
    action: 'Request a replacement',
  },
] as const;

// smaller, secondary tools; the AI ones appear only when their provider is configured
const MORE = [
  { href: '/build', label: 'Build from shapes' },
  { href: '/ai', label: 'Generate with AI', needs: 'ai' },
  { href: '/draw', label: 'Draw with AI', needs: 'design' },
] as const;

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

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { start, ...rest } = await searchParams;
  const target = typeof start === 'string' ? START_ROUTES[start] : undefined;
  if (target) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(rest)) for (const x of [v].flat()) if (x !== undefined) q.append(k, x);
    redirect(q.size ? `${target}?${q}` : target);
  }
  const provider = pickProvider(process.env);
  const designEnabled = (provider !== null && modelFor(provider, process.env) !== null) || process.env.NODE_ENV !== 'production';
  const aiEnabled = Boolean(process.env.MESHY_API_KEY);
  const more = MORE.filter((c) => !('needs' in c) || (c.needs === 'ai' ? aiEnabled : designEnabled));
  return (
    <>
      {/* Hero: text first, one primary action, one text link. The 3D part is a client island (desktop only). */}
      <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white">
        <HeroPart />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              Made-to-order 3D printing
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Upload a file.
              <br />
              Get a price.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">We print it.</span>
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
                href="/quote"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Get an instant quote
              </Link>
              <Link
                href="/build?example=shelf-bracket&price=1"
                className="inline-flex items-center justify-center px-2 py-4 text-lg font-medium text-indigo-300 underline underline-offset-4 hover:text-white"
              >
                Try a sample
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-400">{FILE_PROMISE}</p>
          </div>
        </div>
        <div aria-hidden className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-500">Scroll</span>
          <div className="flex h-8 w-5 justify-center rounded-full border-2 border-gray-700 pt-1.5">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
          </div>
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

      <section aria-labelledby="start-heading" className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="start-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Start with what you&apos;ve got.</h2>
          <p className="mt-3 max-w-xl text-gray-600 dark:text-gray-400">
            Have a 3D file, an idea, or an existing part? Choose a starting point and we&apos;ll take it from there.
          </p>
          <ol className="mt-10 border-t border-gray-300 dark:border-gray-700">
            {STARTS.map((c, i) => (
              <li key={c.title} className="border-b border-gray-300 dark:border-gray-700">
                <Link
                  href={c.href}
                  className="group grid gap-x-8 gap-y-2 py-7 sm:grid-cols-[3rem_1fr_13rem] sm:items-baseline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span aria-hidden className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">0{i + 1}</span>
                  <span>
                    <span className="block text-2xl font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{c.title}</span>
                    <span className="mt-2 block max-w-lg text-gray-600 dark:text-gray-400">{c.text}</span>
                  </span>
                  <span className="mt-2 font-semibold text-indigo-600 dark:text-indigo-400 sm:mt-0 sm:text-right">
                    <span className="underline-offset-4 group-hover:underline">{c.action}</span>
                    <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-1"> →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            More ways to create:{' '}
            {more.map((m, i) => (
              <span key={m.href}>
                {i > 0 && <span aria-hidden> · </span>}
                <Link href={m.href} className="font-medium text-gray-700 dark:text-gray-300 underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400">{m.label}</Link>
              </span>
            ))}
          </p>
        </div>
      </section>

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
          <p className="mt-6 text-center">
            <Link href="/shop" className="font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-4 hover:no-underline">
              See all parts
            </Link>
          </p>
          <p className="mt-10 text-center text-gray-600 dark:text-gray-400">
            Not in the list?{' '}
            <Link href="/request" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">
              Describe your idea
            </Link>{' '}
            or{' '}
            <Link href="/quote" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">
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
          <p className="mt-8">
            <Link href="/how-it-works" className="font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-4 hover:no-underline">
              More questions and answers
            </Link>
          </p>
        </div>
      </section>

      {/* Materials teaser: names only, details on /materials */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Materials</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Each material has its own live price on the quote step.</p>
          <p className="mt-6 text-lg text-gray-900 dark:text-white">{MATERIAL_KEYS.map((k) => MATERIAL_INFO[k].label).join(', ')}</p>
          <p className="mt-4">
            <Link href="/materials" className="font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-4 hover:no-underline">
              Compare materials
            </Link>
          </p>
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
            href="/quote"
            className="mt-8 inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-indigo-600 font-semibold text-lg hover:bg-indigo-50 transition-all duration-300 shadow-xl"
          >
            Get an instant quote
          </Link>
        </div>
      </section>
    </>
  );
}
