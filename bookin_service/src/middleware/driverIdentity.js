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
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{24}$|^[a-zA-Z0-9_\-]+$/i;

function extractTokenUser(req) {
  if (!req.headers.authorization) return null;
  try {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const payload = JSON.parse(Buffer.from(parts[1].split('.')[1], 'base64').toString('utf8'));
      return { id: payload.sub || payload.id || payload.userId, role: payload.role?.toUpperCase() };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function invalidIdResponse(res, headerName) {
  return res.status(401).json({
    success: false,
    message: `${headerName} must be a valid ID string (temporary development auth).`,
  });
}

/** Only drivers may pass (accept, reject, complete, D1/D2 screens). */
export function driverIdentity(req, res, next) {
  let driverId = req.header('x-driver-id') || req.header('x-user-id');

  if (!driverId) {
    const tokenUser = extractTokenUser(req);
    if (tokenUser?.id) {
      driverId = tokenUser.id;
    }
  }

  if (!driverId) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-driver-id or Authorization header (temporary development auth).',
    });
  }

  if (!ID_PATTERN.test(driverId)) {
    return invalidIdResponse(res, 'x-driver-id');
  }

  req.user = { id: String(driverId).toLowerCase(), role: ActorRole.DRIVER };
  next();
}

/**
 * Driver OR passenger may pass (used by cancel - both sides can cancel).
 * Exactly one of the two headers must be present.
 */
export function driverOrPassengerIdentity(req, res, next) {
  let driverId = req.header('x-driver-id');
  let passengerId = req.header('x-passenger-id');

  if (!driverId && !passengerId) {
    const tokenUser = extractTokenUser(req);
    if (tokenUser?.id) {
      if (tokenUser.role === 'DRIVER') {
        driverId = tokenUser.id;
      } else {
        passengerId = tokenUser.id;
      }
    }
  }

  if (driverId && passengerId) {
    return res.status(400).json({
      success: false,
      message: 'Send either x-driver-id or x-passenger-id, not both.',
    });
  }

  if (driverId) {
    if (!ID_PATTERN.test(driverId)) return invalidIdResponse(res, 'x-driver-id');
    req.user = { id: String(driverId).toLowerCase(), role: ActorRole.DRIVER };
    return next();
  }

  if (passengerId) {
    req.user = { id: String(passengerId).toLowerCase(), role: ActorRole.PASSENGER };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Missing x-driver-id or x-passenger-id header (temporary development auth).',
  });
}
