import { pool } from '../config/db.js';
import { insertBooking } from '../repositories/bookingRepository.js';

// ---- Added for booking lifecycle ----

import { insertStatusHistory } from '../repositories/bookingLifecycleRepository.js';
import { HttpError } from '../utils/httpError.js';

export async function createBooking(passengerId, payload) {
  // ---- Added for booking lifecycle --------------------------------------
  // Find out who drives this ride so the booking appears in that driver's
  // "Incoming requests" (D1). Done BEFORE the transaction (network call).
  
  // -----------------------------------------------------------------------

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const booking = await insertBooking(client, {
      passengerId,
      driverId: payload.driverId, // <-- added for booking lifecycle
      rideId: payload.rideId,
      requestedSeats: payload.requestedSeats,
      note: payload.note,
      origin: payload.passengerJourney.origin,
      destination: payload.passengerJourney.destination,
      matchId: payload.matchedJourney.matchId,
      pickupMode: payload.matchedJourney.pickupMode,
      dropoffMode: payload.matchedJourney.dropoffMode,
      pickupPoint: payload.matchedJourney.pickupPoint,
      dropoffPoint: payload.matchedJourney.dropoffPoint,
      pickupWalkDistanceM: payload.matchedJourney.pickupWalkDistanceM,
      dropoffWalkDistanceM: payload.matchedJourney.dropoffWalkDistanceM,
      extraDistanceM: payload.matchedJourney.extraDistanceM,
      extraDurationSeconds: payload.matchedJourney.extraDurationSeconds,
    });

    // ---- Added for booking lifecycle: first row of the timeline ----------
    await insertStatusHistory(client, {
      bookingId: booking.booking_id,
      previousStatus: null,
      newStatus: 'PENDING',
      changedBy: `PASSENGER:${passengerId}`,
    });

    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
