import { NextResponse } from 'next/server';
import { readJob } from '@/lib/aiJobs';
import { pollJob } from '@/lib/aiPoll';

export const maxDuration = 60; // seconds: a poll that finds the model ready downloads it (up to 100MB)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const job = await readJob((await params).id); // null for a non-uuid or unknown id
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // never return customer details or the Meshy id
  const p = await pollJob(job);
  if (p.state === 'ready') return NextResponse.json({ state: 'ready', file: p.file, url: `/api/upload/${p.file}` });
  if (p.state === 'failed') return NextResponse.json({ state: 'failed', message: p.message });
  return NextResponse.json({ state: 'working', progress: p.progress });
}
