import type { Metadata } from 'next';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { ArtTile } from '@/components/Art';
import PageShell from '@/components/PageShell';
import { BED_MM, CURRENCY, MAX_QTY, MIN_ORDER, SETUP_FEE } from '@/lib/quote';
import { ORDER_STAGES } from '@/lib/tracking';
import { ALLOWED_EXTS, MAX_UPLOAD } from '@/lib/uploadRules';

export const metadata: Metadata = { title: 'How it works - PrintPro3D', description: 'How ordering works, from your file or idea to a printed part, and answers to common questions.' };

const STEPS = [
  { icon: 'upload', title: 'Start your way', text: 'Upload your file, describe an idea or a part to replace, or pick a ready item.' },
  { icon: 'layers', title: 'Choose material and quantity', text: 'The price updates as you choose.' },
  { icon: 'clipboard', title: 'We review, confirm and print', text: 'We review every order and send you a payment link before we print it.' },
] as const;

const FAQ = [
  { q: 'Which file types can I upload?', a: `${ALLOWED_EXTS.map((e) => e.slice(1).toUpperCase()).join(', ')}, up to ${MAX_UPLOAD / 1024 / 1024} MB. STL and OBJ files get an instant price. Other types are quoted by hand.` },
  { q: 'How is the price calculated?', a: `The server works out the part's volume from your file, turns it into grams for the material you pick, and multiplies by that material's rate. A flat setup fee of ${CURRENCY} ${SETUP_FEE} applies per model line, and each uploaded model line costs at least ${CURRENCY} ${MIN_ORDER}. Rates are on the Materials page.` },
  { q: 'When do I pay?', a: 'After we review your order. There is no online payment at checkout. We send you a payment link, and printing starts once it is paid.' },
  { q: 'What happens to my order after I place it?', a: 'It is saved as pending review. We check the file and the price, confirm it, and then ask for payment. Open the Track page to see where it is.' },
  { q: 'How do I track my order?', a: `Enter the order id from your confirmation on the Track page. Orders move through: ${ORDER_STAGES.join(', ')}.` },
  { q: 'What do you do with my files?', a: 'We use your files only to quote and print your order. They are stored under a random file name.' },
  { q: 'How many can I order?', a: `Up to ${MAX_QTY} of one model per order line. For more, use the wholesale option on the idea form.` },
  { q: 'What if my model cannot be printed?', a: `If it is larger than ${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm in every orientation, the quote tells you it does not fit. If the mesh is open or broken, it cannot be priced automatically, so we review it and send you a quote by hand.` },
  { q: 'Can you make a replacement for a broken part?', a: <>Yes. Use the <Link href="/request?type=replacement" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">replacement form</Link> and tell us about the original part. We review it first and send you a quote before anything is printed.</> },
  { q: 'I have no file. What can I do?', a: 'Describe your idea on the idea form, with optional size, quantity and reference images. We review it and reply with a quote. You can also pick a ready item in the shop or build a part yourself.' },
];

export default function HowItWorksPage() {
  return (
    <PageShell wide title="How it works" lead="From file or idea to a printed part.">
      <ol className="relative grid gap-6 md:grid-cols-3 pt-4">
        <span aria-hidden className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-indigo-200 dark:bg-indigo-500/30 md:block" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="pp-rise relative pt-2">
            <div className="flex items-center gap-3">
              <ArtTile className="relative ring-4 ring-white dark:ring-gray-950"><Icon name={s.icon} className="h-6 w-6" /></ArtTile>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Step {i + 1}</p>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{s.text}</p>
          </li>
        ))}
      </ol>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">What happens to an order</h2>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ORDER_STAGES.map((n, i) => (
            <li key={n} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
              <span className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400">{i + 1}</span>{n}
            </li>
          ))}
        </ol>
      </div>
      <h2 className="pt-10 text-2xl font-bold text-gray-900 dark:text-white">Questions</h2>
      <div className="grid items-start gap-x-10 border-t border-gray-200 dark:border-gray-800 md:grid-cols-2">
        {FAQ.map((f) => (
          <details key={f.q} className="border-b border-gray-200 py-4 dark:border-gray-800">
            <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">{f.q}</summary>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="text-gray-600 dark:text-gray-300">
        <Link href="/quote" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">Get an instant quote</Link>,{' '}
        <Link href="/shop" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">browse the shop</Link>,{' '}
        <Link href="/request" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">describe an idea</Link> or{' '}
        <Link href="/track" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">track an order</Link>.
      </p>
    </PageShell>
  );
}
