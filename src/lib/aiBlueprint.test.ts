import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_QUESTIONS, buildChatRequest, compactBlueprint, designModel, parseBlueprintReply, parsePlanReply, reviseUser } from './aiBlueprint.ts';
import { shapesToBlueprint } from './designBlueprint.ts';

const shape = (id: string) => ({ id, kind: 'box' as const, mode: 'solid' as const, position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 } });
const bp = shapesToBlueprint([shape('a')], 'Cube', 'Assumed 10 mm.');

test('model tier: mid by default, env tier and exact model override, other providers use AI_MODEL', () => {
  assert.equal(designModel('anthropic', {}), 'claude-sonnet-5-5');
  assert.equal(designModel('anthropic', { AI_DESIGN_TIER: 'high' }), 'claude-opus-5-5');
  assert.equal(designModel('anthropic', { AI_DESIGN_TIER: 'low', AI_MODEL: 'x' }), 'claude-haiku-5-5');
  assert.equal(designModel('anthropic', { AI_DESIGN_TIER: 'bogus' }), 'claude-sonnet-5-5');
  assert.equal(designModel('anthropic', { AI_DESIGN_MODEL: 'exact', AI_DESIGN_TIER: 'low' }), 'exact');
  assert.equal(designModel('openai', { AI_MODEL: 'q' }), 'q');
  assert.equal(designModel('openai', {}), null);
});

test('request: 8000 max tokens, schema on Anthropic, no temperature', () => {
  const r = buildChatRequest('anthropic', { system: 's', user: 'u', schema: { type: 'object' } }, { model: 'm', apiKey: 'k', baseUrl: '' });
  const b = r.body as Record<string, unknown>;
  assert.equal(b.max_tokens, 8000);
  assert.ok(b.output_config && !('temperature' in b));
});

test('plan reply: questions are capped at 3 and trimmed; a blueprint wins; bad blueprint is a reason, junk throws', () => {
  const q = parsePlanReply(JSON.stringify({ questions: ['a?', 'b?', 'c?', 'd?', ' '], blueprint: null }));
  assert.deepEqual(q, { kind: 'questions', questions: ['a?', 'b?', 'c?'] });
  assert.equal(q.kind === 'questions' && q.questions.length <= MAX_QUESTIONS, true);
  const p = parsePlanReply(`\`\`\`json\n${JSON.stringify({ questions: [], blueprint: bp })}\n\`\`\``);
  assert.ok(p.kind === 'plan' && p.result.ok);
  const bad = parsePlanReply(JSON.stringify({ questions: [], blueprint: { ...bp, extra: 1 } }));
  assert.ok(bad.kind === 'plan' && !bad.result.ok);
  assert.throws(() => parsePlanReply('no json here'), /not a blueprint/);
});

test('revise reply is a full blueprint document and keeps shape ids', () => {
  const r = parseBlueprintReply(JSON.stringify(bp));
  assert.ok(r.ok && r.blueprint.parts[0].shapes[0].id === 'a');
  assert.equal(parseBlueprintReply(JSON.stringify({ ...bp, units: 'in' })).ok, false);
});

test('inputs are capped: 3 KB blueprint, 300 character request', () => {
  assert.ok(compactBlueprint(bp));
  const big = shapesToBlueprint(Array.from({ length: 20 }, (_, i) => shape(`shape-number-${i}`)), 'x'.repeat(60), 'y'.repeat(300));
  assert.equal(compactBlueprint(big), null);
  assert.equal(reviseUser('{}', 'z'.repeat(1000)), reviseUser('{}', 'z'.repeat(300))); // the request is cut at 300; the fixed prefix is ~40 chars
});
