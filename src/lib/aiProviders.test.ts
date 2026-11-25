import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliArgs, parseCliOutput } from './aiProviders.ts';

const env = { AI_ALLOW_CLI: '1' } as never;
const toolsOf = (a: string[]) => a[a.indexOf('--tools') + 1];

test('text request: no tools, no stdin', () => {
  const { args, stdin } = cliArgs({ text: 'a hinge' }, env);
  assert.equal(toolsOf(args), '');
  assert.ok(!args.includes('Read'));
  assert.equal(stdin, undefined);
  assert.ok(!args.includes('stream-json'));
});

test('photo request: inline base64 over stream-json stdin, no tools, no Read', () => {
  const { args, stdin } = cliArgs({ text: 'copy', image: { mime: 'image/png', base64: 'AAAA' } }, env);
  assert.equal(toolsOf(args), '');
  assert.ok(!args.join(' ').includes('Read'));
  assert.ok(args.includes('--input-format') && args.includes('--verbose'));
  const m = JSON.parse(stdin!);
  assert.equal(m.message.content[0].source.data, 'AAAA');
  assert.equal(m.message.content[0].source.media_type, 'image/png');
});

test('parseCliOutput takes the final result event', () => {
  assert.equal(parseCliOutput('{"type":"system"}\n{"type":"result","result":"hi","is_error":false}\n'), 'hi');
  assert.equal(parseCliOutput('{"type":"result","result":"x"}'), 'x');
  assert.throws(() => parseCliOutput('{"type":"result","is_error":true,"result":"x"}'));
  assert.throws(() => parseCliOutput('nope'));
});
