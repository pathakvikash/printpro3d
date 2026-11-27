// Server side of a model upload, shared by POST /api/upload (bytes in the request) and POST /api/upload/finalize (bytes already in Blob).
import { analyzeModel } from './analyzeModel.ts';
import type { MeshStats } from './quote.ts';
import { hasOwner } from './fileAccess.ts';
import { findJobByFile } from './aiJobs.ts';
import { del, getBytes, putBytes, putJson } from './store.ts';
import { MAX_UPLOAD, extOf, fileProblem, validUploadName } from './uploadRules.ts';

export type UploadResult = { url: string; name: string; size: number; type: string; file: string; stats: MeshStats | null };

/** Analyzes the model, writes its `.stats.json` sidecar and builds the JSON the upload routes answer with. The bytes must already be stored. */
export async function finishUpload(buffer: Buffer, file: string, originalName: string): Promise<UploadResult> {
  const ext = extOf(file);
  const stats = analyzeModel(buffer, ext);
  await putJson('uploads', `${file}.stats.json`, stats);
  return { url: `/api/upload/${file}`, name: originalName, size: buffer.length, type: ext.slice(1), file, stats };
}

export const storeUpload = async (buffer: Buffer, file: string, originalName: string) => {
  await putBytes('uploads', file, buffer);
  return finishUpload(buffer, file, originalName);
};

export type FinalizeDeps = {
  read: (name: string) => Promise<Buffer | null>;
  exists: (name: string) => Promise<boolean>;
  remove: (name: string) => Promise<void>;
  finish: typeof finishUpload;
  claimed?: (name: string) => Promise<boolean>; // already has an owner record or is an AI job's file: not a fresh upload
};
const realDeps: FinalizeDeps = {
  read: (n) => getBytes('uploads', n),
  exists: async (n) => (await getBytes('uploads', n)) !== null,
  remove: (n) => del('uploads', n),
  finish: finishUpload,
  claimed: async (n) => (await hasOwner(n)) || (n.toLowerCase().endsWith('.stl') && !!(await findJobByFile(n))),
};

export type Finalized = { status: number; body: UploadResult | { error: string } };

/** Checks a file the browser put into Blob, analyzes it, and deletes it when it is missing, empty, too big or the wrong type. */
export async function finalizeUpload(name: unknown, originalName: unknown, deps: FinalizeDeps = realDeps): Promise<Finalized> {
  if (!validUploadName(name)) return { status: 400, body: { error: 'Invalid file name' } };
  if (await deps.claimed?.(name)) return { status: 409, body: { error: 'Already finalized' } };
  if (await deps.exists(`${name}.stats.json`)) return { status: 409, body: { error: 'Already finalized' } };
  const buffer = await deps.read(name);
  if (!buffer) return { status: 404, body: { error: 'Upload not found. Please try again.' } };
  const bad = buffer.length === 0 ? 'The file is empty' : buffer.length > MAX_UPLOAD ? 'File too large. Maximum size: 200MB' : fileProblem(name, buffer.length);
  if (bad) {
    await deps.remove(name).catch(() => {});
    return { status: buffer.length > MAX_UPLOAD ? 413 : 400, body: { error: bad } };
  }
  const shown = typeof originalName === 'string' && originalName.trim() ? originalName.trim().slice(0, 200) : name;
  return { status: 200, body: await deps.finish(buffer, name, shown) };
}
