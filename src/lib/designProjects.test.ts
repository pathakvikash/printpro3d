import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { shapesToBlueprint, type Blueprint } from './designBlueprint.ts';
import { MAX_REVISIONS, approve, createFromMesh, createFromPrompt, createFromTemplate, finalize, getProject, manual, markOrdered, orderInfo, pruneProjects, revise, undo, type Ai } from './designProjects.ts';
import type { Shape } from './playground.ts';
import { meshStats } from './quote.ts';
import { getBytes, getJson, putBytes, putJson } from './store.ts';
import { toStl } from './playground.ts';

const box = (id: string, w: number, mode: 'solid' | 'hole' = 'solid'): Shape => ({ id, kind: 'box', mode, position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: w, y: 20, z: 10 } });
const bp = (w = 20): Blueprint => shapesToBlueprint([box('a', w), { ...box('h', 4, 'hole'), kind: 'cylinder', size: { x: 4, y: 4, z: 14 } }], 'Plate', 'A plate. Assumed 20 mm wide.');
const env = (extra: Record<string, string> = {}) => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'designs-'));
  delete process.env.AI_DAILY_PER_EMAIL; delete process.env.AI_DAILY_TOTAL;
  Object.assign(process.env, extra);
};
// provider stub: records calls, answers from a queue
const stub = (replies: unknown[]) => {
  const calls: { system: string; user: string }[] = [];
  const ai: Ai = async (system, user) => {
    calls.push({ system, user });
    const r = replies.shift();
    if (r instanceof Error) throw r;
    return typeof r === 'string' ? r : JSON.stringify(r);
  };
  return { ai, calls };
};
const E = 'a@b.co';

test('prompt: questions round (with skip), then a plan; assumptions live in notes', async () => {
  env();
  const { ai, calls } = stub([{ questions: ['How wide?', 'Which screws?', 'Indoors?', 'extra'], blueprint: null }, { questions: [], blueprint: bp() }]);
  const q = await createFromPrompt(ai, { email: E, prompt: 'a bracket' });
  assert.equal(q.kind, 'questions');
  assert.equal(q.kind === 'questions' && q.questions.length, 3);
  assert.equal(q.kind === 'questions' && q.canSkip, true);
  const r = await createFromPrompt(ai, { email: E, prompt: 'a bracket', skip: true });
  assert.equal(r.kind, 'plan');
  assert.match(calls[1].system, /Do not ask questions now/);
  const p = r.kind === 'plan' ? r.project : null!;
  assert.equal(p.status, 'draft');
  assert.equal(p.revisions.length, 1);
  assert.match(p.revisions[0].blueprint.notes, /Assumed/);
  assert.deepEqual(await getProject(p.id), p);
});

test('prompt: asking again after the one round is refused; duplicate request is cached and not counted', async () => {
  env({ AI_DAILY_PER_EMAIL: '2' });
  const { ai, calls } = stub([{ questions: ['q?'], blueprint: null }, { questions: ['again?'], blueprint: null }]);
  await createFromPrompt(ai, { email: E, prompt: 'A  Bracket!' });
  await createFromPrompt(ai, { email: E, prompt: 'a bracket' }); // same normalised prompt: cache, no call
  assert.equal(calls.length, 1);
  await assert.rejects(createFromPrompt(ai, { email: E, prompt: 'a bracket', answers: 'wide' }), /needs more detail/);
  // third paid call is over the limit of 2
  await assert.rejects(createFromPrompt(ai, { email: E, prompt: 'something else' }), /daily limit/);
});

test('validation failure from the AI is a 422 with the reason and nothing is stored', async () => {
  env();
  const { ai } = stub([{ questions: [], blueprint: { ...bp(), units: 'inch' } }]);
  await assert.rejects(createFromPrompt(ai, { email: E, prompt: 'a bracket', skip: true }), (e: { status: number; message: string }) => e.status === 422 && /units/.test(e.message));
});

test('revise: counts, caps, caches, diff, and 502 on provider failure', async () => {
  env({ AI_REVISIONS_PER_PROJECT: '2' });
  const base = await createFromTemplate({ template: 'spacer-set', cfg: undefined, email: E });
  const { ai, calls } = stub([bp(30), new Error('boom'), bp(40)]);
  const r1 = await revise(ai, base.id, { request: 'make it wider' });
  assert.equal(r1.project.aiRevisions, 1);
  assert.equal(r1.project.current, 2);
  assert.ok(r1.diff.changed.length > 0);
  assert.match(calls[0].user, /Change request: make it wider/);
  await assert.rejects(revise(ai, base.id, { request: 'make it much wider' }), (e: { status: number }) => e.status === 502);
  const dup = await undo(base.id).then(() => revise(ai, base.id, { request: 'Make it   wider!' })); // same blueprint + normalised request
  assert.equal(dup.cached, true);
  assert.equal(dup.project.aiRevisions, 1); // cache hit does not count
  assert.equal(calls.length, 2);
  const r3 = await revise(ai, base.id, { request: 'thicker please' });
  assert.equal(r3.project.aiRevisions, 2);
  await assert.rejects(revise(ai, base.id, { request: 'and again' }), (e: { status: number }) => e.status === 429); // cap of 2
});

