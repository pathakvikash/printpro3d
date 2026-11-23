import { NextResponse } from 'next/server';
import path from 'path';
import crypto from 'crypto';
import { fitsBed, quote, CURRENCY, MAX_QTY, type MeshStats } from '@/lib/quote';
import { CATALOG, type Item } from '@/lib/catalog';
import { parseContact } from '@/lib/contact';
import { MAX_LINES } from '@/lib/cart';
import { notifyNewOrder, type OrderLine } from '@/lib/notify';
import { normalizeCfg, templateById, type Cfg, type TemplateDef } from '@/lib/templateDefs';
import { templateOrderLine } from '@/lib/templates';
import { findJobByFile } from '@/lib/aiJobs';
import { isModelFile, mergeChecked, type Checked } from '@/lib/orderChecks';
import { getBytes, getJson, putJson } from '@/lib/store';
import { filled, limited } from '@/lib/spam';

// ponytail: orders are JSON records in the store (local disk, or Vercel Blob); list/filter in the admin page is a full scan — move to a DB if volume grows

type SavedLine = OrderLine & { stats?: MeshStats | null; quote?: ReturnType<typeof quote> | null; cfg?: Cfg };

const isQty = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QTY;

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

// Strict check of one entry. Bad entries are rejected, never dropped: the customer must get what they asked for.
// Price fields and labels sent by the browser are ignored; every price is recomputed below.
function checkEntry(raw: unknown, n: number): Checked {
  const fail = (msg: string) => new Error(`item ${n}: ${msg}`);
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (o.kind !== 'shop' && o.kind !== 'model' && o.kind !== 'tpl') throw fail('kind must be "shop", "tpl" or "model"');
  const qty = o.qty;
  if (!isQty(qty)) throw fail(`qty must be a whole number 1-${MAX_QTY}`);
  if (o.kind === 'tpl') {
    const tpl = templateById(o.id);
    if (!tpl) throw fail('unknown template');
    try {
      return { n, kind: 'tpl', tpl, cfg: normalizeCfg(tpl, o.cfg, true), qty };
    } catch (e) {
      throw fail(e instanceof Error ? e.message : 'bad config');
    }
  }
  if (o.kind === 'shop') {
    const item = CATALOG.find((i) => i.id === o.id);
    if (!item) throw fail('unknown item');
    return { n, kind: 'shop', item, qty };
  }
  if (typeof o.file !== 'string' || typeof o.material !== 'string') throw fail('model needs a file and a material');
  const file = path.basename(o.file);
  if (!file) throw fail('file is required');
  if (!isModelFile(file)) throw fail('not a model file'); // e.g. an image from an idea request
  return { n, kind: 'model', file, material: o.material, qty };
}

function priceShop(item: Item, qty: number): SavedLine {
  // shop order: price comes from the catalogue, never from the client
  return { kind: 'shop', id: item.id, itemName: item.name, qty, material: item.material, total: item.price * qty };
}

// template order: the mesh is rebuilt here from the validated config and priced with quote(); nothing the browser says about price is read
const priceTpl = (tpl: TemplateDef, cfg: Cfg, qty: number): SavedLine => templateOrderLine(tpl, cfg, qty);

async function priceModel(file: string, material: string, qty: number): Promise<SavedLine> {
  if (file.endsWith('.stats.json') || !(await getBytes('uploads', file))) throw new Error('file not found');

  // stats were computed at upload time; missing or invalid sidecar means manual quote
  let stats: MeshStats | null = null;
  try {
    const s = await getJson<{ volumeCm3?: unknown; sizeMm?: Record<string, unknown> }>('uploads', `${file}.stats.json`);
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    if (s && ok(s.volumeCm3) && (s.volumeCm3 as number) > 0 && s.sizeMm && ok(s.sizeMm.x) && ok(s.sizeMm.y) && ok(s.sizeMm.z)) {
      stats = { volumeCm3: s.volumeCm3 as number, sizeMm: { x: s.sizeMm.x as number, y: s.sizeMm.y as number, z: s.sizeMm.z as number } };
    }
  } catch {}

  let q: ReturnType<typeof quote> | null = null;
  if (stats) {
    const r = quote(stats, material, qty); // validates material + qty
    if (fitsBed(stats.sizeMm)) q = r;
  } else {
    quote({ volumeCm3: 0, sizeMm: { x: 0, y: 0, z: 0 } }, material, qty); // validate only
  }
  // ponytail: setup fee and minimum order apply per model line — one fee per order if that proves too steep
  const ai = await findJobByFile(file); // file came from an AI generation: tell the owner the prompt
  return {
    kind: 'model',
    file,
    material,
    qty,
    stats,
    quote: q,
    total: q ? q.total : null,
    ...(ai ? { aiPrompt: ai.prompt } : {}),
  };
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
    const fields = parseContact((k) => body[k]);
    const reqs = requestItems(body).map((raw, i) => checkEntry(raw, i + 1));

    const lines: SavedLine[] = [];
    for (const r of mergeChecked(reqs)) {
      try {
        lines.push(r.kind === 'shop' ? priceShop(r.item, r.qty) : r.kind === 'tpl' ? priceTpl(r.tpl, r.cfg, r.qty) : await priceModel(r.file, r.material, r.qty));
      } catch (e) {
        throw new Error(`item ${r.n}: ${e instanceof Error ? e.message : 'invalid'}`);
      }
    }

    const priced = lines.filter((l) => l.total !== null);
    const unpricedCount = lines.length - priced.length;
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
      total,
      unpricedCount,
      currency: CURRENCY,
    };
    await putJson('orders', `${id}.json`, order);
    await notifyNewOrder(order); // never throws; the order is already saved
    return NextResponse.json({ id, status, total, unpricedCount, currency: CURRENCY });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid order' }, { status: 400 });
  }
}
