import Link from 'next/link';
import Logo from './Logo';
import { business } from '@/lib/contact';
import { BASED_LINE } from '@/lib/business';

const COLUMNS = [
  { title: 'Order', links: [['/quote', 'Get a quote'], ['/request', 'Describe your idea'], ['/shop', 'Shop'], ['/build', 'Build it yourself'], ['/track', 'Track order']] },
  { title: 'Learn', links: [['/materials', 'Materials'], ['/build', 'Build and simulate'], ['/how-it-works', 'How it works'], ['/about', 'About'], ['/contact', 'Contact']] },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row md:justify-between gap-8">
        <div>
          <Link href="/" aria-label="PrintPro3D home" className="inline-block text-white">
            <Logo size={32} />
          </Link>
          <p className="mt-2 text-sm text-gray-400">Custom 3D prints and designs, from one piece to wholesale.</p>
          <p className="mt-1 text-sm text-gray-400">{BASED_LINE}</p>
        </div>
        <div className="flex gap-12 text-sm">
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="font-semibold text-white">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-gray-400 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {(business.name || business.city || business.gstin) && (
          <div className="pt-6 border-t border-gray-800 text-sm text-gray-400 space-y-1">
            {business.name && <p>{business.name}</p>}
            {business.city && <p>{business.city}</p>}
            {business.gstin && <p>GSTIN: {business.gstin}</p>}
          </div>
        )}
        <p className={`pt-6 text-sm text-gray-400 ${business.name || business.city || business.gstin ? 'mt-6' : 'border-t border-gray-800'}`}>© {currentYear} PrintPro3D</p>
      </div>
    </footer>
  );
}
