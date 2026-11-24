import { undo } from '@/lib/designProjects';
import { limited } from '@/lib/spam';
import { respond, view } from '../../respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const slow = await limited(request, 'design');
  if (slow) return slow;
  return respond(async () => ({ project: view(await undo((await ctx.params).id)) }));
}
