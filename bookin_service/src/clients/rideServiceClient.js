// =============================================================================
// Ride Service client
//
// In microservices, each service owns its own data. The RIDE (driver, route,
// seat count) lives in the Ride Service's database, NOT in bookingdb.
// So when the booking service needs to know "who is the driver of ride X?"
// it must ASK the Ride Service over HTTP. This file is the only place that
// does that, so if the Ride Service changes its URL or JSON shape you only
// fix it here.
//
// >>> AGREE WITH THE RIDE SERVICE MEMBER <<<
//   - the endpoint (assumed: GET {RIDE_SERVICE_URL}/api/v1/rides/:rideId)
//   - the field names (assumed: driverId, totalSeats)
// and adjust `normaliseRide()` below to match their real response.
//
// While the Ride Service is not ready, leave RIDE_SERVICE_URL empty in .env:
// every ride is then treated as owned by DEV_DRIVER_ID with DEV_RIDE_TOTAL_SEATS.
// =============================================================================

import { HttpError } from '../utils/httpError.js';

const REQUEST_TIMEOUT_MS = 3000; // never let a slow service hang our request

/**
 * @param {string} rideId
 * @returns {Promise<{ rideId: string, driverId: string, totalSeats: number|null }>}
 */
export async function getRideById(rideId) {
  const baseUrl = process.env.RIDE_SERVICE_URL;

  // ---- Development fallback (no Ride Service running) ----------------------
  if (!baseUrl) {
    return {
      rideId,
      driverId: process.env.DEV_DRIVER_ID || 'driver-1',
      totalSeats: Number(process.env.DEV_RIDE_TOTAL_SEATS || 4),
    };
  }

  // ---- Real call to the Ride Service ----------------------------------------
  let response;
  try {
    // fetch is built into Node 18+, no extra package needed.
    response = await fetch(`${baseUrl}/api/v1/rides/${encodeURIComponent(rideId)}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    // Network error or timeout. 502 = "a service I depend on failed".
    console.error('Ride Service request failed:', error.message);
    throw new HttpError(502, 'Ride service is unavailable, please try again', {
      code: 'RIDE_SERVICE_UNAVAILABLE',
    });
  }

  if (response.status === 404) {
    throw new HttpError(404, 'Ride not found', { code: 'RIDE_NOT_FOUND' });
  }

  if (!response.ok) {
    console.error('Ride Service returned status', response.status);
    throw new HttpError(502, 'Ride service is unavailable, please try again', {
      code: 'RIDE_SERVICE_UNAVAILABLE',
    });
  }

  const body = await response.json();
  return normaliseRide(rideId, body);
}

// Converts whatever the Ride Service returns into the small object we need.
// Accepts both { data: {...} } and a bare object, and camelCase or snake_case.
function normaliseRide(rideId, body) {
  const ride = body?.data ?? body;
  const driverId = ride?.driverId ?? ride?.driver_id;
  const totalSeats = ride?.totalSeats ?? ride?.total_seats ?? ride?.seats;

  if (!driverId) {
    throw new HttpError(502, 'Ride service returned a ride without a driver', {
      code: 'RIDE_SERVICE_BAD_RESPONSE',
    });
  }

  return {
    rideId,
    driverId: String(driverId),
    // null = "unknown" -> the seat-capacity check on accept is skipped.
    totalSeats: Number.isFinite(Number(totalSeats)) ? Number(totalSeats) : null,
  };
}
