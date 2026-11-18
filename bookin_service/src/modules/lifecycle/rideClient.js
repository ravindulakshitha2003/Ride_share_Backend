import axios from 'axios';
import { env } from '../../config/env.js'; // also loads the .env file

// One pre-configured axios instance used for every call to Ride Service
const http = axios.create({
  baseURL: env.rideServiceUrl, // where Ride Service lives
  timeout: 5000, // give up after 5 seconds
  headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY }, // required by Ride Service
});

// Turns any axios error into an error our code understands
function translateError(e) {
  // Ride Service answered with a clear error (400, 404, 409 ...)
  if (e.response && e.response.status < 500) {
    const body = (e.response.data && e.response.data.error) || {};
    const err = new Error(body.message || 'Ride Service rejected the request');
    err.status = e.response.status; // e.g. 409
    err.code = body.code || 'VALIDATION_ERROR'; // e.g. INSUFFICIENT_SEATS
    return err;
  }
  // Timeout, network failure or 5xx: we do NOT know what happened
  const err = new Error('Ride Service is not available');
  err.status = 503;
  err.code = 'SERVICE_UNAVAILABLE';
  err.outcomeUnknown = true; // the reservation may or may not have happened
  return err;
}

// R3: reserve seats (safe to repeat with the same bookingId)
export async function reserve(rideId, bookingId, passengerId, seats) {
  try {
    const res = await http.post(`/api/v1/internal/rides/${rideId}/reservations`, {
      bookingId,
      passengerId,
      seats,
    });
    return res.data;
  } catch (e) {
    throw translateError(e);
  }
}

// R4: release seats (safe to repeat with the same bookingId)
export async function release(rideId, bookingId, seats) {
  try {
    const res = await http.post(
      `/api/v1/internal/rides/${rideId}/reservations/${bookingId}/release`,
      { seats }
    );
    return res.data;
  } catch (e) {
    throw translateError(e);
  }
}

// R5: look up a reservation. Returns null if none exists (404)
export async function getReservation(rideId, bookingId) {
  try {
    const res = await http.get(`/api/v1/internal/rides/${rideId}/reservations/${bookingId}`);
    return res.data;
  } catch (e) {
    if (e.response && e.response.status === 404) return null;
    throw translateError(e);
  }
}