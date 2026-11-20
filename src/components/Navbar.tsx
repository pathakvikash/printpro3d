'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from './CartProvider';

export default function Navbar() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const { count, openCart } = useCart();

  useEffect(() => {
    setMounted(true);
    let initial: 'light' | 'dark' = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    try {
      const stored = window.localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') initial = stored;
    } catch {
      // storage unavailable (private mode): fall back to OS preference
    }
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        window.localStorage.setItem('theme', next);
      } catch {
        // storage unavailable: theme still applies for this page view
      }
      return next;
    });
  };

  return (
    <nav className='sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6'>
        <div className='flex items-center justify-between h-16'>
          <Link href='/' className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white'>
            PrintPro<span className='text-indigo-500'>3D</span>
          </Link>

          {/* Right side */}
          <div className='flex items-center gap-1 sm:gap-4'>
            {/* Theme toggle */}
            <button
              aria-label='Toggle theme'
              onClick={toggleTheme}
              className='rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            >
              {mounted && theme === 'dark' ? (
                <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3m16.66 6.66l-.71-.71M4.05 4.93l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z' />
                </svg>
              ) : (
                <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z' />
                </svg>
              )}
            </button>

            {/* Cart: opens the drawer */}
            <button
              type='button'
              onClick={() => openCart('cart')}
              aria-label={count > 0 ? `Open cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open cart'}
              className='relative rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            >
              <svg aria-hidden='true' className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' />
              </svg>
              {count > 0 && (
                <span
                  aria-hidden='true'
                  className='absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-xs font-semibold text-white'
                >
                  {count}
                </span>
              )}
            </button>

            <Link
              href='/?start=track#start'
              className='hidden min-[400px]:inline-block px-2 sm:px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap'
            >
              Track order
            </Link>
            <Link
              href='/#start'
              className='px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 whitespace-nowrap'
            >
              Start a project
            </Link>
          </div>
        </div>

      </div>
    </nav>
  );
}
