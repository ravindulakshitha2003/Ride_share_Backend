// =============================================================================
// TEMPORARY DEVELOPMENT AUTH - same idea as passengerIdentity.js
//
// Reads the driver id from the "x-driver-id" header.
// When your team adds real login (JWT), replace these with ONE middleware that
// verifies the token and sets req.user = { id, role } from the token claims.
// The rest of the lifecycle code only reads req.user, so nothing else changes.
// =============================================================================

import { ActorRole } from '../domain/bookingStatus.js';

/** Only drivers may pass (accept, reject, complete, D1/D2 screens). */
export function driverIdentity(req, res, next) {
  const driverId = req.header('x-driver-id');

  if (!driverId) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-driver-id header (temporary development auth).',
    });
  }

  req.user = { id: driverId, role: ActorRole.DRIVER };
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
    req.user = { id: driverId, role: ActorRole.DRIVER };
    return next();
  }

  if (passengerId) {
    req.user = { id: passengerId, role: ActorRole.PASSENGER };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Missing x-driver-id or x-passenger-id header (temporary development auth).',
  });
}
