import { NextResponse } from 'next/server';
import path from 'path';
import { adminGate } from '@/lib/adminAuth';
import { getBytes } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Admin-only download of a stored model or reference image. The public /api/upload/[name] route needs the random name;
// this one needs the admin token, so the page can offer a download link without making uploads listable.
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const denied = await adminGate(request);
  if (denied) return denied;
  const name = path.basename((await params).name);
  const bytes = await getBytes('uploads', name);
  if (!bytes) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
