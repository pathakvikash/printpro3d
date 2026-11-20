import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeUpload, type FinalizeDeps } from './uploads.ts';
import { MAX_UPLOAD, fileProblem, imagesTotalProblem, nameFromBlobPath, newUploadName, validUploadName } from './uploadRules.ts';

const good = newUploadName('.stl');

test('name scheme: generated names validate, others do not', () => {
  assert.ok(validUploadName(good));
  assert.equal(nameFromBlobPath(`uploads/${good}`), good);
  for (const bad of ['', 'x.stl', `../${good}`, `${good}.exe`, good.replace('.stl', '.png'), good.replace('.stl', ''), `a/${good}`]) {
    assert.equal(validUploadName(bad), false, bad);
  }
  for (const p of [good, `orders/${good}`, `uploads/${good}/x`, `uploads/../${good}`, `uploads/x.stl`, null, 5]) {
    assert.equal(nameFromBlobPath(p), null, String(p));
  }
});

test('extension and size gating', () => {
  assert.equal(fileProblem('a.STL', 10), null);
  assert.equal(fileProblem('a.3mf', MAX_UPLOAD), null);
  assert.match(fileProblem('a.exe', 10)!, /Invalid file type/);
  assert.match(fileProblem('stl', 10)!, /Invalid file type/);
  assert.match(fileProblem('a.stl', MAX_UPLOAD + 1)!, /too large/);
  assert.equal(imagesTotalProblem([1e6, 1e6, 1e6]), null);
  assert.match(imagesTotalProblem([2e6, 2e6, 1e6])!, /too large/);
});

function fake(files: Record<string, Buffer>) {
  const removed: string[] = [];
  const deps: FinalizeDeps = {
    read: async (n) => files[n] ?? null,
    exists: async (n) => n in files,
    remove: async (n) => { removed.push(n); delete files[n]; },
    finish: async (b, file, name) => ({ url: `/api/upload/${file}`, name, size: b.length, type: 'stl', file, stats: null }),
  };
  return { deps, removed };
}

test('finalize: bad name, missing, empty, oversized, wrong type, already finalized', async () => {
  const { deps, removed } = fake({ [good]: Buffer.alloc(0) });
  assert.equal((await finalizeUpload('../x.stl', undefined, deps)).status, 400);
  assert.equal((await finalizeUpload(undefined, undefined, deps)).status, 400);
  assert.equal((await finalizeUpload(newUploadName('.stl'), undefined, deps)).status, 404);
  assert.equal((await finalizeUpload(good, undefined, deps)).status, 400); // empty
  assert.deepEqual(removed, [good]);

  const big = newUploadName('.obj');
  const f2 = fake({ [big]: { length: MAX_UPLOAD + 1 } as Buffer });
  assert.equal((await finalizeUpload(big, undefined, f2.deps)).status, 413);
  assert.deepEqual(f2.removed, [big]);

  const f3 = fake({ [good]: Buffer.from('x'), [`${good}.stats.json`]: Buffer.from('null') });
  assert.equal((await finalizeUpload(good, undefined, f3.deps)).status, 409);
  assert.deepEqual(f3.removed, []); // never deletes a finished upload
});

test('finalize ok: same JSON shape as POST /api/upload', async () => {
  const { deps, removed } = fake({ [good]: Buffer.from('solid x') });
  const r = await finalizeUpload(good, 'my part.stl', deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { url: `/api/upload/${good}`, name: 'my part.stl', size: 7, type: 'stl', file: good, stats: null });
  assert.deepEqual(removed, []);
});
