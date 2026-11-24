import { NextResponse } from 'next/server';
import { parseEmail } from '@/lib/contact';
import { checkPrompt, takeUsage } from '@/lib/aiGuard';
import { CHANGE_MAX, proposeConfig, type CfgCheck } from '@/lib/aiCustomise';
import { configuredAi } from '@/lib/designAi';
import { aiEnv } from '@/lib/aiSettings';
import { kitById } from '@/lib/kits';
import { kitSettings } from '@/lib/kits/adapt';
import { normalizeCfg, templateById, type Cfg, type Field } from '@/lib/templateDefs';
import { filled, limited } from '@/lib/spam';
import { readBody } from '../../designs/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const err = (error: string, status: number) => NextResponse.json({ error }, { status });
const inFlight = new Set<string>(); // ponytail: process-local, one settings proposal per email at a time

/** Settings-only AI customisation: { email, kind: 'template' | 'kit', id, cfg, prompt }. Answers { cfg, changes, notes, geometry }.
 * The reply is untrusted: it is validated against the product's own schema and strict validator before it leaves this route. */
export async function POST(request: Request) {
  const slow = await limited(request, 'ai');
  if (slow) return slow;
  const ai = configuredAi(await aiEnv());
  if (!ai) return err('AI is not set up yet.', 503);
  let body: Record<string, unknown>;
  try { body = await readBody(request); } catch (e) { return err(e instanceof Error ? e.message : 'Invalid request', 400); }
  if (filled(body.website)) return NextResponse.json({ cfg: {}, changes: [], notes: '', geometry: false }); // honeypot
  let email: string;
  try { email = parseEmail((k) => (k === 'email' ? body.email : undefined)); } catch (e) { return err(e instanceof Error ? e.message : 'Enter a valid email.', 400); }
  const c = checkPrompt(body.prompt, CHANGE_MAX);
  if (!c.ok) return err(c.reason, 422);

  let name: string, fields: Field[], check: CfgCheck, current: Cfg;
  try {
    if (body.kind === 'template') {
      const t = templateById(body.id);
      if (!t) return err('Unknown product', 400);
      name = t.name; fields = t.fields; check = (cfg) => normalizeCfg(t, cfg, true); current = check(body.cfg as Cfg);
    } else if (body.kind === 'kit') {
      const kit = kitById(body.id) ?? (typeof body.id === 'string' ? kitById(body.id.split('/')[0])?.variants?.find((v) => v.id === body.id) : null);
      const s = kit ? kitSettings(kit) : null;
      if (!kit || !s) return err('Unknown product', 400);
      name = kit.title; fields = s.fields;
      check = (cfg) => { const next = { ...s.defaults, ...cfg }; s.build(next); return Object.fromEntries(s.fields.map((f) => [f.key, next[f.key]])); };
      current = check(body.cfg as Cfg);
    } else return err('kind must be "template" or "kit"', 400);
  } catch {
    return err('Those settings are not valid.', 400);
  }

  const who = email.trim().toLowerCase();
  if (inFlight.has(who)) return err('Please wait for your current request to finish.', 429);
  inFlight.add(who);
  try {
    const limit = await takeUsage(email, undefined, 'design'); // counted before the call, like every AI route
    if (!limit.ok) return err(limit.scope === 'email' ? `You have reached the daily limit of ${limit.limit} AI requests. Try again tomorrow.` : 'We have reached our daily limit of AI requests. Try again tomorrow.', 429);
    let out;
    try { out = await proposeConfig(ai, { name, fields, current, change: c.prompt, check }); } catch (e) {
      console.error('Customise: provider call failed:', e instanceof Error ? e.message : 'unknown');
      return err('The AI service did not answer. Try again.', 502);
    }
    return out.ok ? NextResponse.json({ cfg: out.cfg, changes: out.changes, notes: out.notes, geometry: out.geometry }) : err(out.reason, 422);
  } finally {
    inFlight.delete(who);
  }
}
