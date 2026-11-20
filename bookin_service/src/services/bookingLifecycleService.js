// =============================================================================
// Booking lifecycle service  (business logic)
//
// Every status change follows the SAME recipe, implemented once in
// `changeBookingStatus()`:
//
//   1. BEGIN transaction
//   2. Load the booking and LOCK its row          (no race conditions)
//   3. Check the caller owns it                   (security)
//   4. Ask the state machine if the move is legal (status rules)
//   5. Run any extra check (e.g. seats for ACCEPT)
//   6. UPDATE the status + INSERT a history row
//   7. COMMIT  (all or nothing)
//   8. Publish a RabbitMQ event (only after the commit succeeded)
//
// accept / reject / cancel / complete are then tiny wrappers around it.
// =============================================================================

import { pool } from '../config/db.js';
import {
  ActorRole,
  BookingAction,
  BookingStatus,
  getAllowedActions,
  resolveTransition,
} from '../domain/bookingStatus.js';
import {
  findBookingById,
  findBookingByIdForUpdate,
  findBookingsForDriver,
  findStatusHistory,
  insertStatusHistory,
  lockRide,
  sumConfirmedSeats,
  updateBookingStatus,
} from '../repositories/bookingLifecycleRepository.js';
import { getRideById } from '../clients/rideServiceClient.js';
import { publishBookingStatusChanged } from '../events/bookingEvents.js';
import { toBookingResponse, toHistoryResponse } from '../utils/bookingMapper.js';
import { HttpError } from '../utils/httpError.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Is this actor (driver or passenger) linked to this booking?
 *
 * If not, we answer 404 "not found" instead of 403 "forbidden". That way a
 * random user cannot discover which booking ids exist by guessing.
 */
function assertActorOwnsBooking(booking, actor) {
  const ownerId = actor.role === ActorRole.DRIVER ? booking.driver_id : booking.passenger_id;

  if (!ownerId || ownerId !== actor.id) {
    throw new HttpError(404, 'Booking not found', { code: 'BOOKING_NOT_FOUND' });
  }
}

/** Load a booking with all details + history, already in app (camelCase) shape. */
async function loadBookingView(bookingId, actor) {
  const row = await findBookingById(bookingId);
  if (!row) {
    throw new HttpError(404, 'Booking not found', { code: 'BOOKING_NOT_FOUND' });
  }
  assertActorOwnsBooking(row, actor);

  const history = await findStatusHistory(bookingId);

  return {
    ...toBookingResponse(row),
    history: history.map(toHistoryResponse),
    // Tells the app which buttons to show for THIS user right now.
    allowedActions: getAllowedActions(actor.role, row.status),
  };
}

// -----------------------------------------------------------------------------
// The generic status-change recipe (steps 1-8 above)
// -----------------------------------------------------------------------------
async function changeBookingStatus({ bookingId, actor, action, reason = null, extraCheck }) {
  const client = await pool.connect(); // one dedicated DB connection for the transaction
  let lockedBooking;
  let previousStatus;
  let newStatus;

  try {
    await client.query('BEGIN'); // ---- step 1

    lockedBooking = await findBookingByIdForUpdate(client, bookingId); // ---- step 2
    if (!lockedBooking) {
      throw new HttpError(404, 'Booking not found', { code: 'BOOKING_NOT_FOUND' });
    }

    assertActorOwnsBooking(lockedBooking, actor); // ---- step 3

    previousStatus = lockedBooking.status;
    newStatus = resolveTransition(action, actor.role, previousStatus); // ---- step 4

    if (extraCheck) {
      await extraCheck(client, lockedBooking); // ---- step 5
    }

    const updated = await updateBookingStatus(client, {
      // ---- step 6
      bookingId,
      fromStatus: previousStatus,
      toStatus: newStatus,
      reason,
      cancelledBy: action === BookingAction.CANCEL ? actor.role : null,
    });

    if (!updated) {
      // Should not happen thanks to FOR UPDATE, but never assume.
      throw new HttpError(409, 'Booking was changed by someone else, please refresh', {
        code: 'CONCURRENT_UPDATE',
      });
    }

    await insertStatusHistory(client, {
      bookingId,
      previousStatus,
      newStatus,
      changedBy: `${actor.role}:${actor.id}`, // e.g. "DRIVER:driver-1"
      reason,
    });

    await client.query('COMMIT'); // ---- step 7
  } catch (error) {
    // Anything failed -> undo every change made in this transaction.
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // ALWAYS give the connection back to the pool, or the server will
    // eventually run out of connections and freeze.
    client.release();
  }

  // ---- step 8 (outside the transaction: the data is safely saved now)
  await publishBookingStatusChanged({
    booking: lockedBooking,
    previousStatus,
    newStatus,
    changedBy: actor,
    reason,
  });

  // Return the fresh full booking so the app can update the screen at once.
  return loadBookingView(bookingId, actor);
}

