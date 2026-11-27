'use client';

import { useState } from 'react';
import { canGoDirect } from '@/lib/directMode';
import { imagesTotalProblem } from '@/lib/uploadRules';
import { DESIGN_EXTS, MAX_DESIGN } from '@/lib/designFile';
import { CATEGORIES, DELIVERABLES, QTY_BANDS } from '@/lib/catalog';
import { ContactFields, Done, card, input, label, submitBtn } from './ContactFields';

// ponytail: one question set with per-category prompts — per-category structured fields when a category gets real volume
const PROMPTS: Record<string, string> = {
  game: 'Scale, style, which game system, and how many pieces or figures.',
  gadget: 'What problem it solves, where it is used, and any sizes it must fit.',
  enclosure: 'Board or component dimensions, mounting holes, ports and cut-outs, and how it opens.',
  toy: 'What moves, and how: motor or wind. Shaft size, and who it is for.',
  drone: 'Frame size, motor mount pattern, battery and flight controller, and the weight limit.',
  laser: 'Material (acrylic, MDF, plywood or other), thickness, size, cut or engrave, and how many.',
  material: 'Which material, colour or size, how much you need, and what it is for.',
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

// replacement: opened from "Need a part reproduced?"; same form, with prompts for the original part
// mode: 'laser' (/laser) or 'material' (/request?material=<id>, with `part` carrying the material): category fixed, printed deliverable only
// defaultCategory: preselected (not fixed) category, e.g. for a made-to-order item
export default function IdeaRequest({ replacement = false, part, mode, defaultCategory }: { replacement?: boolean; part?: { id: string; title: string; lipo: boolean }; mode?: 'laser' | 'material'; defaultCategory?: string }) {
  const [category, setCategory] = useState(mode ?? defaultCategory ?? (part ? 'robotics' : replacement ? 'other' : 'game'));
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
    const design = mode === 'laser' ? body.get('designFile') : null;
    const dFile = design instanceof File && design.size > 0 ? design : null;
    if (!dFile) body.delete('designFile'); // never send an empty file part
    if (dFile && (!DESIGN_EXTS.includes(dFile.name.slice(dFile.name.lastIndexOf('.')).toLowerCase()) || dFile.size > MAX_DESIGN)) {
      return setError('The design file must be .svg, ASCII .dxf or .pdf, up to 4MB.');
    }
    setBusy(true);
    try {
      if ((imgs.length || dFile) && (await canGoDirect())) {
        const small = await Promise.all(imgs.map(shrink));
        const tooBig = imagesTotalProblem([...small.map((f) => f.size), ...(dFile ? [dFile.size] : [])]);
        if (tooBig) throw new Error(tooBig);
        body.delete('images');
        small.forEach((f) => body.append('images', f));
      }
      const res = await fetch('/api/requests', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'The files are too large to send. Use fewer or smaller files.' : res.statusText || 'Request failed'));
      setDone(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done title="Request received" id={done} lines={["We'll review it and get back to you with the next steps."]} />;

  return (
    <form onSubmit={submit} className={card}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{replacement ? 'Tell us about the original part' : 'Tell us what you need'}</h3>

      {part?.lipo && <p role="note" className="rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">Shipping of LiPo batteries is limited; enquire first.</p>}
      <div>
        {mode ? (
          <>
            <span className={label}>Category</span>
            <p className="text-gray-900 dark:text-gray-100">{CATEGORIES.find((c) => c.id === mode)?.label}</p>
            <input type="hidden" name="category" value={mode} />
            <input type="hidden" name="deliver" value="print" />
          </>
        ) : (
          <>
            <label htmlFor="category" className={label}>Category</label>
            <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              {CATEGORIES.filter((c) => c.id !== 'laser' && c.id !== 'material').map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </>
        )}
      </div>
      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" required maxLength={2000} rows={5} defaultValue={part ? `Enquiry about: ${part.title} (${part.id})\nQuantity and what it is for: ` : undefined} placeholder={replacement ? 'What the part is, what it came from, what broke, and the sizes you can measure (hole spacing, thickness).' : PROMPTS[category]} className={input} />
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

      {!mode && <fieldset>
        <legend className={label}>Deliver as</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {DELIVERABLES.map((d) => (
            <label key={d.id} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="radio" name="deliver" value={d.id} checked={deliver === d.id} onChange={() => setDeliver(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>}

      {!mode && <div>
        <label htmlFor="extras" className={label}>Moving parts or electronics inside? (optional)</label>
        <input id="extras" name="extras" maxLength={300} className={input} />
      </div>}
      <div>
        <label htmlFor="budget" className={label}>Budget (optional)</label>
        <input id="budget" name="budget" maxLength={50} className={input} />
      </div>
      {mode === 'laser' && (
        <div>
          <label htmlFor="designFile" className={label}>Design file (optional, .svg, ASCII .dxf or .pdf, up to 4MB)</label>
          <input id="designFile" name="designFile" type="file" accept={DESIGN_EXTS.join(',')} className={input} />
        </div>
      )}
      {mode !== 'material' && <div>
        <label htmlFor="images" className={label}>{replacement ? 'Photos of the original part (up to 3, png, jpg or webp, 5MB each)' : 'Reference images (optional, up to 3, png, jpg or webp, 5MB each)'}</label>
        <input id="images" name="images" type="file" multiple accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className={input} />
      </div>}

      <ContactFields addressRequired={deliver !== 'file'} notes={false} />

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy} aria-label="Send request" title="Send request" className={submitBtn}>{busy ? 'Sending' : 'Send'}</button>
    </form>
  );
}
