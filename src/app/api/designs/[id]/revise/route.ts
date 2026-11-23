import { checkPrompt } from '@/lib/aiGuard';
import { REVISE_REQUEST_MAX } from '@/lib/aiBlueprint';
import { parseEmail } from '@/lib/contact';
import { DesignError, revise } from '@/lib/designProjects';
import { aiOrResponse, readBody, respond, view } from '../../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds: one LLM call

/** AI revision: { request, email? } (email only when the project has none). 422 with a reason when the AI's blueprint fails validation. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await aiOrResponse(request); // 503 when AI is not configured, 429 when over the IP limit
  if ('res' in a) return a.res;
  return respond(async () => {
    const body = await readBody(request);
    const c = checkPrompt(body.request);
    if (!c.ok) throw new DesignError(422, c.reason);
    if (c.prompt.length > REVISE_REQUEST_MAX) throw new DesignError(422, `Describe the change in up to ${REVISE_REQUEST_MAX} characters.`);
    let email: string | undefined;
    if (body.email) {
      try {
        email = parseEmail((k) => (k === 'email' ? body.email : undefined));
      } catch (e) {
        throw new DesignError(400, e instanceof Error ? e.message : 'email is invalid');
      }
    }
    const r = await revise(a.ai, (await ctx.params).id, { email, request: c.prompt });
    return { project: view(r.project), revision: r.revision, diff: r.diff, cached: r.cached };
  });
}
