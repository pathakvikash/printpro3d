'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from './CartProvider';

const LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/quote', label: 'Get a quote' },
  { href: '/build', label: 'Build' },
  { href: '/materials', label: 'Materials' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/track', label: 'Track order' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
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

  // close the mobile panel on route change and on Escape
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

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

          {/* Page links: desktop */}
          <ul className='hidden md:flex items-center gap-1 ml-6 mr-auto'>
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

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
              href='/quote'
              className='px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 whitespace-nowrap'
            >
              Start a project
            </Link>

            {/* Hamburger: mobile */}
            <button
              type='button'
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-controls='mobile-menu'
              aria-label={menu ? 'Close menu' : 'Open menu'}
              className='md:hidden rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            >
              <svg aria-hidden='true' className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d={menu ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menu && (
        <ul id='mobile-menu' className='md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2'>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={`block rounded-lg px-3 py-3 text-base font-medium ${pathname === l.href ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
