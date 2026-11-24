import { NextResponse } from 'next/server';
import { DesignError, type Project } from '@/lib/designProjects';
import { configuredAi } from '@/lib/designAi';
import { aiEnv } from '@/lib/aiSettings';
import { limited } from '@/lib/spam';

export const NO_AI = { error: 'AI is not configured on this site. You can still start from a template or edit by hand.', code: 'ai_not_configured' };

/** Project as the browser sees it: no email. */
export const view = ({ email: _email, ...p }: Project) => p;

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= 32 * 1024)) throw new DesignError(413, 'Request too large');
  try {
    const b = await request.json();
    if (b && typeof b === 'object' && !Array.isArray(b)) return b;
  } catch {}
  throw new DesignError(400, 'Invalid JSON');
}

/** Runs a handler and maps DesignError to its status; anything else is a 500 that says nothing about the cause. */
export async function respond(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof DesignError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('Designs: unexpected failure:', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

/** For AI routes: the rate limit (429 Response) or the AI call, or the "AI not configured" 503. */
export async function aiOrResponse(request: Request): Promise<{ ai: NonNullable<ReturnType<typeof configuredAi>> } | { res: Response }> {
  const ai = configuredAi(await aiEnv());
  if (!ai) return { res: NextResponse.json(NO_AI, { status: 503 }) };
  const slow = await limited(request, 'ai');
  return slow ? { res: slow } : { ai };
}
