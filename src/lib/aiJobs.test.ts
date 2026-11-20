import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { claimRepair, markReady, readJob, recordDownloadFailure, releaseCopy, reserveCopy, serialJob, writeJob, type Job } from './aiJobs.ts';

// jobs live in $DATA_DIR/ai-jobs, so each file runs with its own temp DATA_DIR
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'aijobs-'));

const newJob = (): Job => ({
  id: crypto.randomUUID(), meshyId: 'm1', kind: 'text', name: 'Ann', email: 'ann@b.co', phone: '',
  prompt: 'a box', createdAt: '2026-11-20T10:00:00Z', state: 'ready', file: 'base.stl', files: ['base.stl'],
});

test('two concurrent callers: exactly one gets the repair claim', async () => {
  const j = newJob();
  await writeJob(j);
  const results = await Promise.all([claimRepair(j.id), claimRepair(j.id)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await readJob(j.id))?.repairTried, true);
  assert.equal(await claimRepair(j.id), false); // later sizes never repair again
});

test('copy slots are reserved in the lock, capped, and given back on failure', async () => {
  const j = newJob();
  await writeJob(j);
  // files starts with the base file; copies are allowed while files.length <= max (max = 2 here)
  assert.deepEqual(
    await Promise.all([reserveCopy(j.id, 'a.stl', 2), reserveCopy(j.id, 'b.stl', 2), reserveCopy(j.id, 'c.stl', 2)]),
    [true, true, false],
  );
  assert.deepEqual((await readJob(j.id))?.files, ['base.stl', 'a.stl', 'b.stl']);
  await releaseCopy(j.id, 'a.stl');
  assert.deepEqual((await readJob(j.id))?.files, ['base.stl', 'b.stl']);
  assert.equal(await reserveCopy(j.id, 'd.stl', 2), true);
});

test('serialJob runs calls for one job one after another, even after a failure', async () => {
  const order: string[] = [];
  const job = (tag: string, ms: number) =>
    serialJob('job-serial', async () => {
      order.push(`start ${tag}`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`end ${tag}`);
      return tag;
    });
  const failed = serialJob('job-serial', async () => {
    throw new Error('boom');
  }).catch((e: Error) => e.message);
  const out = await Promise.all([job('a', 30), failed, job('b', 1)]);
  assert.deepEqual(out, ['a', 'boom', 'b']);
  assert.deepEqual(order, ['start a', 'end a', 'start b', 'end b']);
});

test('a job whose STL keeps failing is marked failed after two attempts', async () => {
  const j = { ...newJob(), state: 'working' as const, file: undefined, files: [] };
  await writeJob(j);
  await recordDownloadFailure(j.id);
  assert.equal((await readJob(j.id))?.state, 'working'); // one failure: the next poll retries
  await recordDownloadFailure(j.id);
  const after = await readJob(j.id);
  assert.equal(after?.state, 'failed');
  assert.match(after?.message ?? '', /could not read your model file/);
});

test('two polls race to store the downloaded STL: the first wins, the second keeps the first', async () => {
  const j = { ...newJob(), state: 'working' as const, file: undefined, files: [] };
  await writeJob(j);
  assert.deepEqual(await Promise.all([markReady(j.id, 'one.stl'), markReady(j.id, 'two.stl')]), ['one.stl', 'one.stl']);
  const after = await readJob(j.id);
  assert.equal(after?.state, 'ready');
  assert.deepEqual(after?.files, ['one.stl']); // no duplicate entry for the order email
});
