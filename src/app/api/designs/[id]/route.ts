import { DesignError, finalStats, getProject } from '@/lib/designProjects';
import { respond, view } from '../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const p = await getProject((await ctx.params).id);
    if (!p) throw new DesignError(404, 'Design not found');
    return { project: view(p), stats: await finalStats(p) };
  });
}
