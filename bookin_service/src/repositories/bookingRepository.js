import { pool } from '../config/db.js';

export async function insertBooking(client, booking) {
  const query = `
    INSERT INTO bookings (
      passenger_id,
      ride_id,
      requested_seats,
      note,
      passenger_origin_name,
      passenger_origin_location,
      passenger_destination_name,
      passenger_destination_location,
      matched_route_id,
      pickup_mode,
      dropoff_mode,
      pickup_point_name,
      pickup_location,
      dropoff_point_name,
      dropoff_location,
      pickup_walk_distance_m,
      dropoff_walk_distance_m,
      extra_distance_m,
      extra_duration_seconds,
      status,
      driver_id -- added for booking lifecycle
    )
    VALUES (
      $1, $2, $3, $4, $5,
      ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
      $8,
      ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
      $11, $12, $13, $14,
      ST_SetSRID(ST_MakePoint($15, $16), 4326)::geography,
      $17,
      ST_SetSRID(ST_MakePoint($18, $19), 4326)::geography,
      $20, $21, $22, $23, 'PENDING',
      $24 -- driver_id
    )
    RETURNING
      booking_id,
      passenger_id,
      ride_id,
      driver_id,
      requested_seats,
      note,
      status,
      created_at
  `;

  const values = [
    booking.passengerId,
    booking.rideId,
    booking.requestedSeats,
    booking.note ?? null,
    booking.origin.name,
    booking.origin.longitude,
    booking.origin.latitude,
    booking.destination.name,
    booking.destination.longitude,
    booking.destination.latitude,
    booking.matchId,
    booking.pickupMode,
    booking.dropoffMode,
    booking.pickupPoint.name,
    booking.pickupPoint.longitude,
    booking.pickupPoint.latitude,
    booking.dropoffPoint.name,
    booking.dropoffPoint.longitude,
    booking.dropoffPoint.latitude,
    booking.pickupWalkDistanceM,
    booking.dropoffWalkDistanceM,
    booking.extraDistanceM,
    booking.extraDurationSeconds,
    booking.driverId ?? null, // $24 - added for booking lifecycle
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

export async function getBookingById(bookingId) {
  const result = await pool.query(
    `SELECT booking_id, passenger_id, ride_id, requested_seats, note, status, created_at
     FROM bookings
     WHERE booking_id = $1`,
    [bookingId],
  );

  return result.rows[0] ?? null;
}
