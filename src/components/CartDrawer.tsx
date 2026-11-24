'use client';

import Icon from './Icon';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cartTotal, lineKey, lineTotal, type CartLine } from '@/lib/cart';
import { exampleById } from '@/lib/examples';
import { MAX_QTY } from '@/lib/quote';
import { lineName, lineSettings, shopItem } from '@/lib/cartView';
import { money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart, type CartTab } from './CartProvider';
import CartThumb from './CartThumb';

// joined stepper: one bordered group, 44px tall, matching the Add to cart button
const stepBtn =
  'flex h-full w-10 shrink-0 items-center justify-center text-lg text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-gray-600 disabled:hover:bg-transparent';
const qtyInput =
  'h-full w-12 border-x border-gray-300 dark:border-gray-600 bg-transparent text-center text-[15px] text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// the order payload carries only what the server needs; it recomputes every price itself
export const toPayloadItem = (l: CartLine) =>
  l.kind === 'shop'
    ? { kind: 'shop' as const, id: l.id, qty: l.qty }
    : l.kind === 'tpl'
      ? { kind: 'tpl' as const, id: l.id, cfg: l.cfg, qty: l.qty }
      : l.kind === 'kit'
        ? { kind: 'kit' as const, id: l.id, cfg: l.cfg, qty: l.qty }
      : l.kind === 'design'
        ? { kind: 'design' as const, project: l.project, material: l.material, qty: l.qty }
        : { kind: 'model' as const, file: l.file, material: l.material, qty: l.qty, label: l.label, ...(l.notes ? { notes: l.notes } : {}) }; // label and notes carry My items' colour note and notes to the owner

function QtyField({ name, value, onCommit }: { name: string; value: number; onCommit: (n: number) => void }) {
  // the draft lets the customer clear the box while typing; only valid whole numbers reach the cart
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={MAX_QTY}
      step={1}
      aria-label={`Quantity of ${name}`}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (Number.isInteger(n) && n >= 1 && n <= MAX_QTY) onCommit(n);
      }}
      onBlur={() => setDraft(String(value))}
      className={qtyInput}
    />
  );
}

export function QtyStepper({ name, qty, onChange }: { name: string; qty: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex h-11 items-stretch overflow-hidden rounded-[10px] border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
      <button type="button" aria-label={`Decrease quantity of ${name}`} disabled={qty <= 1} onClick={() => onChange(qty - 1)} className={stepBtn}>
        −
      </button>
      <QtyField name={name} value={qty} onCommit={onChange} />
      <button type="button" aria-label={`Increase quantity of ${name}`} disabled={qty >= MAX_QTY} onClick={() => onChange(qty + 1)} className={stepBtn}>
        +
      </button>
    </div>
  );
}

// heart toggle for the saved list; `savedKey` is `shop:<id>` or `example:<id>`
export function SaveButton({ savedKey, name }: { savedKey: string; name: string }) {
  const { isSaved, toggle } = useCart();
  const on = isSaved(savedKey);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from saved` : `Save ${name} for later`}
      title={on ? 'Remove from saved' : 'Save for later'}
      onClick={() => toggle(savedKey)}
      className={`shrink-0 rounded-lg p-2.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
        on ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 dark:text-gray-500 hover:text-rose-500'
      }`}
    >
      <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}


const removeBtn =
  'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-medium text-red-600 dark:text-red-400 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500';
const savedCard = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3';

// the saved ("for later") list: shop items move to the cart, builder examples open in the builder. Shared by the drawer and the cart page.
export function SavedRows({ onNavigate }: { onNavigate?: () => void }) {
  const { saved, toggle, add } = useCart();
  const rows = saved.flatMap((key) => {
    if (key.startsWith('shop:')) {
      const id = key.slice('shop:'.length);
      const item = shopItem(id);
      if (!item) return [];
      return [
        <li key={key} className={savedCard}>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{money.format(item.price)} each</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" aria-label={`Move ${item.name} to cart`} title={`Move ${item.name} to cart`} onClick={() => { add({ kind: 'shop', id, qty: 1 }); toggle(key); }} className={secondaryBtn}>
              <Icon name="cart" />Move
            </button>
            <button type="button" aria-label={`Remove ${item.name} from saved`} title={`Remove ${item.name} from saved`} onClick={() => toggle(key)} className={removeBtn}>
              <Icon name="trash" />Remove
            </button>
          </div>
        </li>,
      ];
    }
    const ex = exampleById(key.slice('example:'.length));
    if (!ex) return [];
    return [
      <li key={key} className={savedCard}>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{ex.title}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/playground?mode=build&example=${ex.id}`} onClick={onNavigate} aria-label="Open in builder" title="Open in builder" className={secondaryBtn}>
            <Icon name="wrench" />Open
          </Link>
          <button type="button" aria-label={`Remove ${ex.title} from saved`} title={`Remove ${ex.title} from saved`} onClick={() => toggle(key)} className={removeBtn}>
            <Icon name="trash" />Remove
          </button>
        </div>
      </li>,
    ];
  });
  return rows.length === 0 ? (
    <p className="py-8 text-center text-gray-700 dark:text-gray-200">Nothing saved yet. Tap the heart on an item to keep it here.</p>
  ) : (
    <ul className="space-y-3">{rows}</ul>
  );
}

