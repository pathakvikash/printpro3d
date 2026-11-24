import { NextResponse } from 'next/server';
import { parseEmail } from '@/lib/contact';
import { checkPrompt, DESIGN_PROMPT_MAX } from '@/lib/aiGuard';
import { createFromMesh, createFromPrompt, createFromTemplate, DesignError } from '@/lib/designProjects';
import { capabilities } from '@/lib/designAi';
import { aiEnv } from '@/lib/aiSettings';
import { filled, limited } from '@/lib/spam';
import { aiOrResponse, readBody, respond, view } from './respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds: up to two AI calls (questions, then the plan)

/** What the UI may offer right now: AI features, the Meshy source, the AI tier. */
export const GET = async () => NextResponse.json(capabilities(await aiEnv()));

const checked = (v: unknown, what: string): string => {
  const c = checkPrompt(v, DESIGN_PROMPT_MAX);
  if (!c.ok) throw new DesignError(422, c.reason);
  return c.prompt.length >= 3 ? c.prompt : what;
};

/** Create a project: { source: 'prompt', email, prompt, answers?, skip? } | { source: 'template', template, cfg, email? } | { source: 'mesh', file, origin?, email? } */
export async function POST(request: Request) {
  return respond(async () => {
    const body = await readBody(request);
    if (filled(body.website)) return { kind: 'plan', project: null }; // honeypot: look like a success, do nothing
    const email = body.email === undefined || body.email === '' ? undefined : parseEmailSafe(body.email);
    if (body.source === 'prompt') {
      const a = await aiOrResponse(request);
      if ('res' in a) throw new DesignError(a.res.status, ((await a.res.json()) as { error: string }).error);
      if (!email) throw new DesignError(400, 'email is required');
      const prompt = checked(body.prompt, 'prompt');
      const answers = body.answers ? checked(body.answers, 'answers') : undefined;
      const out = await createFromPrompt(a.ai, { email, prompt, answers, skip: body.skip === true });
      return out.kind === 'plan' ? { kind: 'plan', project: view(out.project) } : out;
    }
    const slow = await limited(request, 'design');
    if (slow) throw new DesignError(429, 'Too many requests. Please try again in an hour.');
    if (body.source === 'template') return { kind: 'plan', project: view(await createFromTemplate({ email, template: body.template, cfg: body.cfg })) };
    if (body.source === 'mesh') return { kind: 'plan', project: view(await createFromMesh({ email, file: body.file, origin: body.origin })) };
    throw new DesignError(400, 'source must be "prompt", "template" or "mesh"');
  });
}

function parseEmailSafe(v: unknown): string {
  try {
    return parseEmail((k) => (k === 'email' ? v : undefined));
  } catch (e) {
    throw new DesignError(400, e instanceof Error ? e.message : 'email is invalid');
  }
}
