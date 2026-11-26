import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = { title: 'Privacy - PrintPro3D', description: 'What PrintPro3D collects, why, where it is kept and how to have it deleted.' };

// Plain facts about what the code stores (src/lib/store.ts namespaces, src/auth.ts, notify.ts, aiProviders.ts). Keep in step with them.
const sections: [string, string[]][] = [
  ['What we collect', [
    'When you order or send a request: your name, phone number, email, delivery address and PIN code, the items and settings you chose, and any 3D files or photos you upload.',
    'When you sign in with Google: your Google name, email address and Google account ID. We do not get your Google password or any other Google data.',
    'When you use the AI design tools: the text and photos you send, so the AI can draw your part.',
  ]],
  ['Why', [
    'To price, print, ship and support your order, to contact you about it, and to show your orders on My orders when you are signed in.',
    'We do not sell your data, and we do not use it for advertising.',
  ]],
  ['Where it is kept', [
    'Orders, requests and uploaded files are stored privately with our hosting provider, Vercel (Vercel Blob storage). Only the shop owner can see them, after signing in.',
    'AI prompts are sent to the AI provider that powers the design tools, only to create your design.',
    'Order emails, when enabled, are sent through an email delivery service.',
  ]],
  ['Cookies', [
    'If you sign in, a session cookie keeps you signed in. Your cart and theme choice are kept in your own browser. There are no advertising or tracking cookies.',
  ]],
  ['Keeping and deleting', [
    'We keep order records as long as needed to fulfil the order and meet legal and tax requirements. You can ask us to delete your account data or a request at any time from the contact page.',
  ]],
];

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" lead="PrintPro3D is a made-to-order 3D printing service in Patna, Bihar, delivering within India. This page says what we keep about you and why.">
      {sections.map(([h, ps]) => (
        <section key={h} className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{h}</h2>
          {ps.map((p) => <p key={p} className="text-gray-700 dark:text-gray-300">{p}</p>)}
        </section>
      ))}
      <p className="text-gray-700 dark:text-gray-300">Questions or a deletion request: <Link href="/contact" className="text-indigo-600 underline dark:text-indigo-400">contact us</Link>.</p>
    </PageShell>
  );
}
