import Link from 'next/link';
import { redirect } from 'next/navigation';
import HomeShop from '@/components/HomeShop';
import HeroPart from '@/components/HeroPart';
import HeroDrop from '@/components/HeroDrop';
import Capabilities from '@/components/Capabilities';
import { modelFor, pickProvider } from '@/lib/aiDesign';
import { BED_MM, MATERIALS, type MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

// read per request: the AI choice depends on MESHY_API_KEY at runtime, not at build time
export const dynamic = 'force-dynamic';

const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

// only claims the code backs: owner reviews each order and sends the payment link (api/orders), bed size from BED_MM
const TRUST = [
  { title: 'Every order is reviewed', text: 'A person checks your file and price before anything is printed.' },
  { title: 'Pay after we confirm', text: 'You get a payment link once we have confirmed the order. Nothing is charged at checkout.' },
  { title: `Up to ${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`, text: 'Largest part we can print in one piece.' },
] as const;

// old links were /?start=<step>; keep them working
const START_ROUTES: Record<string, string> = { file: '/quote', idea: '/request', ai: '/ai', design: '/draw', shop: '/shop', build: '/build', track: '/track' };

// three starting points, in the order a visitor is likely to be ready; each says what to bring and what happens next
const STARTS = [
  { href: '/quote', title: 'Have a 3D file?', text: 'Upload your STL or OBJ file to check your print price.', action: 'Get an instant quote' },
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
  { title: 'Start your way', text: 'Upload a file, describe an idea, or pick a ready item.' },
  { title: 'Choose material and quantity', text: 'The price updates as you choose.' },
  { title: 'We check, confirm and print', text: 'We review every order and send you a payment link before we print.' },
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
      {/* Hero: plain copy, a file box that hands off to /quote, one text link. The 3D part is a lazy client island. */}
      <section className="relative flex items-center overflow-hidden border-b border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white lg:min-h-[32rem]">
        <HeroPart />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">3D printing to order, from one piece to a batch.</h1>
            <p className="mt-5 text-lg text-gray-700 dark:text-gray-300">
              Send us an STL or OBJ file and see the price for each material. We review your order, then print and ship it.
            </p>
            <div className="mt-8">
              <HeroDrop />
            </div>
            <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">
              Just looking?{' '}
              <Link href="/build?example=shelf-bracket&price=1" className="font-medium text-indigo-700 underline underline-offset-4 hover:no-underline dark:text-indigo-400">Try a sample part</Link>
              . {FILE_PROMISE}
            </p>
          </div>
        </div>
      </section>

      <section aria-label="How we work" className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 md:gap-10">
          {TRUST.map((t) => (
            <div key={t.title}>
              <p className="font-semibold text-gray-900 dark:text-white">{t.title}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Capabilities />

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
      <section className="py-16 bg-gray-900 dark:bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready when you are</h2>
          <p className="mt-3 text-lg text-gray-300">
            Enter a quantity to see the price. We check every order before we print it.
          </p>
          <Link
            href="/quote"
            className="mt-8 inline-flex items-center justify-center px-8 py-4 rounded-md bg-white text-gray-900 font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            Get an instant quote
          </Link>
        </div>
      </section>
    </>
  );
}
