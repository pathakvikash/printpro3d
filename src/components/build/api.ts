// Browser calls to /api/designs. Every failure becomes an ApiError carrying the HTTP status (0 = network).
import type { Blueprint, BlueprintDiff } from '@/lib/designBlueprint';
import type { Caps, ProjectView } from '@/lib/buildFlow';
import type { MeshStats } from '@/lib/quote';
import type { Revision } from '@/lib/designProjects';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, body === undefined ? { signal } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, '');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : res.status === 413 ? 'That is too large to send.' : '');
  return data;
}

export type Created = { kind: 'plan'; project: ProjectView | null } | { kind: 'questions'; questions: string[]; canSkip: true };
type One = { project: ProjectView; stats?: MeshStats | null };
type Edited = One & { revision: Revision; diff: BlueprintDiff; cached?: boolean };

export const api = {
  caps: (signal?: AbortSignal) => call<Caps>('/api/designs', undefined, signal),
  create: (body: Record<string, unknown>) => call<Created>('/api/designs', body),
  get: (id: string, signal?: AbortSignal) => call<One>(`/api/designs/${id}`, undefined, signal),
  revise: (id: string, request: string, email?: string) => call<Edited>(`/api/designs/${id}/revise`, { request, ...(email ? { email } : {}) }),
  manualBlueprint: (id: string, blueprint: Blueprint) => call<Edited>(`/api/designs/${id}/manual`, { blueprint }),
  manualScale: (id: string, longestMm: number) => call<Edited>(`/api/designs/${id}/manual`, { longestMm }),
  undo: (id: string) => call<One>(`/api/designs/${id}/undo`, {}),
  approve: (id: string) => call<One>(`/api/designs/${id}/approve`, {}),
  finalize: (id: string) => call<One>(`/api/designs/${id}/finalize`, {}),
  /** Plain multipart upload for a scale-only STL: { file } is the stored name. */
  async upload(f: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', f);
    let res: Response;
    try { res = await fetch('/api/upload', { method: 'POST', body: fd }); } catch { throw new ApiError(0, ''); }
    const data = (await res.json().catch(() => ({}))) as { file?: string; error?: string };
    if (!res.ok || !data.file) throw new ApiError(res.status, data.error || (res.status === 413 ? 'This file is too large to upload here. Try a smaller one.' : 'Upload failed'));
    return data.file;
  },
};
