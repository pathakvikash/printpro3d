import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const sanitized = path.basename(name);
    const filepath = path.join(process.cwd(), 'uploads', sanitized);
    const buffer = await readFile(filepath);

    const ext = path.extname(sanitized).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.stl': 'application/sla',
      '.obj': 'model/obj',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.3mf': 'model/3mf',
    };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${sanitized}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