// Mini-cart: a quick look, quantity and remove. The full cart and checkout live on /cart.
function Drawer() {
  const { lines, saved, count, drawerTab, focusCheckout, openCart, closeCart, setLineQty, remove, add, toast } = useCart();
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const checkoutLink = useRef<HTMLAnchorElement>(null);
  const [startFocus] = useState(focusCheckout); // read once: switching tabs later must not move focus

  // scroll lock, Escape, focus in/out, and a Tab loop inside the dialog; focus returns to the opener on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (startFocus ? checkoutLink.current : closeBtn.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled)'));
      const first = els[0];
      const last = els[els.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [closeCart, startFocus]);

  const { total, unpriced } = cartTotal(lines);

  const tabClass = (t: CartTab) =>
    `flex-1 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition-colors ${
      drawerTab === t
        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
    }`;

  const body =
    drawerTab === 'saved' ? (
      <SavedRows onNavigate={closeCart} />
    ) : lines.length === 0 ? (
      <div className="space-y-5 py-8 text-center">
        <p className="text-gray-700 dark:text-gray-200">Your cart is empty.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/shop" onClick={closeCart} aria-label="Browse ready items" title="Browse ready items" className={secondaryBtn}>
            <Icon name="tag" />Browse
          </Link>
          <Link href="/quote" onClick={closeCart} aria-label="Upload a file" title="Upload a file" className={secondaryBtn}>
            <Icon name="upload" />Upload
          </Link>
          <Link href="/my-items" onClick={closeCart} aria-label="My items" title="My items" className={secondaryBtn}>
            <Icon name="cube" />Saved
          </Link>
        </div>
      </div>
    ) : (
      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {lines.map((l) => {
          const key = lineKey(l);
          const name = lineName(l);
          const t = lineTotal(l);
          const note = lineSettings(l)[0];
          return (
            <li key={key} className="flex gap-3 py-3 first:pt-0">
              <CartThumb line={l} size={56} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                    {l.kind === 'kit' && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{l.label.split(' · ')[0]}</p>}
                    {l.kind !== 'kit' && note && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{note}</p>}
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">{t === null ? "We'll quote" : money.format(t)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <QtyStepper name={name} qty={l.qty} onChange={(n) => setLineQty(key, n)} />
                  <button
                    type="button"
                    aria-label={`Remove ${name} from cart`}
                    title={`Remove ${name}`}
                    onClick={() => {
                      remove(key);
                      toast(`Removed ${name}`, false, () => add(l));
                    }}
                    className={removeBtn}
                  >
                    <Icon name="trash" />Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden="true" onClick={closeCart} className="absolute inset-0 bg-black/50" />
      <aside ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="absolute inset-y-0 right-0 flex w-full flex-col bg-white dark:bg-gray-950 shadow-2xl sm:max-w-md">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">Your items</h2>
          <button ref={closeBtn} type="button" aria-label="Close cart" onClick={closeCart} title="Close cart" className="rounded-lg p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" aria-label="Cart and saved items" className="flex border-b border-gray-200 dark:border-gray-800 px-5">
          <button type="button" role="tab" id={`${titleId}-tab-cart`} aria-selected={drawerTab === 'cart'} aria-controls={`${titleId}-panel`} onClick={() => openCart('cart')} className={tabClass('cart')}>
            Cart ({count})
          </button>
          <button type="button" role="tab" id={`${titleId}-tab-saved`} aria-selected={drawerTab === 'saved'} aria-controls={`${titleId}-panel`} onClick={() => openCart('saved')} className={tabClass('saved')}>
            Saved ({saved.length})
          </button>
        </div>

        <div role="tabpanel" id={`${titleId}-panel`} aria-labelledby={`${titleId}-tab-${drawerTab}`} className="flex-1 overflow-y-auto overscroll-contain p-5">
          {body}
        </div>

        {drawerTab === 'cart' && lines.length > 0 && (
          <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 p-5">
            <p className="flex items-center justify-between font-semibold text-gray-900 dark:text-gray-100">
              <span>Subtotal</span>
              <span>{total > 0 || unpriced === 0 ? money.format(total) : "We'll quote"}</span>
            </p>
            {unpriced > 0 && total > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">plus {unpriced} {unpriced === 1 ? 'item' : 'items'} we&apos;ll quote</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" onClick={closeCart} aria-label="Go to your cart" title="Go to your cart" className={secondaryBtn}>
                <Icon name="cart" />Cart
              </Link>
              <Link ref={checkoutLink} href="/cart#checkout" onClick={closeCart} aria-label="Checkout" title="Checkout" className={submitBtn}>
                <Icon name="check" />Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function CartDrawer() {
  const { drawerOpen, closeCart } = useCart();
  const onCartPage = usePathname() === '/cart'; // the page is the full cart: no drawer on top of it
  useEffect(() => {
    if (onCartPage && drawerOpen) closeCart();
  }, [onCartPage, drawerOpen, closeCart]);
  return drawerOpen && !onCartPage ? <Drawer /> : null;
}
