import { pool } from '../../config/database.js';

// Repository = SQL only. Business decisions belong in booking.service.js.

export async function createBookingWithOutbox({
  rideId, passengerId, driverId, seats, bookingReference
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `INSERT INTO bookings
         (ride_id, passenger_id, driver_id, requested_seats, booking_reference, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [rideId, passengerId, driverId, seats, bookingReference]
    );

    const booking = bookingResult.rows[0];

    // Save the event in the SAME local transaction as the booking.
    // A background worker will publish it to RabbitMQ later.
    await client.query(
      `INSERT INTO outbox_events
         (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('BOOKING', $1, 'BookingRequested', $2::jsonb)`,
      [
        booking.booking_id,
        JSON.stringify({
          eventId: null,
          eventType: 'BookingRequested',
          bookingId: booking.booking_id,
          bookingReference: booking.booking_reference,
          rideId: booking.ride_id,
          passengerId: booking.passenger_id,
          driverId: booking.driver_id,
          requestedSeats: booking.requested_seats,
          occurredAt: new Date().toISOString()
        })
      ]
    );

    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findBookingById(bookingId) {
  const result = await pool.query(
    'SELECT * FROM bookings WHERE booking_id = $1',
    [bookingId]
  );
  return result.rows[0] || null;
}

export async function findPassengerBookings(passengerId) {
  const result = await pool.query(
    `SELECT * FROM bookings
     WHERE passenger_id = $1
     ORDER BY created_at DESC`,
    [passengerId]
  );
  return result.rows;
}

export async function findDriverPendingBookings(driverId) {
  const result = await pool.query(
    `SELECT * FROM bookings
     WHERE driver_id = $1 AND status = 'PENDING'
     ORDER BY created_at ASC`,
    [driverId]
  );
  return result.rows;
}

// Atomically claim a pending booking so two driver actions cannot process it
// at the same time. APPROVING is an intermediate state while Ride Service
// reserves seats. A stuck APPROVING record needs operational reconciliation.
export async function claimBookingForApproval(bookingId, driverId) {
  const result = await pool.query(
    `UPDATE bookings
     SET status = 'APPROVING', updated_at = NOW()
     WHERE booking_id = $1
       AND driver_id = $2
       AND status = 'PENDING'
     RETURNING *`,
    [bookingId, driverId]
  );
  return result.rows[0] || null;
}

export async function confirmBookingAndCreateOutbox(bookingId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE bookings
       SET status = 'CONFIRMED',
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE booking_id = $1 AND status = 'APPROVING'
       RETURNING *`,
      [bookingId]
    );

    if (!updated.rows[0]) {
      throw Object.assign(new Error('Booking is no longer awaiting confirmation'), { status: 409 });
    }

    const booking = updated.rows[0];

    await client.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('BOOKING', $1, 'BookingConfirmed', $2::jsonb)`,
      [
        booking.booking_id,
        JSON.stringify({
          eventType: 'BookingConfirmed',
          bookingId: booking.booking_id,
          bookingReference: booking.booking_reference,
          rideId: booking.ride_id,
          passengerId: booking.passenger_id,
          driverId: booking.driver_id,
          confirmedSeats: booking.requested_seats,
          occurredAt: new Date().toISOString()
        })
      ]
    );

    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setBookingStatus(
  bookingId, fromStatus, toStatus, extra = {}
) {
  // ownerColumn is selected only from this allow-list, never directly from user input.
  const ownerColumns = {
    driver: 'driver_id',
    passenger: 'passenger_id'
  };
  const ownerColumn = extra.owner ? ownerColumns[extra.owner] : null;

  if (extra.owner && !ownerColumn) {
    throw new Error('Invalid booking owner type');
  }

  const ownerCondition = ownerColumn ? `AND ${ownerColumn} = $5` : '';
  const values = [
    bookingId,
    fromStatus,
    toStatus,
    extra.reason || null
  ];

  if (extra.ownerId) values.push(extra.ownerId);

  const result = await pool.query(
    `UPDATE bookings
     SET status = $3,
         rejection_reason = COALESCE($4, rejection_reason),
         cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
         updated_at = NOW()
     WHERE booking_id = $1 AND status = $2 ${ownerCondition}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function claimConfirmedBookingForCancellation(bookingId, passengerId) {
  const result = await pool.query(
    `UPDATE bookings
     SET status = 'CANCELLING', updated_at = NOW()
     WHERE booking_id = $1
       AND passenger_id = $2
       AND status = 'CONFIRMED'
     RETURNING *`,
    [bookingId, passengerId]
  );
  return result.rows[0] || null;
}

export async function updateApprovalFailure(bookingId, reason) {
  const result = await pool.query(
    `UPDATE bookings
     SET status = 'FAILED', rejection_reason = $2, updated_at = NOW()
     WHERE booking_id = $1 AND status = 'APPROVING'
     RETURNING *`,
    [bookingId, reason]
  );
  return result.rows[0] || null;
}

export async function createStatusOutboxEvent(booking, eventType) {
  await pool.query(
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
        occurredAt: new Date().toISOString()
      })
    ]
  );
}
