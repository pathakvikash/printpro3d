import { DesignError, manual } from '@/lib/designProjects';
import { limited } from '@/lib/spam';
import { readBody, respond, view } from '../../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual revision: { blueprint } (full document), or { longestMm } for an uploaded mesh. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const slow = await limited(request, 'design');
  if (slow) return slow;
  return respond(async () => {
    const body = await readBody(request);
    if (body.blueprint === undefined && body.longestMm === undefined) throw new DesignError(400, 'send a blueprint, or longestMm for an uploaded model');
    const r = await manual((await ctx.params).id, { blueprint: body.blueprint, longestMm: body.longestMm });
    return { project: view(r.project), revision: r.revision, diff: r.diff };
  });
}
