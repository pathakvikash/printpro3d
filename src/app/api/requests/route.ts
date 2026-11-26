import { NextResponse } from 'next/server';
import path from 'path';
import crypto from 'crypto';
import { CATEGORIES, QTY_BANDS, DELIVERABLES } from '@/lib/catalog';
import { parseContact, text } from '@/lib/contact';
import { isImage } from '@/lib/image';
import { notifyNewRequest } from '@/lib/notify';
import { del, onBlobStore, putBytes, putJson } from '@/lib/store';
import { indexAdd, ownerFields, sessionUser } from '@/lib/account';
import { imagesTotalProblem } from '@/lib/uploadRules';
import { filled, limited } from '@/lib/spam';

const MAX_IMG = 5 * 1024 * 1024;
const MAX_IMAGES = 3;
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

export async function POST(request: Request) {
  const slow = await limited(request, 'submit');
  if (slow) return slow;
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= MAX_IMAGES * MAX_IMG + 1024 * 1024)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }
  const get = (k: string) => form.get(k);
  if (filled(get('website'))) return NextResponse.json({ id: crypto.randomUUID(), status: 'new' }); // honeypot: look like a success, save nothing

  try {
    const oneOf = (k: string, list: readonly { id: string }[]) => {
      const v = text(get, k, 50);
      if (!list.some((x) => x.id === v)) throw new Error(`${k} is invalid`);
      return v;
    };
    const category = oneOf('category', CATEGORIES);
    const qtyBand = oneOf('qtyBand', QTY_BANDS);
    const deliver = oneOf('deliver', DELIVERABLES);
    const fields = parseContact(get, { addressRequired: deliver !== 'file' });
    const description = text(get, 'description', 2000);
    const extras = text(get, 'extras', 300, false);
    const budget = text(get, 'budget', 50, false);

    const dim = (k: string) => {
      const raw = text(get, k, 20, false);
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0 || n > 2000) throw new Error(`${k} must be between 0 and 2000 mm`);
      return n;
    };
    const [l, w, h] = [dim('sizeL'), dim('sizeW'), dim('sizeH')];
    const sizeMm = l === null && w === null && h === null ? null : { l, w, h };

    const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) throw new Error(`At most ${MAX_IMAGES} images`);
    // on Vercel (Blob backend) the platform caps a request at 4.5 MB, so keep the images consistent with the client's 4 MB total
    const tooBig = onBlobStore() ? imagesTotalProblem(files.map((f) => f.size)) : null;
    if (tooBig) throw new Error(tooBig);
    const images: { ext: string; bytes: Uint8Array }[] = [];
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase();
      if (!IMG_EXT.includes(ext) || f.size > MAX_IMG) throw new Error('Images must be png, jpg or webp, up to 5MB each');
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isImage(bytes, ext)) throw new Error('Images must be png, jpg or webp, up to 5MB each');
      images.push({ ext, bytes });
    }

    // everything validated; now write (client filenames are never used)
    const names: string[] = [];
    for (const img of images) {
      const name = `${Date.now()}-${crypto.randomUUID()}${img.ext}`;
      await putBytes('uploads', name, img.bytes);
      names.push(name);
    }

    const id = crypto.randomUUID();
    const user = await sessionUser(); // from the session cookie, never from the form
    const rec = {
      id, createdAt: new Date().toISOString(), status: 'new',
      category, description, sizeMm, qtyBand, deliver, extras, budget, images: names, ...fields, ...ownerFields(user),
    };
    try {
      await putJson('requests', `${id}.json`, rec);
    } catch (e) {
      // best effort: don't leave orphaned images behind
      await Promise.all(names.map((n) => del('uploads', n).catch(() => {})));
      throw e;
    }
    await indexAdd(user, { type: 'request', id, createdAt: rec.createdAt }).catch(() => {});
    await notifyNewRequest(rec); // never throws; the request is already saved
    return NextResponse.json({ id, status: rec.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid request' }, { status: 400 });
  }
}
