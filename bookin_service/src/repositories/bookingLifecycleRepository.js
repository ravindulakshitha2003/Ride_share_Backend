// =============================================================================
// Booking lifecycle repository  (ONLY SQL lives here)
//
// Layers in this service (same pattern your teammate used):
//   routes      -> which URL calls which controller
//   controller  -> reads req, validates input, sends res
//   service     -> business logic (rules, transactions, events)
//   repository  -> SQL queries, nothing else          <-- you are here
//
// Functions that take `client` run inside a transaction started by the
// service. Functions that use `pool` are simple one-off reads.
//
// SECURITY: always use $1, $2 placeholders. Never build SQL with string
// concatenation of user input (SQL injection).
// =============================================================================

import { pool } from '../config/db.js';

// -----------------------------------------------------------------------------
// Reusable SELECT column list.
// Locations are stored as PostGIS GEOGRAPHY points. The app needs plain
// numbers, so we convert:  ST_Y = latitude,  ST_X = longitude.
// (geography must be cast to ::geometry for ST_X / ST_Y)
// -----------------------------------------------------------------------------
const BOOKING_COLUMNS = `
  b.booking_id,
  b.passenger_id,
  b.driver_id,
  b.ride_id,
  b.requested_seats,
  b.note,
  b.status,

  b.passenger_origin_name,
  ST_Y(b.passenger_origin_location::geometry)      AS passenger_origin_lat,
  ST_X(b.passenger_origin_location::geometry)      AS passenger_origin_lng,
  b.passenger_destination_name,
  ST_Y(b.passenger_destination_location::geometry) AS passenger_destination_lat,
  ST_X(b.passenger_destination_location::geometry) AS passenger_destination_lng,

  b.matched_route_id,
  b.pickup_mode,
  b.dropoff_mode,
  b.pickup_point_name,
  ST_Y(b.pickup_location::geometry)                AS pickup_lat,
  ST_X(b.pickup_location::geometry)                AS pickup_lng,
  b.dropoff_point_name,
  ST_Y(b.dropoff_location::geometry)               AS dropoff_lat,
  ST_X(b.dropoff_location::geometry)               AS dropoff_lng,

  b.pickup_walk_distance_m,
  b.dropoff_walk_distance_m,
  b.extra_distance_m,
  b.extra_duration_seconds,

  b.reject_reason,
  b.cancel_reason,
  b.cancelled_by,
  b.responded_at,
  b.completed_at,
  b.created_at,
  b.updated_at
`;

// =============================================================================
// READS
// =============================================================================

/**
 * D1 - list a driver's booking requests.
 * Oldest first for PENDING, so the passenger who asked first is answered first.
 */
export async function findBookingsForDriver(driverId, { status, rideId, limit, offset }) {
  const params = [driverId, status];
  let rideFilter = '';

  // Optional filter: "only requests for this one ride"
  if (rideId) {
    params.push(rideId);
    rideFilter = `AND b.ride_id = $${params.length}`;
  }

  params.push(limit, offset);

  const result = await pool.query(
    `SELECT ${BOOKING_COLUMNS}
       FROM bookings b
      WHERE b.driver_id = $1
        AND b.status = $2
        ${rideFilter}
      ORDER BY b.created_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return result.rows;
}

/** D2 - one booking with everything. Returns null if it does not exist. */
export async function findBookingById(bookingId) {
  const result = await pool.query(
    `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.booking_id = $1`,
    [bookingId],
  );
  return result.rows[0] ?? null;
}

/** Timeline shown at the bottom of D2 ("Requested 10:02, Accepted 10:05"). */
export async function findStatusHistory(bookingId) {
  const result = await pool.query(
    `SELECT previous_status, new_status, changed_by, reason, changed_at
       FROM booking_status_history
      WHERE booking_id = $1
      ORDER BY changed_at ASC, id ASC`,
    [bookingId],
  );
  return result.rows;
}

// =============================================================================
// WRITES / LOCKS  (must be called inside a transaction: BEGIN ... COMMIT)
// =============================================================================

/**
 * Read a booking AND lock its row until the transaction ends.
 *
 * Why FOR UPDATE? Imagine the passenger taps "Cancel" at the same moment the
 * driver taps "Accept". Without a lock both requests could read PENDING and
 * both succeed. With FOR UPDATE the second request WAITS until the first
 * commits, then reads the new status and gets a clean 409 error.
 */
export async function findBookingByIdForUpdate(client, bookingId) {
  const result = await client.query(
    `SELECT booking_id, passenger_id, driver_id, ride_id, requested_seats, status
       FROM bookings
      WHERE booking_id = $1
        FOR UPDATE`,
    [bookingId],
  );
  return result.rows[0] ?? null;
}

/**
 * Lock a whole ride (not a row) until the transaction ends.
 *
 * Two DIFFERENT bookings on the same ride could be accepted at the same time
 * and together exceed the seat count. Row locks don't help (different rows),
 * so we use a PostgreSQL "advisory lock" keyed by the ride id. Only one accept
 * per ride can run the seat check at a time. Released automatically on
 * COMMIT/ROLLBACK because it is the _xact_ version.
 */
export async function lockRide(client, rideId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [rideId]);
}

/** How many seats on this ride are already taken by CONFIRMED bookings? */
export async function sumConfirmedSeats(client, rideId) {
  const result = await client.query(
    `SELECT COALESCE(SUM(requested_seats), 0)::int AS seats
       FROM bookings
      WHERE ride_id = $1 AND status = 'CONFIRMED'`,
    [rideId],
  );
  return result.rows[0].seats;
}

/**
 * Change the status of a booking.
 *
 * `AND status = $fromStatus` is an extra safety net: the UPDATE only happens
 * if the status is still what we checked. If not, 0 rows come back and the
 * service treats it as a conflict.
 *
 * The CASE expressions fill the matching timestamp / reason columns only for
 * the relevant new status, and leave the others unchanged.
 */
export async function updateBookingStatus(
  client,
  { bookingId, fromStatus, toStatus, reason = null, cancelledBy = null },
) {
  const result = await client.query(
    `UPDATE bookings
        SET status        = $3,
            updated_at    = NOW(),
            responded_at  = CASE WHEN $3 IN ('CONFIRMED', 'REJECTED') THEN NOW() ELSE responded_at END,
            completed_at  = CASE WHEN $3 = 'COMPLETED' THEN NOW() ELSE completed_at END,
            reject_reason = CASE WHEN $3 = 'REJECTED'  THEN $4 ELSE reject_reason END,
            cancel_reason = CASE WHEN $3 = 'CANCELLED' THEN $4 ELSE cancel_reason END,
            cancelled_by  = CASE WHEN $3 = 'CANCELLED' THEN $5 ELSE cancelled_by END
      WHERE booking_id = $1
        AND status = $2
      RETURNING booking_id`,
    [bookingId, fromStatus, toStatus, reason, cancelledBy],
  );
  return result.rowCount === 1;
}

/** Audit trail: one row per status change (table created in migration 003). */
export async function insertStatusHistory(
  client,
  { bookingId, previousStatus, newStatus, changedBy, reason = null },
) {
  await client.query(
    `INSERT INTO booking_status_history
       (booking_id, previous_status, new_status, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, previousStatus, newStatus, changedBy, reason],
  );
}
