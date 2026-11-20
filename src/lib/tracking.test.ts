import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STATUSES, ORDER_STAGES, ORDER_STATUSES, REQUEST_STAGES, REQUEST_STATUSES, describeStatus, sanitizeStatus } from './tracking.ts';

test('every order and request status maps to a stage in range, or to cancelled', () => {
  for (const [type, table, stages] of [
    ['order', ORDER_STATUSES, ORDER_STAGES],
    ['request', REQUEST_STATUSES, REQUEST_STAGES],
  ] as const) {
    for (const status of Object.keys(table)) {
      const v = describeStatus(type, status);
      assert.ok(v.current >= -1 && v.current < stages.length, `${type} ${status} out of range`);
      assert.equal(v.stages.length, stages.length);
      if (status === 'cancelled') {
        assert.equal(v.current, -1);
        assert.equal(v.cancelled, true);
      } else {
        assert.equal(v.cancelled, false);
        assert.ok(v.current >= 0, `${type} ${status} should have a stage`);
      }
      assert.ok(v.sentence.length > 0);
    }
  }
});

test('known statuses land on the documented stage', () => {
  assert.equal(describeStatus('order', 'printing').current, 4);
  assert.equal(describeStatus('order', 'needs_manual_quote').current, 0);
  assert.equal(describeStatus('request', 'approved').current, 3);
  assert.equal(describeStatus('request', 'quote_sent').current, 2);
  assert.equal(describeStatus('order', 'cancelled').sentence, 'This order was cancelled.');
});

test('ALL_STATUSES lists every status for each type', () => {
  assert.deepEqual(ALL_STATUSES.order, Object.keys(ORDER_STATUSES));
  assert.deepEqual(ALL_STATUSES.request, Object.keys(REQUEST_STATUSES));
  assert.ok(ALL_STATUSES.order.includes('cancelled') && ALL_STATUSES.request.includes('cancelled'));
});

test('an unknown status degrades to the first stage with the status shown', () => {
  assert.deepEqual(describeStatus('order', 'on_a_boat'), {
    stages: ORDER_STAGES,
    current: 0,
    sentence: 'We received it. Status: on_a_boat',
    cancelled: false,
  });
  // a status of another type is unknown here
  assert.equal(describeStatus('request', 'printing').current, 0);
  // prototype keys must not be treated as statuses
  for (const bad of ['constructor', '__proto__', 'toString']) {
    const v = describeStatus('order', bad);
    assert.equal(v.current, 0);
    assert.equal(v.cancelled, false);
  }
  assert.equal(describeStatus('order', undefined as unknown as string).sentence, 'We received it.');
});

test('the status is sanitised before it is shown', () => {
  assert.equal(sanitizeStatus('<img src=x onerror=alert(1)>'), 'img srcx onerroralert1');
  assert.equal(sanitizeStatus('a'.repeat(50)).length, 30);
  assert.equal(sanitizeStatus('ok_status 1'), 'ok_status 1');
  assert.equal(describeStatus('order', '<b>hi</b>').sentence, 'We received it. Status: bhib');
  assert.equal(describeStatus('order', '!!!').sentence, 'We received it.');
});
