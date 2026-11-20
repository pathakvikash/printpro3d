import { NextResponse } from 'next/server';
import path from 'path';
import { parseEmail, text } from '@/lib/contact';
import { isImage } from '@/lib/image';
import { checkPrompt, takeUsage } from '@/lib/aiGuard';
import { DESIGN_PROMPT_MAX, IMAGE_MAX_BYTES, modelFor, parseModelReply, pickProvider, type DesignInput } from '@/lib/aiDesign';
import { runProvider } from '@/lib/aiProviders';
import { filled, limited } from '@/lib/spam';

export const runtime = 'nodejs'; // provider code may spawn a child process
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds: one LLM call (the provider timeout is 60 s)

const MIME: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};
const IMG_ERR = 'Image must be png, jpg or webp, up to 5MB';
const FAILED = 'The AI service did not answer. Try again.';
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

const MAX_IN_FLIGHT = 4;
const inFlight = new Set<string>();
let active = 0;

// same rule as aiGuard's norm (not exported there)
const norm = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Windows of at most 400 chars, a new one every 300, each edge moved back to a space so no word is cut. */
function windows(n: string): string[] {
  const back = (i: number, min: number) => {
    if (i >= n.length || n[i] === ' ') return i;
    const j = n.lastIndexOf(' ', i);
    return j > min ? j : i; // no space to back up to: cut the word rather than stall
  };
  const out: string[] = [];
  let s = 0;
  for (;;) {
    const e = back(s + 400, s);
    const w = n.slice(s, e).trim();
    if (w.length < 3 && out.length) out[out.length - 1] += ` ${w}`; // too short to check alone: merge into the previous window
    else out.push(w);
    if (e >= n.length) return out;
    s = back(s + 300, s);
  }
}

export async function POST(request: Request) {
  const slow = await limited(request, 'ai');
  if (slow) return slow;
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= IMAGE_MAX_BYTES + 1024 * 1024)) return err('Request too large', 413);

  const provider = pickProvider(process.env);
  const model = provider ? modelFor(provider, process.env) : null;
  if (!provider || !model) {
    return err(
      process.env.NODE_ENV !== 'production'
        ? 'AI drawing is not set up. Set ANTHROPIC_API_KEY, or AI_PRESET or AI_BASE_URL with AI_MODEL (and AI_API_KEY for a keyed preset), then restart the server. Run npm run ai:models to see what is available.'
        : 'AI drawing is not available right now. Please use "I have an idea" and we will design it.',
      503
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err('Invalid form data', 400);
  }
  const get = (k: string) => form.get(k);
  if (filled(get('website'))) return NextResponse.json({ title: '', notes: '', shapes: [] }); // honeypot: look like a success, do nothing

  try {
    let email: string;
    let prompt: string;
    const input: DesignInput = { text: '' };
    try {
      email = parseEmail(get);
      prompt = text(get, 'prompt', DESIGN_PROMPT_MAX, false);
      const f = get('image');
      if (f instanceof File && f.size > 0) {
        const ext = path.extname(f.name).toLowerCase();
        if (!MIME[ext] || f.size > IMAGE_MAX_BYTES) throw new Error(IMG_ERR);
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!isImage(bytes, ext)) throw new Error(IMG_ERR);
        input.image = { mime: MIME[ext], base64: Buffer.from(bytes).toString('base64') };
      }
      if (!prompt && !input.image) throw new Error('Describe your part or add a photo.');
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Invalid request', 400);
    }
    input.text = prompt;

    // checkPrompt caps at 400 chars but the design prompt allows 600, so screen the normalised prompt (same rule as aiGuard's
    // norm, so a banned phrase cannot hide behind punctuation) in windows of up to 400 chars, one starting every 300, each
    // boundary moved back to a space so no word is cut ("glue gun" stays whole). ponytail: a banned phrase longer than about
    // 100 chars could straddle two windows; no phrase in the list is that long. checkPrompt also rejects text under 3 chars,
    // so a photo plus a tiny note skips the text check.
    const n = norm(prompt);
    if (!(input.image && n.length < 3)) {
      for (const w of windows(n)) {
        const c = checkPrompt(w);
        if (!c.ok) return err(c.reason, 422);
      }
    }

    // ponytail: process-local guard, one drawing per email and 4 at once per process; move to a shared store if the app runs on several instances
    const who = email.trim().toLowerCase();
    if (inFlight.has(who)) return err('Please wait for your current drawing to finish.', 429);
    if (active >= MAX_IN_FLIGHT) return err('AI drawing is busy right now. Please try again in a minute.', 503);
    inFlight.add(who);
    active++;

    let reply: string;
    try {
      // checks the daily limits and counts one use in one step, before the call: an attempted call counts, so failures cannot be retried for free
      const limit = await takeUsage(email, undefined, 'design');
      if (!limit.ok) {
        return err(
          limit.scope === 'email'
            ? `You have reached the daily limit of ${limit.limit} AI models. Try again tomorrow, or use "I have an idea" and we will design it.`
            : 'We have reached our daily limit of AI models. Try again tomorrow, or use "I have an idea" and we will design it.',
          429
        );
      }
      try {
        reply = await runProvider(provider, input, process.env);
      } catch (e) {
        console.error('Design: provider call failed:', e instanceof Error ? e.message : 'unknown');
        return err(FAILED, 502);
      }
    } finally {
      inFlight.delete(who);
      active--;
    }

    let design: ReturnType<typeof parseModelReply>;
    try {
      design = parseModelReply(reply);
    } catch {
      return err(FAILED, 502);
    }
    if (!design.ok) return err(design.reason, 422);
    return NextResponse.json({ title: design.title, notes: design.notes, shapes: design.shapes });
  } catch (e) {
    console.error('Design: unexpected failure:', e instanceof Error ? e.message : 'unknown');
    return err(FAILED, 502);
  }
}
