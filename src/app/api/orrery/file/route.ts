import { bearerSub, validFileName } from '@/lib/orrery';
import { ownsFile } from '@/lib/orreryServer';
import { getBytes } from '@/lib/store';

export const dynamic = 'force-dynamic';

// STL bytes for Orrery's proxy: needs a valid Orrery bearer token and a file that one of this user's generation jobs made.
export async function GET(request: Request) {
  const who = bearerSub(request);
  if (who instanceof Response) return who;
  const name = new URL(request.url).searchParams.get('name') ?? '';
  if (!validFileName(name)) return Response.json({ error: 'Bad file name' }, { status: 400 });
  const bytes = (await ownsFile(who.sub, name)) ? await getBytes('uploads', name) : null;
  if (!bytes) return Response.json({ error: 'File not found' }, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'model/stl',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}
