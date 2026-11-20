import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContact } from './contact.ts';
import { isImage } from './image.ts';

const ok = { name: ' Asha ', email: 'a@b.co', phone: '123', address: '1 Main St', notes: '' };
const get = (o: Record<string, unknown>) => (k: string) => o[k];

test('parseContact trims and returns fields', () => {
  assert.equal(parseContact(get(ok)).name, 'Asha');
});

test('parseContact rejects bad input', () => {
  assert.throws(() => parseContact(get({ ...ok, email: 'nope' })), /email/);
  assert.throws(() => parseContact(get({ ...ok, name: '  ' })), /name/);
  assert.throws(() => parseContact(get({ ...ok, phone: 'x'.repeat(31) })), /phone/);
  assert.throws(() => parseContact(get({ ...ok, name: 5 })), /name/);
});

test('single-line fields lose newlines, address keeps them', () => {
  const c = parseContact(get({ ...ok, name: 'A\nEmail: x@evil.co', phone: '1\r\n2', address: 'l1\nl2' }));
  assert.equal(c.name, 'A Email: x@evil.co');
  assert.equal(c.phone, '1 2');
  assert.equal(c.address, 'l1\nl2');
});

test('address optional only when the caller says so', () => {
  const noAddr = { ...ok, address: '' };
  assert.throws(() => parseContact(get(noAddr)), /address/);
  assert.equal(parseContact(get(noAddr), { addressRequired: false }).address, '');
});

test('isImage checks magic bytes against the extension', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.ok(isImage(png, '.png') && isImage(jpg, '.jpg') && isImage(jpg, '.jpeg') && isImage(webp, '.webp'));
  assert.ok(!isImage(png, '.jpg') && !isImage(jpg, '.png') && !isImage(webp, '.png'));
  assert.ok(!isImage(new TextEncoder().encode('<svg xmlns='), '.png'));
  assert.ok(!isImage(png, '.svg'));
});

test('isImage rejects near-miss signatures', () => {
  const b = (...x: number[]) => Uint8Array.from(x);
  const riff = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0];
  assert.ok(!isImage(b(...riff, 0x57, 0x41, 0x56, 0x45), '.webp')); // RIFF....WAVE
  assert.ok(!isImage(b(0x89, 0x50, 0x4e, 0x47), '.png')); // truncated PNG header
  assert.ok(!isImage(b(0xff, 0xd8, 0x00), '.jpg'));
});
