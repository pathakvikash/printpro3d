import test from 'node:test';
import assert from 'node:assert/strict';
import { INDIAN_STATES, parseShipping, shippingError } from './shipping.ts';

test('valid state + PIN', () => {
  assert.equal(shippingError('Bihar', '800001'), null);
  assert.deepEqual(parseShipping((k) => ({ state: 'Delhi', pin: '110 001' })[k]), { country: 'India', state: 'Delhi', pin: '110001' });
});

test('bad PIN is refused with a friendly message', () => {
  for (const pin of ['', '80001', '8000011', '012345', '80000a', 800001, null]) assert.match(shippingError('Bihar', pin) ?? '', /6-digit/);
});

test('state must come from the Indian list', () => {
  for (const s of ['', 'California', 'bihar', undefined, 5]) assert.match(shippingError(s, '800001') ?? '', /state/);
  assert.equal(INDIAN_STATES.length, 36);
  assert.throws(() => parseShipping(() => undefined), /state/);
});