// =============================================================================
// PUBLIC FUNCTIONS (called by the controller)
// =============================================================================

/** D1 - Incoming requests list for a driver. */
export async function listDriverBookings(driverId, query) {
  const rows = await findBookingsForDriver(driverId, query);
  return rows.map(toBookingResponse);
}

/** D2 - Request details for a driver. */
export async function getDriverBookingDetails(driverId, bookingId) {
  return loadBookingView(bookingId, { id: driverId, role: ActorRole.DRIVER });
}

/** Passenger view of their own booking (handy for the passenger "status" screen). */
export async function getPassengerBookingDetails(passengerId, bookingId) {
  return loadBookingView(bookingId, { id: passengerId, role: ActorRole.PASSENGER });
}

/**
 * Driver ACCEPTS a pending request.
 * Extra rule: the ride must still have enough free seats.
 */
export async function acceptBooking(driverId, bookingId) {
  // Ask the Ride Service for the seat count BEFORE opening the transaction.
  // Rule of thumb: never make slow network calls while holding DB locks.
  // We first need the ride id, so do a quick unlocked read.
  const row = await findBookingById(bookingId);
  if (!row || row.driver_id !== driverId) {
    throw new HttpError(404, 'Booking not found', { code: 'BOOKING_NOT_FOUND' });
  }
  const ride = await getRideById(row.ride_id);

  return changeBookingStatus({
    bookingId,
    actor: { id: driverId, role: ActorRole.DRIVER },
    action: BookingAction.ACCEPT,

    // Runs INSIDE the transaction, after the booking row is locked.
    extraCheck: async (client, booking) => {
      if (ride.totalSeats === null) return; // Ride Service gave no seat info -> skip

      await lockRide(client, booking.ride_id); // one accept per ride at a time
      const alreadyTaken = await sumConfirmedSeats(client, booking.ride_id);
      const seatsLeft = ride.totalSeats - alreadyTaken;

      if (booking.requested_seats > seatsLeft) {
        throw new HttpError(
          409,
          `Not enough seats: ${seatsLeft} left, ${booking.requested_seats} requested`,
          { code: 'NOT_ENOUGH_SEATS' },
        );
      }
    },
  });
}

/** Driver REJECTS a pending request (reason is optional). */
export async function rejectBooking(driverId, bookingId, reason) {
  return changeBookingStatus({
    bookingId,
    actor: { id: driverId, role: ActorRole.DRIVER },
    action: BookingAction.REJECT,
    reason,
  });
}

/** Passenger OR driver CANCELS. The state machine decides what each may do. */
export async function cancelBooking(actor, bookingId, reason) {
  return changeBookingStatus({
    bookingId,
    actor,
    action: BookingAction.CANCEL,
    reason,
  });
}

/** Driver marks a CONFIRMED booking as COMPLETED (trip done). */
export async function completeBooking(driverId, bookingId) {
  return changeBookingStatus({
    bookingId,
    actor: { id: driverId, role: ActorRole.DRIVER },
    action: BookingAction.COMPLETE,
  });
}

// Re-exported so the controller/validator can use the list of statuses.
export { BookingStatus };
