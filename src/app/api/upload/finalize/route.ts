import { NextResponse } from 'next/server';
import { onBlobStore } from '@/lib/store';
import { finalizeUpload } from '@/lib/uploads';
import { ownerFor, recordOwner, withCookie } from '@/lib/fileAccess';

export const maxDuration = 60; // seconds: fetching and parsing a large mesh takes a while

/** After the browser put a file into Blob: validate it, analyze it, write the stats sidecar; answers like POST /api/upload. */
export async function POST(request: Request) {
  if (!onBlobStore()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const body = await request.json().catch(() => null);
  try {
    const r = await finalizeUpload(body?.name, body?.originalName);
    const { owner, setCookie } = await ownerFor(request);
    if (r.status === 200 && typeof body?.name === 'string') await recordOwner(body.name, owner);
    return withCookie(NextResponse.json(r.body, { status: r.status }), setCookie);
  } catch (error) {
    console.error('Finalize error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
