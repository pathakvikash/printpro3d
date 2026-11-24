import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_MSGS, NEW_MARK, addMsg, designFields, draftFor, lastDesign, parseHistory, replyMsg, type ChatMsg } from './aiChat.ts';
import { refineText } from './aiDesign.ts';

const shape = (id: string) => ({ id, kind: 'box' as const, mode: 'solid' as const, position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 } });
const user = (id: string, text = 'hi'): ChatMsg => ({ id, role: 'user', text });
const design = (id: string): ChatMsg => ({ id, role: 'assistant', text: 'notes', title: 'T', shapes: [shape(`${id}-a`)] });

test('parseHistory: survives junk, drops malformed messages and bad shapes, strips control chars', () => {
  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory('{nope'), []);
  assert.deepEqual(parseHistory('{"a":1}'), []);
  const raw = JSON.stringify([
    7, null, { role: 'system', id: 'x', text: 'no' }, { role: 'user', text: 'no id' },
    { id: 'u1', role: 'user', text: 'make\u0000 a hook', photo: true },
    { id: 'a1', role: 'assistant', text: 'ok', shapes: [{ ...shape('s'), size: { x: 'big', y: 1, z: 1 } }] },
    { id: 'a2', role: 'assistant', text: 'ok', title: 'Hook', shapes: [shape('s')] },
  ]);
  const h = parseHistory(raw);
  assert.equal(h.length, 3);
  assert.deepEqual(h[0], { id: 'u1', role: 'user', text: 'make a hook', photo: true });
  assert.equal(h[1].shapes, undefined); // invalid shapes dropped, message kept
  assert.equal(h[2].shapes?.length, 1);
});

test('addMsg caps history and parseHistory keeps the newest', () => {
  let h: ChatMsg[] = [];
  for (let i = 0; i < MAX_MSGS + 5; i++) h = addMsg(h, user(`u${i}`));
  assert.equal(h.length, MAX_MSGS);
  assert.equal(h[0].id, 'u5');
  assert.equal(parseHistory(JSON.stringify([...h, ...h])).length, MAX_MSGS);
});

test('lastDesign: the latest design is refined; New resets; errors do not', () => {
  assert.equal(lastDesign([]), null);
  const h = [user('u1'), design('a1'), user('u2'), design('a2'), user('u3'), { id: 'e', role: 'assistant', text: 'failed', error: true } as ChatMsg];
  assert.equal(lastDesign(h)?.id, 'a2');
  const after = addMsg(h, { id: 'n', role: 'assistant', text: NEW_MARK });
  assert.equal(lastDesign(after), null);
  assert.equal(lastDesign(addMsg(after, design('a3')))?.id, 'a3');
});

test('designFields: refine request sends the previous shapes, which the server accepts', () => {
  const prev = [{ ...shape('base'), extra: 'dropped' } as ReturnType<typeof shape>];
  const f = designFields({ email: ' a@b.co ', prompt: '  taller ', refine: prev, trap: '' });
  const m = new Map(f);
  assert.equal(m.get('email'), 'a@b.co');
  assert.equal(m.get('prompt'), 'taller');
  assert.ok(!m.has('website'));
  assert.ok(!m.get('shapes')!.includes('extra'));
  const t = refineText(m.get('shapes'), m.get('prompt')!); // round trip through the server builder
  assert.match(t!, /"id":"base"[\s\S]*Change: taller$/);
  // first turn: no shapes; honeypot passes through so the server can drop it
  const first = new Map(designFields({ email: 'a@b.co', prompt: 'x'.repeat(700), trap: 'bot' }));
  assert.ok(!first.has('shapes'));
  assert.equal(first.get('prompt')!.length, 600);
  assert.equal(first.get('website'), 'bot');
});

test('replyMsg: design, server error text, generic fallback', () => {
  const ok = replyMsg('r', true, { title: 'Hook', notes: 'A hook.', shapes: [shape('a')] }, 'gen');
  assert.equal(ok.title, 'Hook');
  assert.equal(ok.shapes?.length, 1);
  assert.equal(ok.error, undefined);
  assert.deepEqual(replyMsg('r', false, { error: 'Daily limit' }, 'gen'), { id: 'r', role: 'assistant', error: true, text: 'Daily limit' });
  assert.equal(replyMsg('r', true, { shapes: [] }, 'gen').text, 'gen');
  assert.equal(replyMsg('r', true, null, 'gen').error, true);
  assert.deepEqual(JSON.parse(draftFor(ok, true)), { title: 'Hook', notes: 'A hook.', shapes: [shape('a')], source: 'photo' });
});

test('the chat stays out of first loads: launcher imports it only through next/dynamic, header imports only the launcher', () => {
  const launcher = readFileSync(new URL('../components/AiChatLauncher.tsx', import.meta.url), 'utf8');
  assert.match(launcher, /dynamic\(\(\) => import\('\.\/AiChat'\)/);
  assert.doesNotMatch(launcher, /^import[^;]*from\s+'\.\/AiChat'/m);
  const chat = readFileSync(new URL('../components/AiChat.tsx', import.meta.url), 'utf8');
  for (const heavy of ['./ExamplePreview', './AiGenerate', 'three', '@/lib/playground', '@/lib/aiDesign']) assert.doesNotMatch(chat, new RegExp(`^import[^;]*from\\s+'${heavy.replace(/[./]/g, '\\$&')}'`, 'm'), heavy);
});
