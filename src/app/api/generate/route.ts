import { NextResponse } from 'next/server';
import path from 'path';
import crypto from 'crypto';
import { parseContact } from '@/lib/contact';
import { isImage } from '@/lib/image';
import { checkPrompt, takeUsage } from '@/lib/aiGuard';
import { MeshyError, createImageTask, createTextTask, meshyEnabled } from '@/lib/meshy';
import { writeJob, type Job } from '@/lib/aiJobs';
import { filled, limited } from '@/lib/spam';

export const maxDuration = 30; // seconds: starts a Meshy task and returns; the browser polls /api/generate/[id]

const MAX_IMG = 5 * 1024 * 1024;
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

const MAX_IN_FLIGHT = 4;
const inFlight = new Set<string>();
let active = 0;

export async function POST(request: Request) {
  const slow = await limited(request, 'ai');
  if (slow) return slow;
  if (!meshyEnabled()) return err('AI generation is not available right now. Please use "I have an idea" and we will design it.', 503);

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

  // ponytail: process-local guard, one request per email and 4 at once per process (same as /api/design); move to a shared store if the app runs on several instances
  const who = contact.email.trim().toLowerCase();
  if (inFlight.has(who)) return err('Please wait for your current model to finish.', 429);
  if (active >= MAX_IN_FLIGHT) return err('AI generation is busy right now. Please try again in a minute.', 503);

  // claimed before any await, so a second request for the same email cannot slip past the checks above
  inFlight.add(who);
  active++;

  let meshyId: string;
  try {
    // checks the limits and counts one use in one step; the use is NOT refunded if Meshy then fails (a failed call cannot be retried for free)
    const limit = await takeUsage(contact.email);
    if (!limit.ok) {
      return err(
        limit.scope === 'email'
          ? `You have reached the daily limit of ${limit.limit} AI models. Try again tomorrow, or use "I have an idea" and we will design it.`
          : 'We have reached our daily limit of AI models. Try again tomorrow, or use "I have an idea" and we will design it.',
        429
      );
    }
    meshyId = mode === 'text' ? await createTextTask(prompt) : await createImageTask(dataUri);
  } catch (e) {
    const status = e instanceof MeshyError ? e.status : 0;
    console.error('Generate: Meshy create failed:', e instanceof Error ? e.message : e);
    if (status === 400 || status === 403) return err("We couldn't generate that. Try a different description or photo, or use \"I have an idea\".", 422);
    if (status === 429) return err('The generator is busy. Please try again in a few minutes.', 503);
    return err('AI generation is not available right now. Please use "I have an idea" and we will design it.', 503);
  } finally {
    inFlight.delete(who);
    active--;
  }

  const job: Job = {
    id: crypto.randomUUID(), meshyId, kind: mode, name: contact.name, email: contact.email, phone: contact.phone,
    prompt: mode === 'text' ? prompt : '(customer photo)', createdAt: new Date().toISOString(), state: 'working', files: [],
  };
  try {
    await writeJob(job);
  } catch (e) {
    console.error('Generate: could not save job', e);
    return err('Something went wrong. Please try again.', 500);
  }
  return NextResponse.json({ id: job.id }); // our id only, never the Meshy id
}
