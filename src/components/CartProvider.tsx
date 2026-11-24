'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';
import { addLine, parseCart, parseSaved, removeLine, setQty, toggleSaved, type CartLine } from '@/lib/cart';

export const CART_KEY = 'printpro3d.cart.v1';
export const SAVED_KEY = 'printpro3d.saved.v1';
const TOAST_MS = 4000;
const UNDO_MS = 8000;

export type CartTab = 'cart' | 'saved';

type CartContextValue = {
  lines: CartLine[];
  saved: string[];
  count: number;
  ready: boolean;
  drawerOpen: boolean;
  drawerTab: CartTab;
  focusCheckout: boolean; // true when the drawer was opened to go straight to checkout
  openCart:(tab?: CartTab, focus?: 'checkout') => void;
  closeCart: () => void;
  add: (line: CartLine) => void;
  setLineQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toggle: (savedKey: string) => void;
  isSaved: (savedKey: string) => boolean;
  toast: (message: string, viewCart?: boolean, undo?: () => void) => void; // undo: shows an Undo button (kept longer) that runs it
};

const CartContext = createContext<CartContextValue | null>(null);

// Storage can be blocked (private mode, disabled site data): every access is guarded.
function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    const next = JSON.stringify(value);
    // compare first: a write fires `storage` in other tabs, which would write back and loop
    if (window.localStorage.getItem(key) !== next) window.localStorage.setItem(key, next);
  } catch {
    // storage blocked: the cart still works for this page view
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<CartTab>('cart');
  const [focusCheckout, setFocusCheckout] = useState(false);
  const [toastState, setToastState] = useState<{ message: string; viewCart: boolean; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // loaded after mount so the server HTML and the first render both start empty
  useEffect(() => {
    setLines(parseCart(readJson(CART_KEY)));
    setSaved(parseSaved(readJson(SAVED_KEY)));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CART_KEY) setLines(parseCart(readJson(CART_KEY)));
      if (e.key === null || e.key === SAVED_KEY) setSaved(parseSaved(readJson(SAVED_KEY)));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (ready) writeJson(CART_KEY, lines);
  }, [lines, ready]);

  useEffect(() => {
    if (ready) writeJson(SAVED_KEY, saved);
  }, [saved, ready]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const add = useCallback((line: CartLine) => setLines((cur) => addLine(cur, line)), []);
  const setLineQty = useCallback((key: string, qty: number) => setLines((cur) => setQty(cur, key, qty)), []);
  const remove = useCallback((key: string) => setLines((cur) => removeLine(cur, key)), []);
  const clear = useCallback(() => setLines([]), []);
  const toggle = useCallback((key: string) => setSaved((cur) => toggleSaved(cur, key)), []);
  const isSaved = useCallback((key: string) => saved.includes(key), [saved]);

  const openCart = useCallback((tab: CartTab = 'cart', focus?: 'checkout') => {
    setDrawerTab(tab);
    setFocusCheckout(focus === 'checkout');
    setDrawerOpen(true);
  }, []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);

  const toast = useCallback((message: string, viewCart = false, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToastState({ message, viewCart, undo });
    toastTimer.current = setTimeout(() => setToastState(null), undo ? UNDO_MS : TOAST_MS);
  }, []);

  const runUndo = () => {
    clearTimeout(toastTimer.current);
    toastState?.undo?.();
    setToastState(null);
  };

  const dismissToast = () => {
    clearTimeout(toastTimer.current);
    setToastState(null);
    openCart('cart');
  };

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines, saved, count, ready, drawerOpen, drawerTab, focusCheckout,
      openCart, closeCart, add, setLineQty, remove, clear, toggle, isSaved, toast,
    }),
    [lines, saved, count, ready, drawerOpen, drawerTab, focusCheckout, openCart, closeCart, add, setLineQty, remove, clear, toggle, isSaved, toast],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
        {toastState && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-3 text-sm text-white dark:text-gray-900 shadow-lg">
            <span>{toastState.message}</span>
            {toastState.undo && (
              <button type="button" onClick={runUndo} aria-label="Undo" title="Undo" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap font-semibold text-indigo-300 dark:text-indigo-700 underline">
                <Icon name="undo" />Undo
              </button>
            )}
            {toastState.viewCart && (
              <button type="button" onClick={dismissToast} aria-label="View cart" title="View cart" className="inline-flex min-h-10 items-center whitespace-nowrap font-semibold text-indigo-300 dark:text-indigo-700 underline">
                Cart
              </button>
            )}
          </div>
        )}
      </div>
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const v = useContext(CartContext);
  if (!v) throw new Error('useCart must be used inside CartProvider');
  return v;
}
