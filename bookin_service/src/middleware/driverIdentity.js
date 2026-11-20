// =============================================================================
// TEMPORARY DEVELOPMENT AUTH - same idea as passengerIdentity.js
//
// Reads the driver id from the "x-driver-id" header.
// When your team adds real login (JWT), replace these with ONE middleware that
// verifies the token and sets req.user = { id, role } from the token claims.
// The rest of the lifecycle code only reads req.user, so nothing else changes.
// =============================================================================

import { ActorRole } from '../domain/bookingStatus.js';

// In your team's database, driver_id is a UUID column
// (e.g. 11111111-1111-4111-8111-111111111111). If we sent "driver-1" to
// PostgreSQL it would crash with "invalid input syntax for type uuid".
// So we check the format here and answer with a clear 401 instead.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidIdResponse(res, headerName) {
  return res.status(401).json({
    success: false,
    message: `${headerName} must be a valid UUID (temporary development auth).`,
  });
}

/** Only drivers may pass (accept, reject, complete, D1/D2 screens). */
export function driverIdentity(req, res, next) {
  const driverId = req.header('x-driver-id');

  if (!driverId) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-driver-id header (temporary development auth).',
    });
  }

  if (!UUID_PATTERN.test(driverId)) {
    return invalidIdResponse(res, 'x-driver-id');
  }

  // PostgreSQL always returns UUIDs in lowercase. We lowercase here too, so
  // comparing "is this the booking's driver?" works even if the app sent
  // capital letters.
  req.user = { id: driverId.toLowerCase(), role: ActorRole.DRIVER };
  next();
}

/**
 * Driver OR passenger may pass (used by cancel - both sides can cancel).
 * Exactly one of the two headers must be present.
 */
export function driverOrPassengerIdentity(req, res, next) {
  const driverId = req.header('x-driver-id');
  const passengerId = req.header('x-passenger-id');

  if (driverId && passengerId) {
    return res.status(400).json({
      success: false,
      message: 'Send either x-driver-id or x-passenger-id, not both.',
    });
  }

  if (driverId) {
    if (!UUID_PATTERN.test(driverId)) return invalidIdResponse(res, 'x-driver-id');
    req.user = { id: driverId.toLowerCase(), role: ActorRole.DRIVER };
    return next();
  }

  if (passengerId) {
    // Passenger ids are not format-checked here, to match your teammate's
    // passengerIdentity. If passenger_id is a UUID column and the id is not
    // a UUID, errorHandler turns the database error into a 400.
    req.user = { id: passengerId, role: ActorRole.PASSENGER };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Missing x-driver-id or x-passenger-id header (temporary development auth).',
  });
}
