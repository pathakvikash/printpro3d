import { NextResponse } from 'next/server';
import path from 'path';
import crypto from 'crypto';
import { parseContact } from '@/lib/contact';
import { isImage } from '@/lib/image';
import { checkPrompt } from '@/lib/aiGuard';
import { meshyEnabled } from '@/lib/meshy';
import { startJob } from '@/lib/aiGenerate';
import { filled, limited } from '@/lib/spam';
import { ownerFor, withCookie } from '@/lib/fileAccess';

export const maxDuration = 30; // seconds: starts a Meshy task and returns; the browser polls /api/generate/[id]

const MAX_IMG = 5 * 1024 * 1024;
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const slow = await limited(request, 'ai');
  if (slow) return slow;
  if (!meshyEnabled()) return err('AI generation is not available right now. Please use "I have an idea" and we will review it and send you a quote.', 503);

  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= MAX_IMG + 1024 * 1024)) return err('Request too large', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err('Invalid form data', 400);
  }
  const get = (k: string) => form.get(k);
  if (filled(get('website'))) return NextResponse.json({ id: crypto.randomUUID() }); // honeypot: look like a success, save nothing

  let contact: ReturnType<typeof parseContact>;
  let mode: 'text' | 'image';
  let prompt = '';
  let dataUri = '';
  try {
    contact = parseContact(get, { addressRequired: false });
    const m = get('mode');
    if (m !== 'text' && m !== 'image') throw new Error('mode must be text or image');
    mode = m;
    if (mode === 'text') {
      const c = checkPrompt(get('prompt'));
      if (!c.ok) return err(c.reason, 422); // plain-language reason for the customer
      prompt = c.prompt;
    } else {
      const f = get('image');
      if (!(f instanceof File) || f.size === 0) throw new Error('image is required');
      const ext = path.extname(f.name).toLowerCase();
      if (!MIME[ext] || f.size > MAX_IMG) throw new Error('Image must be png, jpg or webp, up to 5MB');
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isImage(bytes, ext)) throw new Error('Image must be png, jpg or webp, up to 5MB');
      dataUri = `data:${MIME[ext]};base64,${Buffer.from(bytes).toString('base64')}`;
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Invalid request', 400);
  }

  const { owner, setCookie } = await ownerFor(request);
  const r = await startJob({ email: contact.email, name: contact.name, phone: contact.phone, mode, prompt, dataUri, owner });
  if (!r.ok) return err(r.error, r.status);
  return withCookie(NextResponse.json({ id: r.id }), setCookie); // our id only, never the Meshy id
}
