// =============================================================================
// Integration test: real HTTP requests -> real PostgreSQL.
//
// Needs: PostgreSQL running with migrations 001-004 applied, and a .env with
// DATABASE_URL. RabbitMQ is NOT needed (events just log a warning).
// RIDE_SERVICE_URL must be empty so the DEV driver / seat values are used.
//
// Run:  npm run test:integration
//
// WARNING: this test deletes rows for its own fake ride ids only
// ('test-ride-...'), it does not touch your other data.
// =============================================================================

import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.RIDE_SERVICE_URL = ''; // force dev mode
process.env.DEV_DRIVER_ID = 'test-driver';
process.env.DEV_RIDE_TOTAL_SEATS = '3';

const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');

const RIDE = `test-ride-${Date.now()}`;
const DRIVER = { 'x-driver-id': 'test-driver' };
let server;
let baseUrl;

// Small helper around fetch that returns { status, body }.
async function call(method, path, headers = {}, body) {
  const res = await fetch(`${baseUrl}/api/v1/bookings${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

// A valid create-booking body (same shape as teammate's validator).
function bookingBody(seats = 1) {
  const point = (name, lat, lng) => ({ name, latitude: lat, longitude: lng });
  return {
    rideId: RIDE,
    requestedSeats: seats,
    note: 'Near the main gate',
    passengerJourney: {
      origin: point('Moratuwa', 6.7951, 79.9009),
      destination: point('Colombo Fort', 6.9344, 79.8428),
    },
    matchedJourney: {
      matchId: 'match-1',
      pickupMode: 'WALK_TO_ROUTE',
      dropoffMode: 'DRIVER_DETOUR',
      pickupPoint: point('Katubedda Junction', 6.7969, 79.8885),
      dropoffPoint: point('Fort Station', 6.9339, 79.8500),
      pickupWalkDistanceM: 250,
      extraDistanceM: 1200,
      extraDurationSeconds: 300,
    },
  };
}

const createAs = (passengerId, seats) =>
  call('POST', '/', { 'x-passenger-id': passengerId }, bookingBody(seats));

before(async () => {
  server = app.listen(0); // port 0 = any free port
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await pool.query(
    `DELETE FROM booking_status_history WHERE booking_id IN
       (SELECT booking_id FROM bookings WHERE ride_id = $1)`,
    [RIDE],
  );
  await pool.query('DELETE FROM bookings WHERE ride_id = $1', [RIDE]);
  server.close();
  await pool.end();
});

test('full driver flow: list -> details -> accept -> complete', async () => {
  const created = await createAs('p-alice', 1);
  assert.equal(created.status, 201);
  const id = created.body.data.bookingId;

  // D1 shows it as PENDING
  const list = await call('GET', `/driver/requests?rideId=${RIDE}`, DRIVER);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((b) => b.bookingId === id));

  // D2 shows details + allowed buttons
  const details = await call('GET', `/driver/requests/${id}`, DRIVER);
  assert.equal(details.status, 200);
  assert.equal(details.body.data.pickup.name, 'Katubedda Junction');
  assert.deepEqual(details.body.data.allowedActions, ['ACCEPT', 'REJECT']);

  const accepted = await call('PATCH', `/${id}/accept`, DRIVER);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.data.status, 'CONFIRMED');

  // accepting again -> 409
  const again = await call('PATCH', `/${id}/accept`, DRIVER);
  assert.equal(again.status, 409);

  const completed = await call('PATCH', `/${id}/complete`, DRIVER);
  assert.equal(completed.body.data.status, 'COMPLETED');
  assert.deepEqual(
    completed.body.data.history.map((h) => h.newStatus),
    ['PENDING', 'CONFIRMED', 'COMPLETED'],
  );
});

test('reject with reason', async () => {
  const { body } = await createAs('p-bob', 1);
  const res = await call('PATCH', `/${body.data.bookingId}/reject`, DRIVER, { reason: 'Route changed' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'REJECTED');
  assert.equal(res.body.data.rejectReason, 'Route changed');
});

test('passenger cancels, then driver cannot accept (409)', async () => {
  const { body } = await createAs('p-carol', 1);
  const id = body.data.bookingId;

  const cancel = await call('PATCH', `/${id}/cancel`, { 'x-passenger-id': 'p-carol' }, { reason: 'Plans changed' });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.cancelledBy, 'PASSENGER');

  const accept = await call('PATCH', `/${id}/accept`, DRIVER);
  assert.equal(accept.status, 409);
  assert.equal(accept.body.code, 'INVALID_STATUS_TRANSITION');
});

test('other drivers / passengers get 404 (cannot see or touch it)', async () => {
  const { body } = await createAs('p-dan', 1);
  const id = body.data.bookingId;

  assert.equal((await call('GET', `/driver/requests/${id}`, { 'x-driver-id': 'someone-else' })).status, 404);
  assert.equal((await call('PATCH', `/${id}/accept`, { 'x-driver-id': 'someone-else' })).status, 404);
  assert.equal((await call('PATCH', `/${id}/cancel`, { 'x-passenger-id': 'not-dan' })).status, 404);
});

test('seat limit: cannot confirm more seats than the ride has', async () => {
  // Ride has 3 seats; alice's earlier booking is COMPLETED (not counted).
  const a = await createAs('p-erin', 2);
  const b = await createAs('p-frank', 2);
  assert.equal((await call('PATCH', `/${a.body.data.bookingId}/accept`, DRIVER)).status, 200);

  const second = await call('PATCH', `/${b.body.data.bookingId}/accept`, DRIVER);
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'NOT_ENOUGH_SEATS');
});

test('two accepts at the same moment never overbook', async () => {
  const x = await createAs('p-gina', 1);
  const y = await createAs('p-hank', 1);
  // 3 seats, 2 already confirmed (erin) -> only ONE of these may succeed.
  const results = await Promise.all([
    call('PATCH', `/${x.body.data.bookingId}/accept`, DRIVER),
    call('PATCH', `/${y.body.data.bookingId}/accept`, DRIVER),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409]);
});

test('duplicate active booking for same ride -> 409', async () => {
  await createAs('p-ivy', 1);
  const dup = await createAs('p-ivy', 1);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'DUPLICATE_ACTIVE_BOOKING');
});

test('validation: bad uuid and bad status give 400', async () => {
  assert.equal((await call('PATCH', '/not-a-uuid/accept', DRIVER)).status, 400);
  assert.equal((await call('GET', '/driver/requests?status=WRONG', DRIVER)).status, 400);
  assert.equal((await call('GET', '/driver/requests')).status, 401); // no header
});
