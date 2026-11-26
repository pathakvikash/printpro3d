import { NextResponse } from 'next/server';
import { adminGate } from '@/lib/adminAuth';
import { getJson, list } from '@/lib/store';
import { ALL_STATUSES, type TrackType } from '@/lib/tracking';
import { noteError } from '@/lib/adminList';
import { FOLDER, setNote, setStatus } from '@/lib/trackingStore';

export const dynamic = 'force-dynamic';

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// What the admin page shows for one stored order or request. Files are names only: download goes through /api/admin/files.
function view(type: TrackType, r: Rec) {
  const items: { kind?: string; name: string; qty: number; material?: string; config?: string; cfg?: unknown; total?: number | null; unit?: number | null; file?: string; aiPrompt?: string; review?: boolean; reviewReason?: string; project?: string }[] = [];
  const files: string[] = [];
  if (type === 'request') {
    for (const n of Array.isArray(r.images) ? r.images : []) if (typeof n === 'string') files.push(n);
  } else {
    // old single-item orders were saved without `lines`
    const lines: Rec[] = Array.isArray(r.lines) ? (r.lines as Rec[]) : [r];
    for (const l of lines) {
      const file = str(l.file) || undefined;
      items.push({
        kind: str(l.kind) || undefined,
        config: str(l.config) || undefined,
        cfg: l.cfg && typeof l.cfg === 'object' ? l.cfg : undefined,
        unit: num(l.total) !== null ? Math.round((num(l.total) as number) / (num(l.qty) || 1) * 100) / 100 : null,
        reviewReason: str(l.reviewReason) || undefined,
        project: str(l.project) || undefined,
        name: file ? 'Uploaded model' : str(l.itemName) || str(l.id) || 'Item',
        qty: num(l.qty) ?? 1,
        material: str(l.material) || undefined,
        total: num(l.total),
        file,
        aiPrompt: str(l.aiPrompt) || undefined,
        review: l.priceStatus === 'review' || undefined,
      });
      if (file) files.push(file);
    }
  }
  return {
    type,
    id: str(r.id),
    createdAt: str(r.createdAt),
    status: str(r.status),
    total: num(r.total),
    currency: str(r.currency),
    unpricedCount: num(r.unpricedCount),
    ownerNoteAt: str(r.ownerNoteAt) || undefined,
    ownerNote: str(r.ownerNote),
    state: str(r.state),
    pin: str(r.pin),
    provisional: r.provisional === true,
    contact: { name: str(r.name), email: str(r.email), phone: str(r.phone), address: str(r.address), notes: str(r.notes) },
    items,
    files,
    ...(type === 'request'
      ? { request: { category: str(r.category), description: str(r.description), qtyBand: str(r.qtyBand), deliver: str(r.deliver), extras: str(r.extras), budget: str(r.budget), sizeMm: r.sizeMm ?? null } }
      : {}),
  };
}

// ponytail: still reads every record to sort by date (keys are random UUIDs); the response is capped to `limit` newest, `offset` loads more. Add an index once there are thousands.
const PAGE = 200;
export async function GET(request: Request) {
  const denied = await adminGate(request);
  if (denied) return denied;
  const u = new URL(request.url);
  const limit = Math.min(Math.max(Number(u.searchParams.get('limit')) || PAGE, 1), 500);
  const offset = Math.max(Number(u.searchParams.get('offset')) || 0, 0);
  const records = [];
  for (const type of ['order', 'request'] as const) {
    for (const key of await list(FOLDER[type])) {
      if (!key.endsWith('.json')) continue;
      const r = await getJson<Rec>(FOLDER[type], key);
      if (r && typeof r === 'object') records.push(view(type, r));
    }
  }
  records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)); // newest first
  return NextResponse.json({ records: records.slice(offset, offset + limit), total: records.length, statuses: ALL_STATUSES });
}

export async function PATCH(request: Request) {
  const denied = await adminGate(request);
  if (denied) return denied;
  const len = request.headers.get('content-length');
  if (len !== null && Number(len) > 8192) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  let body: Rec;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object') throw new Error();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const hasNote = body.note !== undefined;
  if (typeof body.id !== 'string' || (typeof body.status !== 'string' && !hasNote)) {
    return NextResponse.json({ error: 'id and status or note are required' }, { status: 400 });
  }
  const type = body.type === 'order' || body.type === 'request' ? body.type : undefined;
  if (hasNote) {
    const bad = noteError(body.note);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }
  // status first: a bad status must not leave a half-applied request (note saved, status refused)
  let r: Awaited<ReturnType<typeof setStatus>> | null = null;
  if (typeof body.status === 'string') {
    r = await setStatus(body.id, body.status, type);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.code === 'not_found' ? 404 : 400 });
  }
  if (hasNote) {
    const n = await setNote(body.id, body.note, type);
    if (!n.ok) return NextResponse.json({ error: n.message }, { status: n.code === 'not_found' ? 404 : 400 });
    if (!r) return NextResponse.json({ ok: true, type: n.type, id: body.id });
  }
  if (!r?.ok) return NextResponse.json({ error: 'status required' }, { status: 400 });
  return NextResponse.json({ ok: true, type: r.type, id: r.id, status: r.to, emailed: r.emailed });
}
