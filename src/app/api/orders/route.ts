import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { CURRENCY } from '@/lib/quote';
import type { Item } from '@/lib/catalog';
import { parseContact } from '@/lib/contact';
import { parseShipping } from '@/lib/shipping';
import { MAX_LINES } from '@/lib/cart';
import { notifyNewOrder } from '@/lib/notify';
import { checkEntry, mergeChecked } from '@/lib/orderChecks';
import { designNotes, newBudget, priceDesign, priceKit, priceModel, priceTpl, type SavedLine } from '@/lib/orderPricing';
import { markOrdered } from '@/lib/designProjects';
import { putJson } from '@/lib/store';
import { filled, limited } from '@/lib/spam';

// ponytail: orders are JSON records in the store (local disk, or Vercel Blob); list/filter in the admin page is a full scan — move to a DB if volume grows

export const maxDuration = 60; // seconds: template and kit lines are rebuilt with CSG here; orderPricing's 40 s budget keeps the order inside it

// `items` is the cart. A legacy single-item body ({ file | item, qty, ...contact }) becomes a one-entry list.
function requestItems(body: Record<string, unknown>): unknown[] {
  const legacy = body.file !== undefined || body.item !== undefined;
  if (body.items !== undefined) {
    if (legacy) throw new Error('send either items or a single file/item, not both');
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_LINES) {
      throw new Error(`items must be a list of 1-${MAX_LINES} entries`);
    }
    return body.items;
  }
  if (body.file !== undefined && body.item !== undefined) throw new Error('send exactly one of file or item');
  if (body.item !== undefined) return [{ kind: 'shop', id: body.item, qty: body.qty }];
  if (body.file !== undefined) return [{ kind: 'model', file: body.file, material: body.material, qty: body.qty }];
  throw new Error('items is required');
}

function priceShop(item: Item, qty: number): SavedLine {
  // shop order: price comes from the catalogue, never from the client
  return { kind: 'shop', id: item.id, itemName: item.name, qty, material: item.material, total: item.price * qty };
}

export async function POST(request: Request) {
  const slow = await limited(request, 'submit');
  if (slow) return slow;
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= 32 * 1024)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object') throw new Error();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (filled(body.website)) {
    // honeypot: look like a success, save nothing
    return NextResponse.json({ id: crypto.randomUUID(), status: 'pending_review', total: null, unpricedCount: 0, currency: CURRENCY });
  }

  try {
    const fields = { ...parseContact((k) => body[k]), ...parseShipping((k) => body[k]) };
    const reqs = requestItems(body).map((raw, i) => checkEntry(raw, i + 1));

    // template and kit parts are rebuilt from the validated config; nothing the browser says about price is read. Parts out of budget or failing to build become 'review' lines.
    const budget = newBudget();
    const lines: SavedLine[] = [];
    for (const r of mergeChecked(reqs)) {
      try {
        lines.push(r.kind === 'shop' ? priceShop(r.item, r.qty) : r.kind === 'tpl' ? await priceTpl(r.tpl, r.cfg, r.qty, budget) : r.kind === 'kit' ? await priceKit(r.id, r.cfg, r.qty, budget) : r.kind === 'design' ? await priceDesign(r.project, r.material, r.qty) : { ...(await priceModel(r.file, r.material, r.qty)), ...(r.label ? { itemName: r.label } : {}), ...(r.notes ? { notes: r.notes } : {}) });
      } catch (e) {
        throw new Error(`item ${r.n}: ${e instanceof Error ? e.message : 'invalid'}`);
      }
    }

    const priced = lines.filter((l) => l.total !== null);
    const unpricedCount = lines.length - priced.length;
    const reviewCount = lines.filter((l) => l.priceStatus === 'review').length;
    const provisional = reviewCount > 0;
    const total = priced.length ? priced.reduce((sum, l) => sum + (l.total ?? 0), 0) : null;

    const id = crypto.randomUUID();
    // ponytail: price is an estimate — flipped-winding or overlapping bodies can under-count volume; owner confirms before sending the payment link. Per-component volume if this becomes self-serve payment.
    const status = unpricedCount === 0 ? 'pending_review' : 'needs_manual_quote';
    const order = {
      id,
      createdAt: new Date().toISOString(),
      status,
      lines,
      ...fields,
      notes: [fields.notes, designNotes(lines)].filter(Boolean).join('\n\n'),
      total,
      unpricedCount,
      reviewCount,
      provisional,
      currency: CURRENCY,
    };
    await putJson('orders', `${id}.json`, order);
    for (const l of lines) if (l.kind === 'design' && l.project) await markOrdered(l.project).catch(() => {});
    await notifyNewOrder(order); // never throws; the order is already saved
    return NextResponse.json({ id, status, total, unpricedCount, reviewCount, provisional, currency: CURRENCY });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid order' }, { status: 400 });
  }
}
