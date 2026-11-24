'use client';

import Icon from './Icon';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CATALOG } from '@/lib/catalog';
import { cartTotal, lineKey, lineTotal, type CartLine } from '@/lib/cart';
import { exampleById } from '@/lib/examples';
import { MAX_QTY } from '@/lib/quote';
import { templateById } from '@/lib/templateDefs';
import { ContactFields, contactFrom, money, secondaryBtn, submitBtn } from './ContactFields';
import { useCart, type CartTab } from './CartProvider';
import ShippingFields from './ShippingFields';
import { shippingError } from '@/lib/shipping';

// joined stepper: one bordered group, 44px tall, matching the Add to cart button
const stepBtn =
  'flex h-full w-10 shrink-0 items-center justify-center text-lg text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-gray-600 disabled:hover:bg-transparent';
const qtyInput =
  'h-full w-12 border-x border-gray-300 dark:border-gray-600 bg-transparent text-center text-[15px] text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

type Order = { id: string; status: string; total: number | null; unpricedCount: number; currency: string };

const shopItem = (id: string) => CATALOG.find((i) => i.id === id) ?? null;
const lineName = (l: CartLine) => (l.kind === 'shop' ? (shopItem(l.id)?.name ?? l.id) : l.kind === 'tpl' ? (templateById(l.id)?.name ?? l.id) : l.label);
// the order payload carries only what the server needs; it recomputes every price itself
const toPayloadItem = (l: CartLine) =>
  l.kind === 'shop'
    ? { kind: 'shop' as const, id: l.id, qty: l.qty }
    : l.kind === 'tpl'
      ? { kind: 'tpl' as const, id: l.id, cfg: l.cfg, qty: l.qty }
      : l.kind === 'design'
        ? { kind: 'design' as const, project: l.project, material: l.material, qty: l.qty }
        : { kind: 'model' as const, file: l.file, material: l.material, qty: l.qty };

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

