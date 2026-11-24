import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAiShapes, cloneShapes, customLabel, parseConfigReply, proposeConfig, type Ai } from './aiCustomise.ts';
import { parseModelReply, refineText } from './aiDesign.ts';
import { aiHref } from './cardActions.ts';
import { EXAMPLES } from './examples.ts';
import { NO_PARTS, redoHistory, undoHistory, type History } from './flight/layout.ts';
import { defaultCfg, normalizeCfg, TEMPLATES } from './templateDefs.ts';

const t = TEMPLATES.find((x) => x.fields.some((f) => f.type === 'range') && x.fields.some((f) => f.type === 'select'))!;
const range = t.fields.find((f) => f.type === 'range')!;
const sel = t.fields.find((f) => f.type === 'select')!;
const cur = defaultCfg(t);
const check = (c: Record<string, number | string | boolean>) => normalizeCfg(t, c, true);
const reply = (changes: { key: string; value: string }[], extra = {}) => JSON.stringify({ changes, notes: 'ok', needsGeometry: false, ...extra });
const parse = (text: string) => parseConfigReply(t.fields, cur, text, check);
const other = range.type === 'range' ? (range.default === range.max ? range.min : range.max) : 0;

test('config proposal: a valid change is accepted and diffed', () => {
  const r = parse(`\`\`\`json\n${reply([{ key: range.key, value: String(other) }])}\n\`\`\``);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.cfg[range.key], other); assert.equal(r.changes.length, 1); assert.equal(r.changes[0].key, range.key); }
});

test('config proposal: invalid proposals are rejected whole', () => {
  assert.equal(parse('not json').ok, false);
  assert.equal(parse(reply([])).ok, false); // no change
  assert.equal(parse(reply([{ key: 'nope', value: '1' }])).ok, false); // unknown key
  if (range.type === 'range') {
    assert.equal(parse(reply([{ key: range.key, value: String(range.max + 1) }])).ok, false); // out of range, never clamped
    assert.equal(parse(reply([{ key: range.key, value: 'abc' }])).ok, false);
    assert.equal(parse(reply([{ key: range.key, value: '' }])).ok, false);
  }
  assert.equal(parse(reply([{ key: sel.key, value: 'not-an-option' }])).ok, false);
  assert.equal(parse(reply([{ key: range.key, value: String(other) }, { key: range.key, value: String(other) }])).ok, false); // duplicate key
  assert.equal(parseConfigReply(t.fields, cur, reply([{ key: range.key, value: String(other) }]), () => { throw new Error('cannot build'); }).ok, false); // strict validator throws
});

test('config proposal: needsGeometry with no change is ok and flagged', () => {
  const r = parse(reply([], { needsGeometry: true }));
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.geometry, true); assert.equal(r.changes.length, 0); }
});

test('proposeConfig with a mock provider, and a failing provider throws', async () => {
  const ai: Ai = async (system, user) => { assert.match(user, /Change: wider/); assert.match(system, /ONE JSON object/); return reply([{ key: range.key, value: String(other) }]); };
  const r = await proposeConfig(ai, { name: t.name, fields: t.fields, current: cur, change: 'wider', check });
  assert.ok(r.ok);
  await assert.rejects(proposeConfig(async () => { throw new Error('down'); }, { name: t.name, fields: t.fields, current: cur, change: 'x', check }));
});

test('copy never mutates catalog data', () => {
  const before = JSON.stringify(EXAMPLES);
  const copy = cloneShapes(EXAMPLES[0].shapes);
  copy[0].size.z += 50; copy[0].position.x = 99; copy.pop();
  assert.equal(JSON.stringify(EXAMPLES), before);
  const cfgBefore = JSON.stringify(cur);
  check({ ...cur, [range.key]: other });
  assert.equal(JSON.stringify(cur), cfgBefore);
  assert.equal(customLabel('Phone stand'), 'Phone stand (custom)');
  assert.equal(customLabel('Phone stand (custom)'), 'Phone stand (custom)');
  assert.equal(aiHref('phone-stand'), '/playground?mode=build&example=phone-stand&ai=1');
});

test('sidebar flow with a mock provider: apply is one undoable step, discard changes nothing, junk is refused', () => {
  const base = cloneShapes(EXAMPLES[0].shapes);
  const h: History = { past: [], future: [], now: { shapes: base, parts: NO_PARTS } };
  assert.ok(refineText(JSON.stringify(base), 'make it 10 mm taller'));
  const mock = JSON.stringify({ title: 'Taller', notes: '10 mm taller', shapes: base.map((s, i) => (i ? s : { ...s, size: { ...s.size, z: s.size.z + 10 } })) });
  const d = parseModelReply(mock);
  assert.ok(d.ok);
  if (!d.ok) return;
  const next = applyAiShapes(h, d.shapes, 1000)!;
  assert.equal(next.past.length, 1);
  assert.equal(next.now.shapes[0].size.z, base[0].size.z + 10);
  assert.equal(undoHistory(next).now.shapes[0].size.z, base[0].size.z); // undo restores
  assert.equal(redoHistory(undoHistory(next)).now.shapes[0].size.z, base[0].size.z + 10);
  assert.equal(h.now.shapes[0].size.z, base[0].size.z); // discard = never applied: history untouched
  assert.equal(applyAiShapes(h, [{ kind: 'box' }]), null);
  assert.equal(applyAiShapes(h, []), null);
  assert.equal(applyAiShapes(h, 'x'), null);
});
