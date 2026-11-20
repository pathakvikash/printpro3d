import { NextResponse } from 'next/server';
import { getJson } from '@/lib/store';
import { CURRENCY, MAX_QTY } from '@/lib/quote';
import { CATEGORIES } from '@/lib/catalog';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_NAME = 'Your 3D model'; // never the file name, prompt or stats
const NAME_MAX = 120;

type TrackItem = { name: string; qty: number };

const qtyOf = (n: unknown) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QTY ? (n as number) : 1);
const nameOf = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, NAME_MAX) : fallback);

// Only names and quantities leave the server: no contact data, file names, prompts, stats or prices per line.
function itemsOf(type: 'order' | 'request', r: Record<string, unknown>): TrackItem[] {
  if (type === 'request') {
    const label = CATEGORIES.find((c) => c.id === r.category)?.label ?? 'Something else';
    return [{ name: `Design request: ${label}`, qty: 1 }];
  }
  if (Array.isArray(r.lines)) {
    return r.lines.map((l) => {
      const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      return { name: o.kind === 'shop' ? nameOf(o.itemName, 'Ready-made item') : MODEL_NAME, qty: qtyOf(o.qty) };
    });
  }
  // old single-item orders were saved without `lines`
  return [{ name: nameOf(r.itemName, MODEL_NAME), qty: qtyOf(r.qty) }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  for (const [dir, type] of [['orders', 'order'], ['requests', 'request']] as const) {
    try {
      const r = await getJson<Record<string, unknown>>(dir, `${id.toLowerCase()}.json`);
      if (!r || typeof r !== 'object') continue;
      // only these fields: never customer details or file names
      return NextResponse.json({
        type,
        status: r.status,
        createdAt: r.createdAt,
        total: typeof r.total === 'number' ? r.total : null,
        currency: CURRENCY,
        items: itemsOf(type, r),
        ...(typeof r.unpricedCount === 'number' ? { unpricedCount: r.unpricedCount } : {}),
      });
    } catch {}
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
