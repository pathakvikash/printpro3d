import { NextResponse } from 'next/server';
import path from 'path';
import { getBytes } from '@/lib/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const sanitized = path.basename(name);
    const buffer = await getBytes('uploads', sanitized);
    if (!buffer) throw new Error('not found');

    const ext = path.extname(sanitized).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.stl': 'application/sla',
      '.obj': 'model/obj',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.3mf': 'model/3mf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${sanitized}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });
  }
}
