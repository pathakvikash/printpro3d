'use client';

import Icon from './Icon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { setPendingFile } from '@/lib/pendingFile';
import { ALLOWED_EXTS, MAX_UPLOAD, fileProblem } from '@/lib/uploadRules';

// Home-page file box: keeps the picked file for /quote, which starts the normal upload and price flow.
export default function HeroDrop() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f?: File) => {
    if (!f) return;
    const err = fileProblem(f.name, f.size);
    if (err) return setError(err);
    setPendingFile(f);
    router.push('/quote');
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={`rounded-lg border-2 border-dashed p-6 transition-colors ${over ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40' : 'border-gray-300 bg-white/80 dark:border-gray-700 dark:bg-gray-900/60'}`}
      >
        <p className="font-medium text-gray-900 dark:text-white">Drop your 3D file here</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">STL and OBJ get an instant price; other types are quoted by hand. Up to {MAX_UPLOAD / 1024 / 1024} MB. You see the price before you order.</p>
        <input ref={input} type="file" accept={ALLOWED_EXTS.join(',')} className="sr-only" aria-label="Choose a 3D file" onChange={(e) => take(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Icon name="bolt" className="mr-2 h-4 w-4" />Get an instant quote
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        No file?{' '}
        <Link href="/request" className="font-medium text-indigo-700 underline underline-offset-4 hover:no-underline dark:text-indigo-400">Describe your idea</Link>
      </p>
    </div>
  );
}
