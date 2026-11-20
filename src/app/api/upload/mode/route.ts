import { NextResponse } from 'next/server';
import { onBlobStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Tells the browser whether big files can go straight to Blob (only when the store backend is Vercel Blob). */
export const GET = () => NextResponse.json({ direct: onBlobStore() });
