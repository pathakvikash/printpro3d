'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import Logo from './Logo';
import { useCart } from './CartProvider';
import { business, phoneHref } from '@/lib/contact';

const LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/playground', label: 'Playground' },
];
// the account/settings menu; Theme is a button, added by the menu itself
const MENU_LINKS = [
  { href: '/track', label: 'Track order' },
  { href: '/playground?mode=build', label: 'My designs' },
  { href: '/my-items', label: 'My items' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/materials', label: 'Materials guide' },
];
const itemCls = 'block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-indigo-500';
const iconBtn = 'rounded-lg p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

export default function Navbar() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [acct, setAcct] = useState(false);
  const acctBox = useRef<HTMLDivElement>(null);
  const acctBtn = useRef<HTMLButtonElement>(null);
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

  // close the panels on route change; Escape closes either (the account menu hands focus back to its button)
  useEffect(() => { setMenu(false); setAcct(false); }, [pathname]);
  useEffect(() => {
    if (!menu && !acct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      if (acct) { setAcct(false); acctBtn.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => { if (acct && !acctBox.current?.contains(e.target as Node)) setAcct(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [menu, acct]);
  useEffect(() => { if (acct) acctBox.current?.querySelector<HTMLElement>('#account-menu a')?.focus(); }, [acct]);

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
          <Link href='/' aria-label='PrintPro3D home' className='text-gray-900 dark:text-white'>
            <Logo size={28} />
          </Link>

          {/* Page links: desktop */}
          <ul className='hidden md:flex items-center gap-1 ml-6 mr-auto'>
            {LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`px-2 lg:px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right side */}
          <div className='flex items-center gap-1 sm:gap-4'>
            {business.phone && (
              <a href={`tel:${phoneHref}`} className='hidden xl:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white whitespace-nowrap'>
                {business.phone}
              </a>
            )}
            {/* Cart: opens the drawer */}
            <button
              type='button'
              onClick={() => openCart('cart')}
              aria-label={count > 0 ? `Open cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open cart'}
              title='Open cart'
              className={`relative ${iconBtn}`}
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

            {/* Account / settings menu: desktop (the hamburger mirrors it on mobile) */}
            <div ref={acctBox} className='relative hidden md:block' onBlur={(e) => { if (e.relatedTarget && !acctBox.current?.contains(e.relatedTarget)) setAcct(false); }}>
              <button
                ref={acctBtn}
                type='button'
                onClick={() => setAcct((o) => !o)}
                aria-expanded={acct}
                aria-controls='account-menu'
                aria-label='Account and settings'
                title='Account and settings'
                className={iconBtn}
              >
                <svg aria-hidden='true' className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0' />
                </svg>
              </button>
              {acct && (
                <ul id='account-menu' className='absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900'>
                  {MENU_LINKS.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={itemCls}>{l.label}</Link>
                    </li>
                  ))}
                  <li className='border-t border-gray-200 dark:border-gray-700 mt-1 pt-1'>
                    <button type='button' onClick={toggleTheme} aria-label='Switch theme' title='Switch theme' className={`${itemCls} w-full whitespace-nowrap text-left`}>
                      Theme: {mounted && theme === 'dark' ? 'Dark' : 'Light'}
                    </button>
                  </li>
                </ul>
              )}
            </div>

            <Link
              href='/quote'
              aria-label='Get a quote'
              title='Get a quote'
              className='inline-flex min-h-10 items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'
            >
              <Icon name='tag' className='h-4 w-4 hidden sm:block' />Quote
            </Link>

            {/* Hamburger: mobile */}
            <button
              type='button'
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-controls='mobile-menu'
              aria-label={menu ? 'Close menu' : 'Open menu'}
              title={menu ? 'Close menu' : 'Open menu'}
              className={`md:hidden ${iconBtn}`}
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
          {[...LINKS, ...MENU_LINKS].map((l, i) => (
            <li key={l.href} className={i === LINKS.length ? 'mt-1 border-t border-gray-200 pt-1 dark:border-gray-800' : undefined}>
              <Link
                href={l.href}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={`block rounded-lg px-3 py-3 text-base font-medium ${pathname === l.href ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li className='mt-1 border-t border-gray-200 pt-1 dark:border-gray-800'>
            <button type='button' onClick={toggleTheme} aria-label='Switch theme' title='Switch theme' className='block w-full rounded-lg px-3 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300'>
              Theme: {mounted && theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
