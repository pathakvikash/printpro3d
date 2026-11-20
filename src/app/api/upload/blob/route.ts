import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { onBlobStore } from '@/lib/store';
import { limited } from '@/lib/spam';
import { ALLOWED_EXTS, MAX_UPLOAD, nameFromBlobPath } from '@/lib/uploadRules';

/** Token endpoint for direct browser-to-Blob uploads of big models. No onUploadCompleted: POST /api/upload/finalize does the work. */
export async function POST(request: Request) {
  if (!onBlobStore()) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || typeof body.type !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  if (body.type === 'blob.generate-client-token') {
    const slow = await limited(request, 'upload'); // same per-IP hourly cap as POST /api/upload
    if (slow) return slow;
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // the browser picks the name, so it must be exactly uploads/<random name with an allowed extension>
        if (!nameFromBlobPath(pathname)) throw new Error(`Invalid file name. Allowed: ${ALLOWED_EXTS.join(', ')}`);
        return { maximumSizeInBytes: MAX_UPLOAD, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 400 });
  }
}
