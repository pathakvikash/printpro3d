import Link from 'next/link';
import Icon, { type IconName } from '@/components/Icon';
import { ArtTile, BedArt, StartArt } from '@/components/Art';
import { redirect } from 'next/navigation';
import CompleteBuilds from '@/components/CompleteBuilds';
import HomeKits from '@/components/HomeKits';
import { SHOP_CATEGORIES } from '@/lib/catalog';
import HeroPart from '@/components/HeroPart';
import HeroDrop from '@/components/HeroDrop';
import Capabilities from '@/components/Capabilities';
import MaterialCards from '@/components/MaterialCards';
import FlowStrip from '@/components/FlowStrip';
import { modelFor, pickProvider } from '@/lib/aiDesign';
import { aiEnv } from '@/lib/aiSettings';
import { BED_MM } from '@/lib/quote';

// read per request: the AI choice depends on MESHY_API_KEY at runtime, not at build time
export const dynamic = 'force-dynamic';

// only claims the code backs: owner reviews each order and sends the payment link (api/orders), bed size from BED_MM
const TRUST: { title: string; text: string; icon: IconName | 'bed' }[] = [
  { icon: 'userCheck', title: 'Every order is reviewed', text: 'A person checks your file and price before anything is printed.' },
  { icon: 'link', title: 'Pay after we confirm', text: 'You get a payment link once we have confirmed the order. Nothing is charged at checkout.' },
  { icon: 'bed', title: `Up to ${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm`, text: 'Largest part we can print in one piece.' },
];

// old links were /?start=<step>; keep them working
const START_ROUTES: Record<string, string> = { file: '/quote', idea: '/request', ai: '/ai', design: '/draw', shop: '/shop', build: '/playground?mode=build', track: '/track' };

// three starting points, in the order a visitor is likely to be ready; each says what to bring and what happens next
const STARTS = [
  { href: '/quote', art: 'file', title: 'Have a 3D file?', text: 'Upload your STL or OBJ file to check your print price.', action: 'Quote' },
  {
    href: '/request',
    art: 'idea',
    title: 'Have an idea?',
    text: "Describe what you want to make or share a reference photo. We'll review it and get back to you with the next steps.",
    action: 'Describe',
  },
  {
    href: '/request?type=replacement',
    art: 'part',
    title: 'Need a part reproduced?',
    text: "Share a photo and details of the original part. We'll review whether it can be reproduced.",
    action: 'Replace',
  },
] as const;

// smaller, secondary tools; the AI ones appear only when their provider is configured
const MORE = [
  { href: '/playground?mode=build', label: 'Build from shapes', icon: 'shapes' },
  { href: '/ai', label: 'Build with AI', icon: 'spark' }, // the chat says itself when AI is off
  { href: '/draw', label: 'Draw with AI', icon: 'edit', needs: 'design' },
] as const;

