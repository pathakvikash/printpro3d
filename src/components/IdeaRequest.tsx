'use client';

import { useState } from 'react';
import { canGoDirect } from '@/lib/directMode';
import { imagesTotalProblem } from '@/lib/uploadRules';
import { CATEGORIES, DELIVERABLES, QTY_BANDS } from '@/lib/catalog';
import { ContactFields, Done, card, input, label, submitBtn } from './ContactFields';

// ponytail: one question set with per-category prompts — per-category structured fields when a category gets real volume
const PROMPTS: Record<string, string> = {
  game: 'Scale, style, which game system, and how many pieces or figures.',
  gadget: 'What problem it solves, where it is used, and any sizes it must fit.',
  enclosure: 'Board or component dimensions, mounting holes, ports and cut-outs, and how it opens.',
  toy: 'What moves, and how: motor or wind. Shaft size, and who it is for.',
  drone: 'Frame size, motor mount pattern, battery and flight controller, and the weight limit.',
  other: 'Tell us what you want made and what it needs to do.',
};
const MAX_IMG = 5 * 1024 * 1024;

// On Vercel the whole request must stay under 4.5 MB: shrink photos to at most 1600 px JPEG (best effort; the original stays if it cannot be shrunk)
async function shrink(f: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d');
    if (!g) return f;
    g.fillStyle = '#fff'; // JPEG has no transparency
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return out && out.size < f.size ? new File([out], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  }
}

export default function IdeaRequest() {
  const [category, setCategory] = useState('game');
  const [deliver, setDeliver] = useState('print');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const body = new FormData(e.currentTarget);
    const imgs = body.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
    if (imgs.length > 3) return setError('At most 3 images.');
    if (imgs.some((f) => !/\.(png|jpe?g|webp)$/i.test(f.name) || f.size > MAX_IMG)) {
      return setError('Images must be png, jpg or webp, up to 5MB each.');
    }
    setBusy(true);
    try {
      if (imgs.length && (await canGoDirect())) {
        const small = await Promise.all(imgs.map(shrink));
        const tooBig = imagesTotalProblem(small.map((f) => f.size));
        if (tooBig) throw new Error(tooBig);
        body.delete('images');
        small.forEach((f) => body.append('images', f));
      }
      const res = await fetch('/api/requests', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'The images are too large to send. Use fewer or smaller images.' : res.statusText || 'Request failed'));
      setDone(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done title="Request received" id={done} lines={["We'll reply with a design and a quote."]} />;

  return (
    <form onSubmit={submit} className={card}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tell us what you need</h3>

      <div>
        <label htmlFor="category" className={label}>Category</label>
        <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" required maxLength={2000} rows={5} placeholder={PROMPTS[category]} className={input} />
      </div>

      <fieldset>
        <legend className={label}>Approximate size in mm (optional)</legend>
        <div className="grid grid-cols-3 gap-3">
          {[['sizeL', 'Length'], ['sizeW', 'Width'], ['sizeH', 'Height']].map(([n, l]) => (
            <div key={n}>
              <label htmlFor={n} className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{l}</label>
              <input id={n} name={n} type="number" min={1} max={2000} step="any" className={input} />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="qtyBand" className={label}>Quantity</label>
        <select id="qtyBand" name="qtyBand" defaultValue="1" className={input}>
          {QTY_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>

      <fieldset>
        <legend className={label}>Deliver as</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {DELIVERABLES.map((d) => (
            <label key={d.id} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="radio" name="deliver" value={d.id} checked={deliver === d.id} onChange={() => setDeliver(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="extras" className={label}>Moving parts or electronics inside? (optional)</label>
        <input id="extras" name="extras" maxLength={300} className={input} />
      </div>
      <div>
        <label htmlFor="budget" className={label}>Budget (optional)</label>
        <input id="budget" name="budget" maxLength={50} className={input} />
      </div>
      <div>
        <label htmlFor="images" className={label}>Reference images (optional, up to 3, png, jpg or webp, 5MB each)</label>
        <input id="images" name="images" type="file" multiple accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className={input} />
      </div>

      <ContactFields addressRequired={deliver !== 'file'} notes={false} />

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className={submitBtn}>{busy ? 'Sending...' : 'Send request'}</button>
    </form>
  );
}