test('revise needs an email; mesh projects are scale-only', async () => {
  env();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await assert.rejects(revise(stub([]).ai, p.id, { request: 'wider' }), /email is required/);
});

test('transitions: edit, undo, approve freezes, finalize builds the STL and sidecar, idempotent, read-only', async () => {
  env();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  const m = await manual(p.id, { blueprint: bp(25) });
  assert.equal(m.project.current, 2);
  assert.equal((await undo(p.id)).current, 1);
  await assert.rejects(undo(p.id), /Nothing to undo/);
  await assert.rejects(finalize(p.id), /Approve the design first/);
  await manual(p.id, { blueprint: bp(25) });
  const a = await approve(p.id);
  assert.equal(a.status, 'approved');
  assert.equal(a.approvedRev, 3);
  await assert.rejects(manual(p.id, { blueprint: bp(30) }), (e: { status: number }) => e.status === 409);
  await assert.rejects(undo(p.id), /can no longer be edited/);
  const f = await finalize(p.id);
  assert.equal(f.status, 'finalized');
  assert.equal(f.finalRev, 3);
  const stl = await getBytes('uploads', f.finalFile!);
  assert.ok(stl && stl.length > 84);
  const stats = await getJson<{ volumeCm3: number; sizeMm: { x: number } }>('uploads', `${f.finalFile}.stats.json`);
  assert.ok(stats!.volumeCm3 > 0);
  assert.ok(Math.abs(stats!.sizeMm.x - 25) < 0.01); // built from the approved rev, not the earlier one
  assert.equal((await finalize(p.id)).finalFile, f.finalFile); // idempotent: same file
  await assert.rejects(manual(p.id, { blueprint: bp(30) }), (e: { status: number }) => e.status === 409);
  assert.equal((await orderInfo(p.id)).file, f.finalFile);
  assert.equal((await markOrdered(p.id)).status, 'ordered');
  assert.equal((await finalize(p.id)).status, 'ordered');
});

test('orderInfo refuses a project that is not finalized', async () => {
  env();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await assert.rejects(orderInfo(p.id), /not finalized/);
  await assert.rejects(orderInfo('nope'), /not found/);
});

test('at most 30 revisions', async () => {
  env();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  for (let i = 1; i < MAX_REVISIONS; i++) await manual(p.id, { blueprint: bp(20 + i) });
  assert.equal((await getProject(p.id))!.revisions.length, MAX_REVISIONS);
  await assert.rejects(manual(p.id, { blueprint: bp(60) }), /at most 30 revisions/);
});

test('concurrent manual edits are serialised (no lost revision)', async () => {
  env();
  const p = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await Promise.all([manual(p.id, { blueprint: bp(21) }), manual(p.id, { blueprint: bp(22) }), manual(p.id, { blueprint: bp(23) })]);
  const got = (await getProject(p.id))!;
  assert.deepEqual(got.revisions.map((r) => r.n), [1, 2, 3, 4]);
});

test('mesh project: scale only, finalize scales the upload', async () => {
  env();
  const tris = new Float32Array([0,0,0, 0,10,0, 10,0,0,  0,0,0, 10,0,0, 0,0,10,  0,0,0, 0,0,10, 0,10,0,  10,0,0, 0,10,0, 0,0,10]); // a closed tetrahedron
  const stl = toStl(tris);
  const file = '1700000000000-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.stl';
  await putBytes('uploads', file, stl);
  await putJson('uploads', `${file}.stats.json`, meshStats(tris));
  await assert.rejects(createFromMesh({ file: 'x.obj' }), /STL/);
  await assert.rejects(createFromMesh({ file, origin: 'meshy', env: {} }), /not set up/);
  const p = await createFromMesh({ file });
  await assert.rejects(revise(stub([]).ai, p.id, { email: E, request: 'redraw' }), /only be scaled/);
  await assert.rejects(manual(p.id, { blueprint: bp() }), /longestMm/);
  await assert.rejects(manual(p.id, { longestMm: 5000 }), /does not fit/);
  await manual(p.id, { longestMm: 20 });
  await approve(p.id);
  const f = await finalize(p.id);
  const stats = await getJson<{ sizeMm: { x: number } }>('uploads', `${f.finalFile}.stats.json`);
  assert.ok(Math.abs(stats!.sizeMm.x - 20) < 0.01);
});

test('prune deletes unordered projects older than 30 days (and their STL), keeps ordered and fresh ones', async () => {
  env();
  const old = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await approve(old.id);
  const fin = await finalize(old.id);
  const ord = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  await approve(ord.id); await finalize(ord.id); await markOrdered(ord.id);
  const fresh = await createFromTemplate({ template: 'spacer-set', cfg: undefined });
  for (const id of [old.id, ord.id]) {
    const o = (await getProject(id))!;
    await putJson('designs', `${id}.json`, { ...o, createdAt: new Date(Date.now() - 31 * 86_400_000).toISOString() });
  }
  assert.equal(await pruneProjects(), 1);
  assert.equal(await getProject(old.id), null);
  assert.equal(await getBytes('uploads', fin.finalFile!), null);
  assert.ok(await getProject(ord.id));
  assert.ok(await getProject(fresh.id));
});
