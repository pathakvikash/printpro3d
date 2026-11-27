import { manifest, orreryConfig } from '@/lib/orrery';

export const dynamic = 'force-dynamic'; // env is read per request

export function GET() {
  if (!orreryConfig()) return new Response('Not found', { status: 404 }); // integration off until ORRERY_APP_SECRET is set
  return Response.json(manifest(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
