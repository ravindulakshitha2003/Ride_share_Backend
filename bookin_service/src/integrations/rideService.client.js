import axios from 'axios';
import { env } from '../config/env.js';

// This client is the ONLY way Booking Service accesses Ride Service data.
// It never connects to or queries the Ride Service PostgreSQL database.
const rideApi = axios.create({
  baseURL: env.rideServiceUrl,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

// Ask Ride Service for trusted ride information.
// Ride Service must implement this internal endpoint.
export async function getRideBookingInfo(rideId) {
  const response = await rideApi.get(`/api/v1/internal/rides/${rideId}/booking-info`);
  return response.data;
}

// Ask Ride Service to reserve seats. bookingId is the idempotency key:
// repeating the same request must NOT deduct seats twice.
export async function reserveSeats({ rideId, bookingId, passengerId, seats }) {
  const response = await rideApi.post(
    `/api/v1/internal/rides/${rideId}/reservations`,
    { bookingId, passengerId, seats },
    { headers: { 'Idempotency-Key': bookingId } }
  );
  return response.data;
}

// Ask Ride Service to release seats after a cancellation or compensation.
// Ride Service must make release idempotent too.
export async function releaseSeats({ rideId, bookingId, seats }) {
  const response = await rideApi.post(
    `/api/v1/internal/rides/${rideId}/reservations/${bookingId}/release`,
    { seats },
    { headers: { 'Idempotency-Key': `release-${bookingId}` } }
  );
  return response.data;
}
