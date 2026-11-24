import { NextResponse } from 'next/server';
import { configuredAi } from '@/lib/designAi';
import { aiEnv } from '@/lib/aiSettings';
import { hit, limited } from '@/lib/spam';
import { parseBody, rerank } from '@/lib/suggest/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds: one LLM call

const intEnv = (k: string, d: number) => { const n = Number.parseInt(process.env[k] ?? '', 10); return Number.isFinite(n) && n >= 0 ? n : d; };

/**
 * AI re-ranking of the "Suggested next" bar. Only runs when an AI provider is configured (else { ai: false } and the browser keeps the rules).
 * Limits: the per-IP 'suggest' bucket, then an hourly total for this route (AI_SUGGEST_HOURLY_TOTAL, default 300). The prompt is built from
 * the design only, so there is no free text to screen. Any AI failure answers { items: null }: the rules stand.
 */
export async function POST(request: Request) {
  const ai = configuredAi(await aiEnv());
  if (!ai) return NextResponse.json({ items: null, ai: false }); // 200, not 503: the browser then logs no failed request; it stops asking
  const slow = await limited(request, 'suggest'); // own bucket: the debounced bar must not use up the design AI limit
  if (slow) return slow;
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= 32 * 1024)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const design = body && typeof body === 'object' && !Array.isArray(body) ? parseBody(body as Record<string, unknown>) : null;
  if (!design) return NextResponse.json({ error: 'Send { shapes, parts }' }, { status: 400 });
  try {
    if (!(await hit('suggest-all', 'all', intEnv('AI_SUGGEST_HOURLY_TOTAL', 300)))) return NextResponse.json({ items: null });
  } catch { /* a store failure lets the request through, like limited() */ }
  return NextResponse.json({ items: await rerank(ai, design.shapes, design.parts) });
}
