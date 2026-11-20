// =============================================================================
// Unit tests for the status rules (no database needed).
// Run:  npm run test:unit
// Uses Node's built-in test runner (node:test), so no extra packages.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActorRole,
  BookingAction,
  BookingStatus,
  getAllowedActions,
  resolveTransition,
} from '../src/domain/bookingStatus.js';

const { PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED } = BookingStatus;
const { DRIVER, PASSENGER } = ActorRole;
const { ACCEPT, REJECT, CANCEL, COMPLETE } = BookingAction;

test('driver can accept / reject a PENDING booking', () => {
  assert.equal(resolveTransition(ACCEPT, DRIVER, PENDING), CONFIRMED);
  assert.equal(resolveTransition(REJECT, DRIVER, PENDING), REJECTED);
});

test('driver can complete or cancel a CONFIRMED booking', () => {
  assert.equal(resolveTransition(COMPLETE, DRIVER, CONFIRMED), COMPLETED);
  assert.equal(resolveTransition(CANCEL, DRIVER, CONFIRMED), CANCELLED);
});

test('passenger can cancel PENDING and CONFIRMED bookings', () => {
  assert.equal(resolveTransition(CANCEL, PASSENGER, PENDING), CANCELLED);
  assert.equal(resolveTransition(CANCEL, PASSENGER, CONFIRMED), CANCELLED);
});

test('passenger can never accept, reject or complete (403)', () => {
  for (const action of [ACCEPT, REJECT, COMPLETE]) {
    assert.throws(() => resolveTransition(action, PASSENGER, PENDING), { status: 403 });
  }
});

test('driver must reject (not cancel) a PENDING request (409)', () => {
  assert.throws(() => resolveTransition(CANCEL, DRIVER, PENDING), { status: 409 });
});

test('cannot accept twice or accept a cancelled booking (409)', () => {
  assert.throws(() => resolveTransition(ACCEPT, DRIVER, CONFIRMED), { status: 409 });
  assert.throws(() => resolveTransition(ACCEPT, DRIVER, CANCELLED), { status: 409 });
});

test('cannot complete a booking that was never confirmed (409)', () => {
  assert.throws(() => resolveTransition(COMPLETE, DRIVER, PENDING), { status: 409 });
});

test('final statuses allow no actions for anyone', () => {
  for (const status of [REJECTED, CANCELLED, COMPLETED]) {
    for (const role of [DRIVER, PASSENGER]) {
      assert.deepEqual(getAllowedActions(role, status), []);
      for (const action of [ACCEPT, REJECT, CANCEL, COMPLETE]) {
        assert.throws(() => resolveTransition(action, role, status));
      }
    }
  }
});

test('getAllowedActions tells the app which buttons to show', () => {
  assert.deepEqual(getAllowedActions(DRIVER, PENDING), [ACCEPT, REJECT]);
  assert.deepEqual(getAllowedActions(DRIVER, CONFIRMED), [CANCEL, COMPLETE]);
  assert.deepEqual(getAllowedActions(PASSENGER, PENDING), [CANCEL]);
});
