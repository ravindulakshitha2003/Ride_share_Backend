import { pool } from '../config/db.js';
import { insertBooking } from '../repositories/bookingRepository.js';

export async function createBooking(passengerId, payload) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const booking = await insertBooking(client, {
      passengerId,
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

    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
