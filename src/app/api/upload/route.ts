import { NextResponse } from 'next/server';
import path from 'path';
import { storeUpload } from '@/lib/uploads';
import { ALLOWED_EXTS as ALLOWED, MAX_UPLOAD as MAX_SIZE } from '@/lib/uploadRules';
import { filled, limited } from '@/lib/spam';

export const maxDuration = 60; // seconds: parsing a large mesh takes a while

export async function POST(request: Request) {
  const slow = await limited(request, 'upload');
  if (slow) return slow;
  // reject oversized bodies before reading them (200MB + 1MB multipart slack)
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= MAX_SIZE + 1024 * 1024)) {
    return NextResponse.json({ error: 'File too large. Maximum size: 200MB' }, { status: 413 });
  }
  try {
    const formData = await request.formData();
    if (filled(formData.get('website'))) {
      // honeypot: look like a success, save nothing
      return NextResponse.json({ url: '', name: '', size: 0, type: 'stl', file: `${crypto.randomUUID()}.stl`, stats: null });
    }
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED.join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 200MB' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // random name: the download URL has no login, so it must not be guessable
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    return NextResponse.json(await storeUpload(buffer, uniqueName, file.name));
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
