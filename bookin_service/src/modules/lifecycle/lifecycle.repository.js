import { pool } from '../../config/database.js';

// Writes ONE row into booking_status_history.
// "client" is the database connection of the running transaction,
// so the history row is saved or rolled back together with the status change.
export async function recordStatusChange(
  client,
  { bookingId, previousStatus, newStatus, changedBy, reason = null }
) {
  await client.query(
    `INSERT INTO booking_status_history
       (booking_id, previous_status, new_status, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, previousStatus, newStatus, changedBy, reason]
  );
}

// Saves an event in the outbox table (same format Member 2 already uses).
// A background worker publishes it to RabbitMQ later.
export async function enqueueOutboxEvent(client, booking, eventType, extra = {}) {
  await client.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
     VALUES ('BOOKING', $1, $2, $3::jsonb)`,
    [
      booking.booking_id,
      eventType,
      JSON.stringify({
        eventType,
        bookingId: booking.booking_id,
        bookingReference: booking.booking_reference,
        rideId: booking.ride_id,
        passengerId: booking.passenger_id,
        driverId: booking.driver_id,
        requestedSeats: booking.requested_seats,
        occurredAt: new Date().toISOString(),
        ...extra, // for example { reason: '...' }
      }),
    ]
  );
}

// B5: reject a PENDING booking. Three things happen in ONE transaction:
//   1. status PENDING -> REJECTED
//   2. one row in booking_status_history
//   3. one row in outbox_events
// If any step fails, all three are undone.
// Returns the updated booking, or null if nothing matched.
export async function rejectPendingBooking({ bookingId, driverId, reason }) {
  const client = await pool.connect(); // one connection for the whole transaction

  try {
    await client.query('BEGIN');

    // The WHERE clause makes it safe: it only works if the booking is
    // still PENDING and belongs to this driver.
    const result = await client.query(
      `UPDATE bookings
       SET status = 'REJECTED', rejection_reason = $3, updated_at = NOW()
       WHERE booking_id = $1 AND driver_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [bookingId, driverId, reason]
    );

    const booking = result.rows[0];
    if (!booking) {
      await client.query('ROLLBACK'); // nothing to save
      return null;
    }

    await recordStatusChange(client, {
      bookingId,
      previousStatus: 'PENDING',
      newStatus: 'REJECTED',
      changedBy: driverId,
      reason,
    });

    await enqueueOutboxEvent(client, booking, 'BookingRejected', { reason });

    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK'); // undo everything on any error
    throw error;
  } finally {
    client.release(); // always give the connection back to the pool
  }
}