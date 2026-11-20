import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <Link href="/" className="text-xl font-bold text-white">
            PrintPro<span className="text-indigo-400">3D</span>
          </Link>
          <p className="mt-2 text-sm text-gray-400">Custom 3D prints and designs, from one piece to wholesale.</p>
        </div>
        <ul className="flex gap-6 text-sm">
          <li><Link href="/#start" className="text-gray-400 hover:text-white transition-colors">Start a project</Link></li>
          <li><Link href="/?start=track#start" className="text-gray-400 hover:text-white transition-colors">Track order</Link></li>
        </ul>
      </div>
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <p className="pt-6 border-t border-gray-800 text-sm text-gray-500">© {currentYear} PrintPro3D</p>
      </div>
    </footer>
  );
}
