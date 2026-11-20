import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkLimit, checkPrompt, takeUsage } from './aiGuard.ts';

test('allowed prompts pass, trimmed and collapsed', () => {
  const r = checkPrompt('  A small   dragon\nsitting on a rock ');
  assert.deepEqual(r, { ok: true, prompt: 'A small dragon sitting on a rock' });
  for (const p of ['magazine rack for my desk', 'a kitchen knife block', 'hot glue gun holder', 'radio receiver stand', 'Bluetooth speaker stand', 'gunmetal grey vase']) {
    assert.equal(checkPrompt(p).ok, true, p);
  }
});

test('length bounds', () => {
  assert.equal(checkPrompt('ab').ok, false);
  assert.equal(checkPrompt('   ').ok, false);
  assert.equal(checkPrompt(undefined).ok, false);
  assert.equal(checkPrompt('x'.repeat(401)).ok, false);
  assert.equal(checkPrompt('x'.repeat(400)).ok, true);
});

test('weapon terms are rejected, case-insensitively, with a reason', () => {
  for (const p of ['A GUN', 'pistol grip', 'AR-15 lower receiver', 'a rifle stand? no, a rifle', 'phone silencer', 'suppressor for a barrel', 'glock magazine well', 'a grenade', 'tactical knife with serrated blade', 'a butterfly knife', 'brass knuckles', 'firearm']) {
    const r = checkPrompt(p);
    assert.equal(r.ok, false, p);
    if (!r.ok) assert.match(r.reason, /weapon/);
  }
});

test('protected characters and brands are rejected', () => {
  for (const p of ['Mickey Mouse figurine', 'spider-man bust', 'a Pikachu', 'Hello Kitty keychain', 'nike swoosh logo']) {
    const r = checkPrompt(p);
    assert.equal(r.ok, false, p);
    if (!r.ok) assert.match(r.reason, /brands/);
  }
});

test('word boundaries: substrings do not trigger', () => {
  for (const p of ['a burgundy vase', 'a begun project box', 'marionette puppet', 'thorough cable guide', 'a legolas elf']) assert.equal(checkPrompt(p).ok, true, p);
});

// ledgers live in $DATA_DIR/ai-usage, so each test gets its own temp DATA_DIR
const tmpData = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-usage-'));
  process.env.DATA_DIR = dir;
  return path.join(dir, 'ai-usage');
};

test('ledger enforces per-email and global limits, emails normalised', async () => {
  tmpData();
  const now = new Date('2026-11-20T10:00:00Z');
  process.env.AI_DAILY_PER_EMAIL = '2';
  process.env.AI_DAILY_TOTAL = '3';
  assert.deepEqual(await checkLimit('a@b.co', now), { ok: true });
  assert.deepEqual(await takeUsage(' A@B.co ', now), { ok: true });
  assert.deepEqual(await takeUsage('a@b.CO', now), { ok: true });
  assert.deepEqual(await takeUsage('a@b.co', now), { ok: false, scope: 'email', limit: 2 }); // refused, not counted
  assert.deepEqual(await checkLimit('c@d.co', now), { ok: true });
  assert.deepEqual(await takeUsage('c@d.co', now), { ok: true });
  assert.deepEqual(await checkLimit('e@f.co', now), { ok: false, scope: 'total', limit: 3 });
  // a new UTC day starts clean
  assert.deepEqual(await checkLimit('a@b.co', new Date('2026-11-21T00:00:01Z')), { ok: true });
  delete process.env.AI_DAILY_PER_EMAIL;
  delete process.env.AI_DAILY_TOTAL;
  assert.deepEqual(await checkLimit('x@y.co', now), { ok: true }); // defaults 3 / 40
});

// Shaped like the generate route: one atomic check-and-count, then the slow Meshy call.
const handle = async (now: Date, email: string) => {
  const l = await takeUsage(email, now);
  await new Promise((r) => setTimeout(r, 5));
  return l;
};

test('concurrent calls: 4th call for one email and 41st overall are blocked', async () => {
  tmpData();
  const now = new Date('2026-11-20T12:00:00Z');
  process.env.AI_DAILY_PER_EMAIL = '3';
  process.env.AI_DAILY_TOTAL = '40';
  const one = await Promise.all(Array.from({ length: 5 }, () => handle(now, 'same@b.co')));
  assert.equal(one.filter((r) => r.ok).length, 3);
  const many = await Promise.all(Array.from({ length: 45 }, (_, i) => handle(now, `u${i}@b.co`)));
  assert.equal(many.filter((r) => r.ok).length, 37); // 40 total, 3 already used by the first email
  assert.deepEqual(await checkLimit('new@b.co', now), { ok: false, scope: 'total', limit: 40 });
  delete process.env.AI_DAILY_PER_EMAIL;
  delete process.env.AI_DAILY_TOTAL;
});

test('design and generate ledgers are separate files and count separately', async () => {
  const dir = tmpData();
  const now = new Date('2026-11-20T09:00:00Z');
  process.env.AI_DAILY_PER_EMAIL = '1';
  await takeUsage('a@b.co', now, 'design');
  assert.deepEqual(await checkLimit('a@b.co', now, 'design'), { ok: false, scope: 'email', limit: 1 });
  assert.deepEqual(await checkLimit('a@b.co', now), { ok: true }); // generate ledger untouched
  await takeUsage('a@b.co', now);
  assert.deepEqual(await checkLimit('a@b.co', now), { ok: false, scope: 'email', limit: 1 });
  assert.deepEqual(readdirSync(dir).sort(), ['2026-11-20.json', 'design-2026-11-20.json']);
  delete process.env.AI_DAILY_PER_EMAIL;
});
