import { NextResponse } from 'next/server';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import crypto from 'crypto';
import { analyzeModel } from '@/lib/analyzeModel';
import { BED_MM } from '@/lib/quote';
import { MeshyError, downloadTo, getTask, repairForPrint } from '@/lib/meshy';
import { JOBS, claimRepair, readJob, releaseCopy, reserveCopy, serialJob, updateJob } from '@/lib/aiJobs';
import { scaleStl } from '@/lib/stlScale';
import { getBytes, putBytes, putJson } from '@/lib/store';

export const maxDuration = 60; // seconds: the first size may wait for Meshy's print repair (up to 90 s)

const MIN_MM = 10;
const MAX_MM = Math.max(BED_MM.x, BED_MM.y, BED_MM.z);
const MAX_COPIES = 20; // sized copies per job, so repeated clicks cannot fill the disk
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const len = request.headers.get('content-length');
  if (len === null || !(Number(len) <= 1024)) return err('Request too large', 413);
  let longestMm: unknown;
  try {
    longestMm = (await request.json())?.longestMm;
  } catch {
    return err('Invalid JSON', 400);
  }
  if (typeof longestMm !== 'number' || !Number.isFinite(longestMm) || longestMm < MIN_MM || longestMm > MAX_MM) {
    return err(`Size must be between ${MIN_MM} and ${MAX_MM} mm`, 400);
  }

  const { id } = await params;
  // sizes on one job run one at a time, and each reads the job after the previous one has finished
  return serialJob(id, () => sizeJob(id, longestMm as number));
}

async function sizeJob(id: string, longestMm: number): Promise<NextResponse> {
  const job = await readJob(id);
  if (!job) return err('Not found', 404);
  if (job.state !== 'ready' || !job.file) return err('Your model is not ready yet', 409);

  // the copy slot is reserved in the job lock before any work, and given back if the copy fails
  const file = `${Date.now()}-${crypto.randomUUID()}.stl`;
  if (!(await reserveCopy(id, file, MAX_COPIES))) return err('Too many sizes tried for this model. Generate another.', 429);

  try {
    // first size only: try Meshy's FDM repair (10 credits) once per job; any failure keeps the original.
    // The repair is not counted in the usage ledger (see claimRepair).
    let baseName: string | undefined = job.repairedFile;
    if (await claimRepair(id)) {
      try {
        const t = await getTask(job.kind, job.meshyId); // fresh signed URL
        if (!t.stlUrl) throw new Error('no STL url');
        const repairedUrl = await repairForPrint(t.stlUrl, longestMm);
        const rname = `${id}.repaired.stl`;
        const tmp = await mkdtemp(path.join(tmpdir(), 'ai-repair-'));
        try {
          await downloadTo(repairedUrl, path.join(tmp, rname));
          const repaired = await readFile(path.join(tmp, rname));
          scaleStl(repaired, 1); // must parse
          await putBytes(JOBS, rname, repaired);
        } finally {
          await rm(tmp, { recursive: true, force: true });
        }
        await updateJob(id, (j) => { j.repairedFile = rname; });
        baseName = rname;
      } catch (e) {
        console.error('Generate: repair skipped:', e instanceof MeshyError ? e.message : e instanceof Error ? e.message : e);
      }
    }
    const base = baseName ? await getBytes(JOBS, baseName) : await getBytes('uploads', job.file);
    if (!base) throw new Error('base model missing');
    const buffer = scaleStl(base, longestMm);
    await putBytes('uploads', file, buffer);
    const stats = analyzeModel(buffer, '.stl');
    await putJson('uploads', `${file}.stats.json`, stats); // same sidecar as /api/upload

    return NextResponse.json({ url: `/api/upload/${file}`, name: 'ai-model.stl', size: buffer.length, type: 'stl', file, stats });
  } catch (e) {
    await releaseCopy(id, file).catch(() => {});
    console.error('Generate size failed:', e instanceof Error ? e.message : e);
    return err('Could not resize the model', 500);
  }
}
