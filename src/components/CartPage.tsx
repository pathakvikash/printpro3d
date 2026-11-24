'use client';
// The full cart: lines (kit parts grouped under their kit), saved-for-later, order summary, and checkout as three steps on the same page
// (Contact, Shipping, Review). The order itself is the same request the drawer used to send: /api/orders reprices every line.
// Light on purpose: no three here (thumbnails load after the page shows, see CartThumb).

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MAX_KIT_LINES, MAX_LINES, MAX_TPL_LINES, cartTotal, lineKey, lineTotal, type CartLine } from '@/lib/cart';
import { SETUP_FEE } from '@/lib/quote';
import { EMAIL } from '@/lib/contact';
import { INDIAN_STATES, shippingError } from '@/lib/shipping';
import { SHOP_CATEGORIES } from '@/lib/catalog';
import { KIT_METAS, kitMetaPartCount } from '@/lib/kitMeta';
import { groupLines, lineMaterial, lineName, lineSettings, shopItem, type Section } from '@/lib/cartView';
import { SavedRows, QtyStepper, toPayloadItem } from './CartDrawer';
import { useCart } from './CartProvider';
import CartThumb from './CartThumb';
import { ContactFields, FieldError, contactFrom, input, invalidProps, label, money, secondaryBtn, submitBtn, type FieldErrors } from './ContactFields';
import Icon from './Icon';
import ShippingFields from './ShippingFields';

type Order = { id: string; status: string; total: number | null; unpricedCount: number; currency: string };
type Vals = Record<string, string>;

const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900';
const ghostBtn =
  'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
const dangerBtn = `${ghostBtn} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`;
const calmBtn = `${ghostBtn} text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40`;

const itemsText = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

// ---- validation: same rules as the server (contact.ts, shipping.ts); messages are for people ----
const CONTACT = ['name', 'email', 'phone'];
const SHIPPING = ['address', 'state', 'pin'];
function validate(v: Vals): Record<string, string> {
  const t = (k: string) => (v[k] ?? '').trim();
  const e: Record<string, string> = {};
  if (!t('name')) e.name = 'Enter your name.';
  if (!t('email')) e.email = 'Enter your email address.';
  else if (!EMAIL.test(t('email'))) e.email = 'Enter a valid email address, like name@example.com.';
  if (!t('phone')) e.phone = 'Enter a phone number we can reach you on.';
  if (!t('address')) e.address = 'Enter the address we should ship to.';
  const st = shippingError(v.state ?? '', '800001'); // the shared checker returns one message at a time: probe each field with a good other half
  if (st) e.state = st;
  const pin = shippingError(INDIAN_STATES[0], v.pin ?? '');
  if (pin) e.pin = pin;
  return e;
}

// ---- counts against the order caps (checked again by the server) ----
function useCaps(lines: CartLine[]) {
  return useMemo(() => {
    const tpl = lines.filter((l) => l.kind === 'tpl').length;
    const kit = lines.filter((l) => l.kind === 'kit').length;
    const over =
      tpl > MAX_TPL_LINES ? `An order holds at most ${MAX_TPL_LINES} different configured parts. Remove some to check out.`
      : kit > MAX_KIT_LINES ? `An order holds at most ${MAX_KIT_LINES} different kit parts. Remove some to check out.`
      : lines.length > MAX_LINES ? `A cart holds at most ${MAX_LINES} lines. Remove some to check out.`
      : null;
    return { tpl, kit, over };
  }, [lines]);
}

function CapNotice({ lines }: { lines: CartLine[] }) {
  const { tpl, kit } = useCaps(lines);
  const rows: string[] = [];
  if (tpl > 0) rows.push(`Configured parts ${tpl} of ${MAX_TPL_LINES}`);
  if (kit > 0) rows.push(`Kit parts ${kit} of ${MAX_KIT_LINES}`);
  const full = tpl >= MAX_TPL_LINES || kit >= MAX_KIT_LINES || lines.length >= MAX_LINES;
  if (rows.length === 0 && !full) return null;
  return (
    <p className={`rounded-xl border px-4 py-2.5 text-sm ${full ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'}`}>
      {rows.join(' · ')}
      {rows.length > 0 && ' (limits per order)'}
      {lines.length >= MAX_LINES && `${rows.length ? ' · ' : ''}Lines ${lines.length} of ${MAX_LINES}`}
      {full && ' · You have reached a limit: check out, or remove some lines, before adding more.'}
    </p>
  );
}