const STEPS = [
  { icon: 'upload', title: 'Start your way', text: 'Upload a file, describe an idea, or pick a ready item.', links: [{ href: '/quote', label: 'Upload a file' }, { href: '/shop', label: 'Shop' }, { href: '/request', label: 'Describe an idea' }] },
  { icon: 'layers', title: 'Choose material and quantity', text: 'The price updates as you choose.', links: [{ href: '/materials', label: 'Compare materials' }] },
  { icon: 'clipboard', title: 'We check, confirm and print', text: 'We review every order and send you a payment link before we print.', links: [{ href: '/track', label: 'Track an order' }] },
] as const;

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
  const env = await aiEnv();
  const provider = pickProvider(env);
  const designEnabled = (provider !== null && modelFor(provider, env) !== null) || process.env.NODE_ENV !== 'production';
  const more = MORE.filter((c) => !('needs' in c) || designEnabled);
  return (
    <>
      {/* Hero: plain copy, a file box that hands off to /quote, one text link. The 3D part is a lazy client island. */}
      <section className="relative flex items-center overflow-hidden border-b border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white lg:min-h-[32rem]">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden dark:block" style={{ background: 'radial-gradient(60% 80% at 85% 20%, rgb(109 74 224 / 0.28), transparent 70%)' }} />
        <HeroPart />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-xl">
            <h1 className="pp-rise text-4xl font-bold leading-tight tracking-tight sm:text-5xl">3D printing to order, from one piece to a batch.</h1>
            <p className="mt-5 text-lg text-gray-700 dark:text-gray-300">
              Send us an STL or OBJ file and see the price for each material. We review your order, then print and ship it.
            </p>
            <div className="mt-8">
              <HeroDrop />
            </div>
            <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">
              Just looking?{' '}
              <Link href="/playground?mode=build&example=shelf-bracket&price=1" className="font-medium text-indigo-700 underline underline-offset-4 hover:no-underline dark:text-indigo-400">Try a sample part</Link>
              . {FILE_PROMISE}
            </p>
          </div>
        </div>
      </section>

      <div className="border-b border-gray-200 bg-white py-10 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6"><CompleteBuilds limit={8} id="complete-builds-h" /></div>
      </div>

      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950 sm:px-6">
        <div className="mx-auto max-w-7xl"><FlowStrip current="pick" /></div>
      </div>

      <section aria-label="How we work" className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 md:gap-10">
          {TRUST.map((t) => (
            <div key={t.title} className="pp-lift pp-rise flex gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
              {t.icon === 'bed' ? <BedArt /> : <ArtTile><Icon name={t.icon} className="h-6 w-6" /></ArtTile>}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{t.title}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Capabilities />

      <section aria-labelledby="start-heading" className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 id="start-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Start with what you&apos;ve got.</h2>
          <p className="mt-3 max-w-xl text-gray-600 dark:text-gray-400">
            Have a 3D file, an idea, or an existing part? Choose a starting point and we&apos;ll take it from there.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STARTS.map((c, i) => (
              <li key={c.title}>
                <Link
                  href={c.href}
                  className="pp-lift group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span className="flex items-center justify-between">
                    <span aria-hidden className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">0{i + 1}</span>
                    <span aria-hidden className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"><StartArt kind={c.art} /></span>
                  </span>
                  <span className="mt-2 block text-xl font-semibold text-gray-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">{c.title}</span>
                  <span className="mt-2 block flex-1 text-gray-600 dark:text-gray-400">{c.text}</span>
                  <span className="mt-4 font-semibold text-indigo-600 dark:text-indigo-400">
                    <span className="underline-offset-4 group-hover:underline">{c.action}</span>
                    <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-1"> →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">More ways to create</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {more.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:border-indigo-500 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:text-indigo-300">
                  <Icon name={m.icon} className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />{m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured builds: the complete kits, shown assembled */}
      <section aria-labelledby="featured-h" className="bg-white py-14 dark:bg-gray-950 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="featured-h" className="text-3xl font-bold text-gray-900 dark:text-white">Featured builds</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Complete kits of our own designs: every printed part, with the list of what to buy.</p>
          <ul aria-label="Shop by category" className="mt-6 flex flex-wrap gap-2">
            {[...SHOP_CATEGORIES.filter((c) => c.id !== 'accessories').map((c) => ({ href: `/shop?cat=${c.id}`, label: c.label })), { href: '/shop#parts-h', label: 'Electronics & parts' }].map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">{c.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-8"><HomeKits /></div>
          <p className="mt-6 text-gray-600 dark:text-gray-400">
            <Link href="/shop" className="font-medium text-indigo-600 underline underline-offset-4 hover:no-underline dark:text-indigo-400">See everything in the shop</Link>
            {' · '}Not in the list?{' '}
            <Link href="/request" className="text-indigo-600 underline hover:no-underline dark:text-indigo-400">Describe your idea</Link> or{' '}
            <Link href="/quote" className="text-indigo-600 underline hover:no-underline dark:text-indigo-400">upload a 3D file</Link>.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How it works</h2>
          <ol className="relative mt-10 grid gap-6 md:grid-cols-3">
            <span aria-hidden className="absolute left-[2.1rem] top-8 bottom-8 w-px bg-indigo-200 dark:bg-indigo-500/30 md:hidden" />
            <span aria-hidden className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-indigo-200 dark:bg-indigo-500/30 md:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="pp-lift pp-rise relative rounded-xl border border-gray-200 border-t-2 border-t-indigo-600 bg-white p-5 dark:border-gray-800 dark:border-t-indigo-500 dark:bg-gray-950">
                <div className="flex items-center gap-3">
                  <ArtTile className="relative ring-4 ring-white dark:ring-gray-950"><Icon name={s.icon} className="h-6 w-6" /></ArtTile>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Step {i + 1}</p>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{s.text}</p>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                  {s.links.map((l) => (
                    <Link key={l.href} href={l.href} className="text-indigo-600 underline underline-offset-4 hover:no-underline dark:text-indigo-400">{l.label}</Link>
                  ))}
                </p>
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

      {/* Materials teaser: the same cards as /materials; details there */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Materials</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Each material has its own live price on the quote step.</p>
          <div className="mt-8"><MaterialCards /></div>
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
            aria-label="Get an instant quote"
            title="Get an instant quote"
            className="mt-8 inline-flex min-h-12 whitespace-nowrap items-center justify-center px-8 py-4 rounded-md bg-white text-gray-900 font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            <Icon name="bolt" className="mr-2 h-5 w-5" />Quote
          </Link>
        </div>
      </section>
    </>
  );
}