function Drawer() {
  const { lines, saved, count, drawerTab, focusCheckout, openCart, closeCart, setLineQty, remove, clear, add, toggle } = useCart();
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const checkoutBtn = useRef<HTMLButtonElement>(null);
  const [startFocus] = useState(focusCheckout); // read once: switching tabs later must not move focus
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const idText = useRef<HTMLElement>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  // scroll lock, Escape, focus in/out, and a Tab loop inside the dialog; focus returns to the opener on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (startFocus ? checkoutBtn.current : closeBtn.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(
        panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled)'),
      );
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

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const bad = shippingError(form.get('state'), form.get('pin'));
    if (bad) return setError(bad);
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines.map(toPayloadItem), ...contactFrom(form), state: form.get('state'), pin: form.get('pin') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText || 'Order failed');
      setOrder(data as Order);
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  // clipboard may be missing (insecure page, old browser) or refused: then select the id so Ctrl+C / Cmd+C works
  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopyNote('Copied.');
    } catch {
      const el = idText.current;
      const sel = window.getSelection();
      if (el && sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopyNote('Could not copy. The id is selected: press Ctrl+C or Cmd+C.');
    }
  };

  const selectTab = (t: CartTab) => {
    setCheckout(false);
    openCart(t);
  };

  const { total, unpriced } = cartTotal(lines);
  const savedRows = saved.flatMap((key) => {
    if (key.startsWith('shop:')) {
      const id = key.slice('shop:'.length);
      const item = shopItem(id);
      if (!item) return [];
      return [
        <li key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{money.format(item.price)} each</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              aria-label={`Move ${item.name} to cart`}
              onClick={() => {
                add({ kind: 'shop', id, qty: 1 });
                toggle(key);
              }}
              title={`Move ${item.name} to cart`}
              className={secondaryBtn}
            >
              <Icon name="cart" />Move
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.name} from saved`}
              onClick={() => toggle(key)}
              className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              <Icon name="trash" />Remove
            </button>
          </div>
        </li>,
      ];
    }
    const ex = exampleById(key.slice('example:'.length));
    if (!ex) return [];
    return [
      <li key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{ex.title}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/playground?mode=build&example=${ex.id}`}
            onClick={closeCart}
            aria-label="Open in builder"
            title="Open in builder"
            className={secondaryBtn}
          >
            <Icon name="wrench" />Open
          </Link>
          <button
            type="button"
            aria-label={`Remove ${ex.title} from saved`}
            onClick={() => toggle(key)}
            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            <Icon name="trash" />Remove
          </button>
        </div>
      </li>,
    ];
  });

  let body: React.ReactNode;
  if (order) {
    body = (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-2 text-sm text-green-700 dark:text-green-300">
          <p className="font-semibold text-base text-green-800 dark:text-green-300">Order request received</p>
          <div className="flex flex-wrap items-center gap-3">
            <code ref={idText} className="break-all font-mono text-green-900 dark:text-green-100">{order.id}</code>
            <button
              type="button"
              onClick={() => copyId(order.id)}
              aria-label="Copy order id"
              title="Copy order id"
              className="rounded-lg border border-green-600 dark:border-green-500 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-semibold text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              <Icon name="copy" />Copy
            </button>
          </div>
          {copyNote && <p role="status" className="text-xs">{copyNote}</p>}
          <p className="font-semibold text-green-800 dark:text-green-200">Keep this id: you need it to track your order.</p>
          {typeof order.total === 'number' && <p>Total: {money.format(order.total)}</p>}
          {typeof order.total !== 'number' && <p>We will quote these items.</p>}
          {order.unpricedCount > 0 && (
            <p>Plus {order.unpricedCount} {order.unpricedCount === 1 ? 'item' : 'items'} we will quote separately.</p>
          )}
          <p>We&apos;ll confirm your order and send a payment link.</p>
        </div>
        <Link
          href={`/track?id=${encodeURIComponent(order.id)}`}
          onClick={closeCart}
          aria-label="Track this order"
          title="Track this order"
          className={`${secondaryBtn} w-full`}
        >
          <Icon name="search" />Track
        </Link>
      </div>
    );
  } else if (drawerTab === 'cart' && checkout && lines.length > 0) {
    body = (
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {count} {count === 1 ? 'item' : 'items'}
          {total > 0 && <> · Total {money.format(total)}</>}
          {unpriced > 0 && <> · plus {unpriced} we&apos;ll quote</>}
        </p>
        <ContactFields idPrefix="cart-" />
        <ShippingFields idPrefix="cart-" />
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy} aria-label="Send order request" title="Send order request" className={submitBtn}>
            <Icon name="arrow" />{busy ? 'Sending' : 'Send'}
          </button>
          <button type="button" onClick={() => setCheckout(false)} aria-label="Back to cart" title="Back to cart" className={secondaryBtn}>
            <Icon name="cart" />Back
          </button>
        </div>
      </form>
    );
  } else if (drawerTab === 'cart') {
    body =
      lines.length === 0 ? (
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
        <ul className="space-y-3">
          {lines.map((l) => {
            const key = lineKey(l);
            const name = lineName(l);
            const t = lineTotal(l);
            const details =
              l.kind === 'shop'
                ? `${shopItem(l.id)?.material ?? ''} · ${money.format(shopItem(l.id)?.price ?? 0)} each`
                : l.kind === 'tpl'
                  ? `${templateById(l.id)?.material ?? ''} · your settings · ${money.format(l.unitPrice)} per piece before setup`
                  : `${l.material} · ${l.estimate !== null ? `Estimated ${money.format(l.estimate)}` : "We'll quote this one"}`;
            return (
              <li key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 break-words">{name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{details}</p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t === null ? "We'll quote" : money.format(t)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <QtyStepper name={name} qty={l.qty} onChange={(n) => setLineQty(key, n)} />
                  <button
                    type="button"
                    aria-label={`Remove ${name} from cart`}
                    onClick={() => remove(key)}
                    className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
                  >
                    <Icon name="trash" />Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      );
  } else {
    body =
      savedRows.length === 0 ? (
        <p className="py-8 text-center text-gray-700 dark:text-gray-200">Nothing saved yet. Tap the heart on an item to keep it here.</p>
      ) : (
        <ul className="space-y-3">{savedRows}</ul>
      );
  }

  const tabClass = (t: CartTab) =>
    `flex-1 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition-colors ${
      drawerTab === t
        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
    }`;

  return (
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden="true" onClick={closeCart} className="absolute inset-0 bg-black/50" />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white dark:bg-gray-950 shadow-2xl sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">Your items</h2>
          <button
            ref={closeBtn}
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            title="Close cart"
            className="rounded-lg p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div role="tablist" aria-label="Cart and saved items" className="flex border-b border-gray-200 dark:border-gray-800 px-5">
          <button
            type="button"
            role="tab"
            id={`${titleId}-tab-cart`}
            aria-selected={drawerTab === 'cart'}
            aria-controls={`${titleId}-panel`}
            onClick={() => selectTab('cart')}
            className={tabClass('cart')}
          >
            Cart ({count})
          </button>
          <button
            type="button"
            role="tab"
            id={`${titleId}-tab-saved`}
            aria-selected={drawerTab === 'saved'}
            aria-controls={`${titleId}-panel`}
            onClick={() => selectTab('saved')}
            className={tabClass('saved')}
          >
            Saved ({saved.length})
          </button>
        </div>

        <div
          role="tabpanel"
          id={`${titleId}-panel`}
          aria-labelledby={`${titleId}-tab-${drawerTab}`}
          className="flex-1 overflow-y-auto overscroll-contain p-5"
        >
          {body}
        </div>

        {!order && drawerTab === 'cart' && !checkout && lines.length > 0 && (
          <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 p-5">
            {(total > 0 || unpriced === 0) && (
              <p className="flex items-center justify-between font-semibold text-gray-900 dark:text-gray-100">
                <span>Total</span>
                <span>{money.format(total)}</span>
              </p>
            )}
            {unpriced > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                plus {unpriced} {unpriced === 1 ? 'item' : 'items'} we&apos;ll quote
              </p>
            )}
            <button ref={checkoutBtn} type="button" onClick={() => setCheckout(true)} className={submitBtn}>
              <Icon name="check" />Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function CartDrawer() {
  const { drawerOpen } = useCart();
  return drawerOpen ? <Drawer /> : null;
}
