import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canRead, guestFromRequest, ownerFor, recordOwner, OWNERS, type AccessDeps, type Owner } from './fileAccess.ts';
import { finalizeUpload } from './uploads.ts';
import { createFromMesh } from './designProjects.ts';
import { ownsFile } from './orreryServer.ts';
import { getJson } from './store.ts';

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';
const req = (h: Record<string, string> = {}) => new Request('http://x/api/upload/a.stl', { headers: h });
const mk = (o: Partial<Omit<AccessDeps, "owner">> & { owner?: Owner | null }): AccessDeps => ({
  admin: async () => false,
  user: async () => null,
  bearer: () => null,
  jobOf: async () => null,
  linked: async () => false,
  ...o,
  owner: async () => (o.owner === undefined ? { sub: 's1', email: 'a@x.com', guest: G1 } : o.owner),
});

test('route calls canRead', () => {
  assert.match(readFileSync(new URL('../app/api/upload/[name]/route.ts', import.meta.url), 'utf8'), /canRead\(/);
});
test('stranger denied', async () => assert.equal(await canRead(req(), 'a.stl', mk({})), false));
test('guest cookie match allowed, mismatch denied', async () => {
  assert.equal(await canRead(req({ cookie: `pp3d_guest=${G1}` }), 'a.stl', mk({})), true);
  assert.equal(await canRead(req({ cookie: `pp3d_guest=${G2}` }), 'a.stl', mk({})), false);
});
test('session owner allowed, other user denied', async () => {
  assert.equal(await canRead(req(), 'a.stl', mk({ user: async () => ({ sub: 's1', email: 'z@x.com' }) })), true);
  assert.equal(await canRead(req(), 'a.stl', mk({ user: async () => ({ sub: 's2', email: 'z@x.com' }) })), false);
});
test('admin allowed', async () => assert.equal(await canRead(req(), 'a.stl', mk({ admin: async () => true, owner: null })), true));
test('valid Orrery bearer owning via job allowed', async () => {
  const d = mk({ bearer: () => ({ sub: 'o@x.com' }), jobOf: async () => ({ email: 'typed@x.com', owner: { email: 'o@x.com' } }) });
  assert.equal(await canRead(req({ authorization: 'Bearer t' }), 'a.stl', d), true);
});
test('invalid bearer denied even with a matching guest cookie', async () => {
  const d = mk({ bearer: () => new Response('no', { status: 401 }) });
  assert.equal(await canRead(req({ authorization: 'Bearer t', cookie: `pp3d_guest=${G1}` }), 'a.stl', d), false);
});
test('no owner record: only admin', async () => {
  assert.equal(await canRead(req({ cookie: `pp3d_guest=${G1}` }), 'a.stl', mk({ owner: null })), false);
  assert.equal(await canRead(req(), 'a.stl', mk({ owner: null, user: async () => ({ sub: 's1', email: 'a@x.com' }) })), false);
});
test('ownerFor: guest has no email; cookie minted once; session email only from session', async () => {
  const a = await ownerFor(req(), async () => null);
  assert.equal(a.owner.email, undefined);
  assert.ok(a.setCookie?.includes('HttpOnly') && a.setCookie.includes(a.owner.guest!));
  const b = await ownerFor(req({ cookie: `pp3d_guest=${G1}` }), async () => ({ sub: 's', email: 'a@x.com', name: '' }));
  assert.deepEqual(b.owner, { sub: 's', email: 'a@x.com', guest: G1 });
  assert.equal(b.setCookie, undefined);
  assert.equal(guestFromRequest(req({ cookie: 'pp3d_guest=bad' })), null);
});

test('bearer matches via owner.email without a job lookup', async () => {
  const d = mk({ owner: { email: 'o@x.com' }, bearer: () => ({ sub: 'o@x.com' }), jobOf: async () => { throw new Error('scanned'); } });
  assert.equal(await canRead(req({ authorization: 'Bearer t' }), 'a.stl', d), true);
});
test('session owner.email path', async () => {
  const d = mk({ owner: { email: 'a@x.com' }, user: async () => ({ sub: 'other', email: 'a@x.com' }) });
  assert.equal(await canRead(req(), 'a.stl', d), true);
});
test('typed job email grants nothing: job.owner differs', async () => {
  const d = mk({ owner: null, user: async () => ({ sub: 's9', email: 'typed@x.com' }), jobOf: async () => ({ email: 'typed@x.com', owner: { sub: 'victim', email: 'v@x.com' } }) });
  assert.equal(await canRead(req(), 'a.stl', d), false);
  const legacy = mk({ owner: null, user: async () => ({ sub: 's9', email: 'typed@x.com' }), jobOf: async () => ({ email: 'typed@x.com' }) });
  assert.equal(await canRead(req(), 'a.stl', legacy), false);
  const own = mk({ owner: null, user: async () => ({ sub: 's9', email: 'v@x.com' }), jobOf: async () => ({ email: 'typed@x.com', owner: { email: 'v@x.com' } }) });
  assert.equal(await canRead(req(), 'a.stl', own), true);
});
test('guest match and non-stl skip the job scan', async () => {
  const boom = async () => { throw new Error('scanned'); };
  assert.equal(await canRead(req({ cookie: `pp3d_guest=${G1}` }), 'a.stl', mk({ jobOf: boom })), true);
  assert.equal(await canRead(req(), 'a.png', mk({ jobOf: boom, user: async () => ({ sub: 'z', email: 'z@x.com' }) })), false);
});
test('guest cookie attributes', async () => {
  const prev = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    const c = (await ownerFor(req(), async () => null)).setCookie!;
    for (const a of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Secure', 'Max-Age=31536000']) assert.ok(c.includes(a), a);
    (process.env as Record<string, string>).NODE_ENV = 'development';
    assert.ok(!(await ownerFor(req(), async () => null)).setCookie!.includes('Secure'));
  } finally {
    (process.env as Record<string, string>).NODE_ENV = prev;
  }
});
test('recordOwner never overwrites; finalize refuses a claimed name', async () => {
  const name = `${Date.now()}-${crypto.randomUUID()}.stl`;
  try {
    assert.equal(await recordOwner(name, { guest: G1 }), true);
    assert.equal(await recordOwner(name, { guest: G2 }), false);
    assert.deepEqual(await getJson(OWNERS, `${name}.json`), { guest: G1 });
    const r = await finalizeUpload(name, 'x.stl', {
      read: async () => { throw new Error('read'); }, exists: async () => false, remove: async () => {}, finish: async () => { throw new Error('finish'); },
      claimed: async () => true,
    });
    assert.equal(r.status, 409);
    assert.deepEqual(await getJson(OWNERS, `${name}.json`), { guest: G1 });
  } finally {
    const { del } = await import('./store.ts');
    await del(OWNERS, `${name}.json`).catch(() => {});
  }
});
test('design mesh project refuses an unreadable file; route passes canRead', async () => {
  await assert.rejects(createFromMesh({ file: 'victim.stl', readable: async () => false }), /File not found/);
  assert.match(readFileSync(new URL('../app/api/designs/route.ts', import.meta.url), 'utf8'), /readable: \(f\) => canRead\(request, f\)/);
});

test('Orrery ownsFile (/api/orrery/file, preselect): verified owner only, never the typed job email', async () => {
  const job = mk({ owner: null, jobOf: async () => ({ email: 'typed@x.com', owner: { email: 'o@x.com' } }) });
  assert.equal(await ownsFile('o@x.com', 'a.stl', job), true);
  assert.equal(await ownsFile('typed@x.com', 'a.stl', job), false);
  assert.equal(await ownsFile('typed@x.com', 'a.stl', mk({ owner: null, jobOf: async () => ({ email: 'typed@x.com' }) })), false); // job with no verified owner
  assert.equal(await ownsFile('o@x.com', 'a.stl', mk({ owner: { email: 'o@x.com' } })), true); // create-only owner record
  assert.equal(await ownsFile('x@x.com', 'a.stl', mk({ owner: { email: 'o@x.com' } })), false);
});
test('preselectFile matches the job by verified owner, not job.email', () => {
  const src = readFileSync(new URL('./orreryServer.ts', import.meta.url), 'utf8');
  assert.match(src, /jobMatches\(j, \{ email: who \}\)/);
  assert.doesNotMatch(src, /j\.email\.trim\(\)/);
});

test('legacy file (no owner record): a verified order/request link of the signed-in user grants read; nothing else does', async () => {
  const linked = async (sub: string, f: string) => sub === 's1' && f === 'a.stl';
  assert.equal(await canRead(req(), 'a.stl', mk({ owner: null, linked, user: async () => ({ sub: 's1', email: 'a@x.com' }) })), true);
  assert.equal(await canRead(req(), 'a.stl', mk({ owner: null, linked, user: async () => ({ sub: 's2', email: 'a@x.com' }) })), false);
  assert.equal(await canRead(req(), 'a.stl', mk({ owner: null, linked })), false); // signed out
  // a file that has an owner record never falls back to order links
  assert.equal(await canRead(req(), 'a.stl', mk({ owner: { guest: G2 }, linked, user: async () => ({ sub: 's1', email: 'a@x.com' }) })), false);
});
