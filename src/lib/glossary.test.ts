import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY } from './glossary.ts';
import { FILL_FACTOR } from './quote.ts';
import { LAYER_MM } from './printSpec.ts';

test('every term has a non-empty definition', () => {
  for (const [k, v] of Object.entries(GLOSSARY)) assert.ok(v.length > 10, k);
});

test('numbers in definitions match the code', () => {
  assert.ok(GLOSSARY['fill-factor'].includes(String(FILL_FACTOR)));
  assert.ok(GLOSSARY['layer-height'].includes(`${LAYER_MM} mm`));
});