// ---- one line ----
function LineRow({ l }: { l: CartLine }) {
  const { setLineQty, remove, add, toast, toggle, isSaved } = useCart();
  const key = lineKey(l);
  const name = lineName(l);
  const total = lineTotal(l);
  const settings = lineSettings(l);
  const material = lineMaterial(l);
  const each = l.kind === 'shop' ? (shopItem(l.id)?.price ?? null) : l.kind === 'tpl' || l.kind === 'kit' ? l.unitPrice : null;
  const printed = l.kind === 'tpl' || l.kind === 'kit';
  const saveKey = l.kind === 'shop' ? `shop:${l.id}` : null;

  const onRemove = () => {
    remove(key);
    toast(`Removed ${name}`, false, () => add(l));
  };
  const onSave = () => {
    if (!saveKey) return;
    const was = isSaved(saveKey);
    if (!was) toggle(saveKey);
    remove(key);
    toast(`Saved ${name} for later`, false, () => {
      if (!was) toggle(saveKey);
      add(l);
    });
  };

  return (
    <li className="flex gap-3 py-4 sm:gap-4">
      <CartThumb line={l} size={72} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[material, each !== null ? `${money.format(each)} each` : l.kind === 'model' || l.kind === 'design' ? (l.estimate !== null ? 'Estimated' : "We'll quote this one") : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100">{total === null ? "We'll quote" : money.format(total)}</p>
            {printed && <p className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">incl. {money.format(SETUP_FEE)} setup</p>}
          </div>
        </div>
        {settings.length > 0 && (
          <ul aria-label={`Settings for ${name}`} className="flex flex-wrap gap-1.5">
            {settings.slice(0, 4).map((s) => (
              <li key={s} className="max-w-full break-words rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">{s}</li>
            ))}
            {settings.length > 4 && (
              <li title={settings.slice(4).join(', ')} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">+{settings.length - 4} more</li>
            )}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <QtyStepper name={name} qty={l.qty} onChange={(n) => setLineQty(key, n)} />
          {saveKey && (
            <button type="button" onClick={onSave} aria-label={`Save ${name} for later`} title="Save for later" className={calmBtn}>
              <Icon name="save" />Save
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label={`Remove ${name} from cart`} title="Remove from cart" className={dangerBtn}>
            <Icon name="trash" />Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function KitGroup({ s }: { s: Extract<Section, { kind: 'kit' }> }) {
  const { remove, add, toast } = useCart();
  const sub = s.lines.reduce((n, l) => n + (lineTotal(l) ?? 0), 0);
  const pieces = s.lines.reduce((n, l) => n + l.qty, 0);
  const onRemove = () => {
    s.lines.forEach((l) => remove(lineKey(l)));
    toast(`Removed ${s.title}`, false, () => s.lines.forEach(add));
  };
  return (
    <li>
      <section aria-label={`Kit: ${s.title}`} className="overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-900">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50 px-4 py-3 dark:bg-indigo-950/40">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><Icon name="cube" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />{s.title}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">Kit · {s.lines.length} {s.lines.length === 1 ? 'part' : 'parts'} · {pieces} {pieces === 1 ? 'piece' : 'pieces'}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100"><span className="sr-only">Kit subtotal </span>{money.format(sub)}</p>
            <button type="button" onClick={onRemove} aria-label={`Remove kit ${s.title}`} title="Remove the whole kit" className={dangerBtn}>
              <Icon name="trash" />Remove
            </button>
          </div>
        </header>
        <ul className="divide-y divide-gray-100 bg-white px-4 dark:divide-gray-800 dark:bg-gray-900">
          {s.lines.map((l) => <LineRow key={lineKey(l)} l={l} />)}
        </ul>
      </section>
    </li>
  );
}

// ---- order summary: only facts the app already states (FlowStrip, kit page, quote formula) ----
function Summary({ lines, children }: { lines: CartLine[]; children?: React.ReactNode }) {
  const { total, unpriced } = cartTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const printed = lines.filter((l) => l.kind === 'tpl' || l.kind === 'kit').length;
  return (
    <aside aria-label="Order summary" className={`${card} space-y-4 p-5 lg:sticky lg:top-24`}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order summary</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-gray-600 dark:text-gray-300">Items</dt><dd className="text-gray-900 dark:text-gray-100">{count}</dd></div>
        <div className="flex justify-between gap-3 text-base font-semibold"><dt className="text-gray-900 dark:text-gray-100">Subtotal</dt><dd className="text-gray-900 dark:text-gray-100">{total > 0 || unpriced === 0 ? money.format(total) : "We'll quote"}</dd></div>
        {unpriced > 0 && <div className="text-gray-600 dark:text-gray-300">{total > 0 ? 'Plus ' : ''}{itemsText(unpriced)} we&apos;ll quote separately.</div>}
        {printed > 0 && <div className="flex justify-between gap-3 text-gray-600 dark:text-gray-300"><dt>Setup</dt><dd>{money.format(SETUP_FEE)} per printed line, included</dd></div>}
        <div className="flex justify-between gap-3 border-t border-gray-100 pt-2 dark:border-gray-800"><dt className="text-gray-600 dark:text-gray-300">Shipping</dt><dd className="text-right text-gray-900 dark:text-gray-100">Confirmed after review (India only)</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-gray-600 dark:text-gray-300">Payment</dt><dd className="text-right text-gray-900 dark:text-gray-100">We send a payment link after review</dd></div>
      </dl>
      <p className="text-xs text-gray-500 dark:text-gray-400">Prices are an estimate from your parts. We confirm everything before you pay.</p>
      {children}
    </aside>
  );
}

// ---- empty ----
function Empty() {
  return (
    <div className={`${card} space-y-8 p-6 text-center sm:p-10`}>
      <div className="space-y-3">
        <span aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"><Icon name="cart" className="h-8 w-8" /></span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your cart is empty</h2>
        <p className="mx-auto max-w-md text-gray-600 dark:text-gray-300">Pick a kit or a ready part and it will show up here. You can also upload your own model for a quote.</p>
      </div>
      <div className="space-y-3 text-left">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Popular kits</h3>
        <ul className="grid gap-3 sm:grid-cols-3">
          {KIT_METAS.slice(0, 3).map((k) => (
            <li key={k.id}>
              <Link href={`/shop/${k.id}`} className="block h-full rounded-xl border border-gray-200 p-4 transition-colors hover:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{k.title}</span>
                <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{kitMetaPartCount(k)} printed parts</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3 text-left">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Shop by category</h3>
        <ul className="flex flex-wrap gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link href={`/shop?cat=${c.id}`} className="inline-flex min-h-10 items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">{c.label}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/shop" aria-label="Browse the shop" title="Browse the shop" className={`${submitBtn} sm:w-auto`}><Icon name="tag" />Shop</Link>
        <Link href="/quote" aria-label="Upload a file for a quote" title="Upload a file for a quote" className={secondaryBtn}><Icon name="upload" />Upload</Link>
      </div>
    </div>
  );
}

// ---- success ----
function Success({ order }: { order: Order }) {
  const head = useRef<HTMLHeadingElement>(null);
  const idText = useRef<HTMLElement>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  useEffect(() => head.current?.focus(), []);
  // clipboard may be missing (insecure page, old browser) or refused: then select the id so Ctrl+C / Cmd+C works
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopyNote('Copied.');
    } catch {
      const el = idText.current, sel = window.getSelection();
      if (el && sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopyNote('Could not copy. The id is selected: press Ctrl+C or Cmd+C.');
    }
  };
  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200 sm:p-8">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white"><Icon name="check" className="h-5 w-5" /></span>
        <h2 ref={head} tabIndex={-1} className="text-xl font-semibold text-green-900 focus:outline-none dark:text-green-100">Order request received</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <code ref={idText} className="break-all font-mono text-base text-green-900 dark:text-green-100">{order.id}</code>
        <button type="button" onClick={copyId} aria-label="Copy order id" title="Copy order id" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-green-600 bg-white px-3 text-sm font-semibold text-green-800 hover:bg-green-100 dark:border-green-500 dark:bg-gray-900 dark:text-green-200 dark:hover:bg-green-900/40">
          <Icon name="copy" />Copy
        </button>
      </div>
      {copyNote && <p role="status" className="text-xs">{copyNote}</p>}
      <p className="font-semibold">Keep this id: you need it to track your order.</p>
      {typeof order.total === 'number' ? <p>Total: {money.format(order.total)}</p> : <p>We will quote these items.</p>}
      {order.unpricedCount > 0 && <p>Plus {itemsText(order.unpricedCount)} we will quote separately.</p>}
      <p>We&apos;ll confirm your order and send a payment link.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/track?id=${encodeURIComponent(order.id)}`} aria-label="Track this order" title="Track this order" className={`${submitBtn} sm:w-auto`}><Icon name="search" />Track</Link>
        <Link href="/shop" aria-label="Continue shopping" title="Continue shopping" className={secondaryBtn}><Icon name="tag" />Shop</Link>
      </div>
    </div>
  );
}

// ---- checkout: Contact, Shipping, Review ----
const STEPS = ['Contact', 'Shipping', 'Review'] as const;

function Checkout({ lines, onPlaced, onBack }: { lines: CartLine[]; onPlaced: (o: Order) => void; onBack: () => void }) {
  const { clear } = useCart();
  const { over } = useCaps(lines);
  const form = useRef<HTMLFormElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const [step, setStep] = useState(1);
  const [vals, setVals] = useState<Vals>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validate(vals);
  const shown: FieldErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => touched[k]));
  const valid = Object.keys(errors).length === 0 && !over;

  // all steps stay in the form (hidden, not unmounted), so nothing typed is lost and FormData holds every field
  const sync = () => {
    if (!form.current) return;
    setVals(Object.fromEntries([...new FormData(form.current)].map(([k, v]) => [k, String(v)])));
  };
  useEffect(sync, [step]); // picks up browser autofill

  // keyboard and screen-reader users land on the new step's heading
  useEffect(() => {
    if (mounted.current) head.current?.focus();
    mounted.current = true;
  }, [step]);

  const go = (to: number) => {
    setError(null);
    setStep(to);
  };
  const next = () => {
    const fields = step === 1 ? CONTACT : SHIPPING;
    setTouched((t) => ({ ...t, ...Object.fromEntries(fields.map((f) => [f, true])) }));
    const bad = fields.find((f) => errors[f]);
    if (bad) { form.current?.querySelector<HTMLElement>(`[name="${bad}"]`)?.focus(); return; }
    go(step + 1);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < 3) return next(); // Enter in a field moves on, it never sends the order early
    setError(null);
    const f = new FormData(e.currentTarget);
    const bad = shippingError(f.get('state'), f.get('pin'));
    if (bad) return setError(bad);
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines.map(toPayloadItem), ...contactFrom(f), state: f.get('state'), pin: f.get('pin') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText || 'Order failed');
      onPlaced(data as Order);
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  const hid = (n: number) => step !== n;
  const heading = 'text-xl font-semibold text-gray-900 focus:outline-none dark:text-white';
  return (
    <div id="checkout" className={`${card} scroll-mt-24 p-5 sm:p-6`}>
      <nav aria-label="Checkout progress" className="mb-6">
        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const cls = `flex min-h-10 items-center gap-2 rounded-lg px-2 font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${n === step ? 'text-indigo-700 dark:text-indigo-300' : done ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`;
            const badge = (
              <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${n === step ? 'bg-indigo-600 text-white' : done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                {done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}
              </span>
            );
            return (
              <li key={s} className="flex flex-1 items-center gap-2" aria-current={n === step ? 'step' : undefined}>
                {done ? (
                  <button type="button" onClick={() => go(n)} className={cls} aria-label={`Back to ${s}`} title={`Back to ${s}`}>{badge}{s}</button>
                ) : (
                  <span className={cls}>{badge}{s}</span>
                )}
                {i < STEPS.length - 1 && <span aria-hidden className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <form ref={form} noValidate onSubmit={submit} onChange={sync} onInput={sync} onBlur={(e) => { const n = (e.target as unknown as HTMLInputElement).name; if (n) setTouched((t) => (t[n] ? t : { ...t, [n]: true })); }} className="space-y-5">
        <div hidden={hid(1)} className="space-y-4">
          <h2 ref={step === 1 ? head : undefined} tabIndex={-1} className={heading}>Contact</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">So we can confirm your order and send the payment link.</p>
          <ContactFields address={false} notes={false} idPrefix="co-" errors={shown} />
        </div>

        <div hidden={hid(2)} className="space-y-4">
          <h2 ref={step === 2 ? head : undefined} tabIndex={-1} className={heading}>Shipping</h2>
          <div>
            <label htmlFor="co-address" className={label}>Shipping address</label>
            <textarea id="co-address" name="address" required maxLength={500} rows={3} autoComplete="street-address" className={input} {...invalidProps('co-address', shown.address)} />
            <FieldError id="co-address" err={shown.address} />
          </div>
          <ShippingFields idPrefix="co-" errors={shown} />
          <div>
            <label htmlFor="co-notes" className={label}>Notes (optional)</label>
            <textarea id="co-notes" name="notes" maxLength={1000} rows={2} className={input} />
          </div>
        </div>

        <div hidden={hid(3)} className="space-y-5">
          <h2 ref={step === 3 ? head : undefined} tabIndex={-1} className={heading}>Review &amp; place order</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <section aria-label="Contact" className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
              <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Contact</h3><button type="button" onClick={() => go(1)} aria-label="Edit contact" title="Edit contact" className={calmBtn}><Icon name="edit" />Edit</button></div>
              <p className="text-gray-700 dark:text-gray-200">{vals.name}</p>
              <p className="break-all text-gray-700 dark:text-gray-200">{vals.email}</p>
              <p className="text-gray-700 dark:text-gray-200">{vals.phone}</p>
            </section>
            <section aria-label="Shipping" className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
              <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Ship to</h3><button type="button" onClick={() => go(2)} aria-label="Edit shipping" title="Edit shipping" className={calmBtn}><Icon name="edit" />Edit</button></div>
              <p className="whitespace-pre-line break-words text-gray-700 dark:text-gray-200">{vals.address}</p>
              <p className="text-gray-700 dark:text-gray-200">{[vals.state, vals.pin].filter(Boolean).join(' ')} · India</p>
              {vals.notes?.trim() && <p className="mt-1 break-words text-gray-500 dark:text-gray-400">Notes: {vals.notes}</p>}
            </section>
          </div>
          <section aria-label="Items" className="rounded-xl border border-gray-200 px-4 dark:border-gray-700">
            <div className="flex items-center justify-between pt-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Items</h3><button type="button" onClick={onBack} aria-label="Edit cart" title="Edit cart" className={calmBtn}><Icon name="cart" />Cart</button></div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {lines.map((l) => {
                const t = lineTotal(l);
                return (
                  <li key={lineKey(l)} className="flex items-center gap-3 py-3 text-sm">
                    <CartThumb line={l} size={40} />
                    <span className="min-w-0 flex-1 break-words text-gray-900 dark:text-gray-100">{l.kind === 'kit' ? `${l.label.split(' · ')[0]} · ${lineName(l)}` : lineName(l)} <span className="text-gray-500 dark:text-gray-400">× {l.qty}</span></span>
                    <span className="whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">{t === null ? "We'll quote" : money.format(t)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className="text-sm text-gray-600 dark:text-gray-300">Sending this is a request, not a payment. We review it, confirm shipping (India only) and send a payment link.</p>
        </div>

        {over && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{over}</p>}
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" onClick={step === 1 ? onBack : () => go(step - 1)} aria-label={step === 1 ? 'Back to cart' : 'Previous step'} title={step === 1 ? 'Back to cart' : 'Previous step'} className={secondaryBtn}>
            <span aria-hidden>←</span>Back
          </button>
          {step < 3 ? (
            <button type="button" onClick={next} aria-label={`Continue to ${STEPS[step]}`} title={`Continue to ${STEPS[step]}`} className={`${submitBtn} sm:w-auto sm:px-8`}>
              Next<Icon name="arrow" />
            </button>
          ) : (
            <button type="submit" disabled={busy || !valid} aria-busy={busy} aria-label="Place order request" title={valid ? 'Place order request' : 'Complete the details to place the order'} className={`${submitBtn} disabled:cursor-not-allowed sm:w-auto sm:px-8`}>
              {busy ? (<><span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Sending</>) : (<><Icon name="check" />Order</>)}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---- page ----
export default function CartPage() {
  const { lines, saved, count, ready } = useCart();
  const [stage, setStage] = useState<'cart' | 'checkout'>('cart');
  const [order, setOrder] = useState<Order | null>(null);
  const hash = useRef(false);
  const { total, unpriced } = cartTotal(lines);
  const { over } = useCaps(lines);
  const sections = useMemo(() => groupLines(lines), [lines]);

  // /cart#checkout (the mini-cart's Checkout) opens straight on the steps
  useEffect(() => {
    if (!ready || hash.current) return;
    hash.current = true;
    if (window.location.hash === '#checkout') setStage('checkout');
  }, [ready]);

  const startCheckout = () => {
    setStage('checkout');
    requestAnimationFrame(() => document.getElementById('checkout')?.scrollIntoView({ block: 'start' }));
  };
  const status = `${itemsText(count)} in cart. Subtotal ${total > 0 || unpriced === 0 ? money.format(total) : "to be quoted"}${unpriced > 0 && total > 0 ? `, plus ${unpriced} to be quoted` : ''}.`;
  const checkoutAction = (
    <>
      {over && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{over}</p>}
      <button type="button" onClick={startCheckout} disabled={!!over} aria-label="Checkout" title={over ?? 'Checkout'} className={`${submitBtn} disabled:cursor-not-allowed`}>
        <Icon name="check" />Checkout
      </button>
    </>
  );

  let body: React.ReactNode;
  if (order) body = <Success order={order} />;
  else if (!ready) body = <div role="status" aria-label="Loading your cart" className="pp-skeleton h-64" />;
  else if (lines.length === 0) body = <Empty />;
  else
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {stage === 'checkout' ? (
            <Checkout lines={lines} onPlaced={setOrder} onBack={() => setStage('cart')} />
          ) : (
            <>
              <CapNotice lines={lines} />
              <section aria-label="Items in your cart" className={`${card} p-4 sm:p-6`}>
                <ul className="space-y-4">
                  {sections.map((s) =>
                    s.kind === 'kit' ? <KitGroup key={`kit:${s.id}`} s={s} /> : <li key={lineKey(s.line)} className="list-none"><ul className="divide-y divide-gray-100 dark:divide-gray-800"><LineRow l={s.line} /></ul></li>,
                  )}
                </ul>
              </section>
              <Link href="/shop" aria-label="Continue shopping" title="Continue shopping" className={`${calmBtn} w-fit`}><span aria-hidden>←</span>Shop</Link>
            </>
          )}
          {saved.length > 0 && (
            <section aria-labelledby="saved-h" className="space-y-3">
              <h2 id="saved-h" className="text-lg font-semibold text-gray-900 dark:text-white">Saved for later ({saved.length})</h2>
              <SavedRows />
            </section>
          )}
        </div>
        <Summary lines={lines}>{stage === 'cart' ? checkoutAction : null}</Summary>
        {stage === 'cart' && (
          <>
            <div aria-hidden className="h-16 lg:hidden" />
            <div className="pp-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
              <div className="min-w-0 leading-tight">
                <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal</p>
                <p className="font-semibold text-gray-900 dark:text-white">{total > 0 || unpriced === 0 ? money.format(total) : "We'll quote"}</p>
              </div>
              <button type="button" onClick={startCheckout} disabled={!!over} aria-label="Checkout" title={over ?? 'Checkout'} className={`${submitBtn} ml-auto !w-auto disabled:cursor-not-allowed`}>
                <Icon name="check" />Checkout
              </button>
            </div>
          </>
        )}
      </div>
    );

  return (
    <section className="bg-gray-50 py-8 dark:bg-gray-900 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{order ? 'Order placed' : stage === 'checkout' && lines.length > 0 ? 'Checkout' : 'Your cart'}</h1>
            {!order && ready && lines.length > 0 && <p className="mt-1 text-gray-600 dark:text-gray-300">{itemsText(count)}</p>}
          </div>
        </header>
        <p role="status" className="sr-only">{ready && !order && lines.length > 0 ? status : ''}</p>
        {body}
      </div>
    </section>
  );
}
