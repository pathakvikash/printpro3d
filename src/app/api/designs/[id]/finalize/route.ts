import { finalStats, finalize } from '@/lib/designProjects';
import { limited } from '@/lib/spam';
import { respond, view } from '../../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds: the print file is rebuilt with CSG here

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const slow = await limited(request, 'submit');
  if (slow) return slow;
  return respond(async () => {
    const p = await finalize((await ctx.params).id);
    return { project: view(p), stats: await finalStats(p) };
  });
}
