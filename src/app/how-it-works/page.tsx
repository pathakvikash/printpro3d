import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { BED_MM } from '@/lib/quote';

export const metadata: Metadata = { title: 'How it works - PrintPro3D', description: 'How ordering works, from your file or idea to a printed part, and answers to common questions.' };

const STEPS = [
  { title: 'Start your way', text: 'Upload a file, describe an idea, or open one of our designs.' },
  { title: 'Choose material and quantity', text: 'The price updates as you choose.' },
  { title: 'We check, confirm and print', text: 'We review every order and send you a payment link before we print.' },
];

const FAQ = [
  { q: 'Which file types can I upload?', a: 'STL and OBJ. No file? Describe your idea and we design it.' },
  { q: 'How big can a part be?', a: `Up to ${BED_MM.x} × ${BED_MM.y} × ${BED_MM.z} mm. The quote tells you if your file does not fit.` },
  { q: 'How long does it take?', a: 'We confirm the turnaround in the review email we send after you order.' },
  { q: 'How do I pay?', a: 'There is no online payment yet. After we review your order we send you a payment link.' },
  { q: 'Is the price final?', a: 'The price on the site is an instant quote. We check every order and confirm it before we print.' },
  { q: 'What do you do with my files?', a: 'We use your files only to quote and print your order.' },
  { q: 'How do I track my order?', a: 'Use the order id from your confirmation on the Track page.' },
];

export default function HowItWorksPage() {
  return (
    <PageShell wide title="How it works" lead="From file or idea to a printed part.">
      <ol className="grid gap-10 md:grid-cols-3 pt-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-indigo-600 pt-5">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Step {i + 1}</p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{s.text}</p>
          </li>
        ))}
      </ol>
      <h2 className="pt-10 text-2xl font-bold text-gray-900 dark:text-white">Questions</h2>
      <dl className="divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
        {FAQ.map((f) => (
          <div key={f.q} className="py-5">
            <dt className="font-semibold text-gray-900 dark:text-white">{f.q}</dt>
            <dd className="mt-1 text-gray-600 dark:text-gray-300">
              {f.a}
              {f.q.startsWith('How do I track') && <> <Link href="/track" className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline">Track an order</Link>.</>}
            </dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
