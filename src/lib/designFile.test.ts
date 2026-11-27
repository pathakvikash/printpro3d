import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designFileProblem, MAX_DESIGN } from './designFile.ts';

const b = (s: string) => new TextEncoder().encode(s);

test('designFileProblem checks extension and content', () => {
  assert.equal(designFileProblem('a.svg', b('<?xml version="1.0"?><svg xmlns="x"></svg>')), null);
  assert.equal(designFileProblem('A.PDF', b('%PDF-1.7\n...')), null);
  assert.equal(designFileProblem('a.dxf', b('0\nSECTION\n2\nHEADER\n')), null);
  assert.equal(designFileProblem('a.svg', b('\uFEFF\n<!-- x -->\n<svg></svg>')), null);
  assert.ok(designFileProblem('a.svg', b('hello')));
  assert.ok(designFileProblem('a.svg', b('x'.repeat(1100) + '<svg></svg>')));
  assert.ok(designFileProblem('a.svg', b('<svg><script>alert(1)</script></svg>')));
  assert.ok(designFileProblem('a.svg', b('<svg></svg><HTML>')));
  assert.ok(designFileProblem('a.svg', b('<div><svg></svg></div>')));
  assert.ok(designFileProblem('a.svg', new Uint8Array([60, 0, 115, 118, 103])));
  assert.ok(designFileProblem('a.pdf', b('<svg></svg>')));
  assert.ok(designFileProblem('a.dxf', b('x'.repeat(3000) + 'SECTION')));
  assert.ok(designFileProblem('a.dxf', new Uint8Array([0, 83, 69, 67, 84, 73, 79, 78])));
  assert.ok(designFileProblem('a.png', b('<svg>')));
  assert.ok(designFileProblem('a.svg', new Uint8Array(0)));
  assert.ok(designFileProblem('a.pdf', new Uint8Array(MAX_DESIGN + 1).fill(37)));
});
