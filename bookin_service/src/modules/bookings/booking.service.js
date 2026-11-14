import { randomUUID } from 'node:crypto';
import * as repository from './booking.repository.js';
import {
  getRideBookingInfo,
  reserveSeats,
  releaseSeats
} from '../../integrations/rideService.client.js';

function makeBookingReference() {
  // Human-friendly reference. UUID remains the actual database primary key.
  return `SR-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

export async function requestBooking({ rideId, passengerId, seats }) {
  if (!Number.isInteger(seats) || seats < 1) {
    throw Object.assign(new Error('seats must be a positive integer'), { status: 400 });
  }

  // Ride Service is the source of truth for ride existence, status and driver.
  const ride = await getRideBookingInfo(rideId);

  if (!ride || ride.status !== 'PUBLISHED') {
    throw Object.assign(new Error('Ride is not available for booking'), { status: 409 });
  }

  if (!ride.driverId) {
    throw Object.assign(new Error('Ride Service did not return a driver ID'), { status: 502 });
  }

  // Do not reserve seats here. The driver must approve first.
  // Ride Service checks the actual seat count when approval occurs.
  return repository.createBookingWithOutbox({
    rideId,
    passengerId,
    driverId: ride.driverId,
    seats,
    bookingReference: makeBookingReference()
  });
}

export async function getBooking(bookingId, user) {
  const booking = await repository.findBookingById(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  // Passengers can see their own booking; the assigned driver can see it too.
  if (booking.passenger_id !== user.id && booking.driver_id !== user.id) {
    throw Object.assign(new Error('You cannot view this booking'), { status: 403 });
  }

  return booking;
}

export async function getMyBookings(passengerId) {
  return repository.findPassengerBookings(passengerId);
}

export async function getPendingDriverBookings(driverId) {
  return repository.findDriverPendingBookings(driverId);
}

export async function acceptBooking(bookingId, driverId) {
  // Claim first, so simultaneous accept/reject actions cannot both win.
  const booking = await repository.claimBookingForApproval(bookingId, driverId);

  if (!booking) {
    throw Object.assign(
      new Error('Booking not found, not assigned to you, or no longer pending'),
      { status: 409 }
    );
  }

  try {
    // Ride Service performs the atomic seat update in ITS OWN database.
    await reserveSeats({
      rideId: booking.ride_id,
      bookingId: booking.booking_id,
      passengerId: booking.passenger_id,
      seats: booking.requested_seats
    });

    // Only confirm after Ride Service reports a successful reservation.
    try {
      return await repository.confirmBookingAndCreateOutbox(booking.booking_id);
    } catch (databaseError) {
      // Compensation: if our local confirmation fails after seats were reserved,
      // ask Ride Service to release them. If release fails, log and reconcile.
      try {
        await releaseSeats({
          rideId: booking.ride_id,
          bookingId: booking.booking_id,
          seats: booking.requested_seats
        });
      } catch (releaseError) {
        console.error(
          'CRITICAL: seat reservation needs reconciliation',
          booking.booking_id,
          releaseError.message
        );
      }
      throw databaseError;
    }
  } catch (error) {
    // A 409 from Ride Service means seats are no longer available.
    // A timeout/network error is ambiguous: Ride Service might have reserved
    // seats before the response was lost. Keep APPROVING for safe reconciliation
    // instead of blindly retrying with a new booking ID or releasing unknown seats.
    if (error.response?.status === 409) {
      await repository.updateApprovalFailure(
        booking.booking_id,
        'Insufficient available seats'
      );
      throw Object.assign(new Error('Not enough seats are available for this ride'), { status: 409 });
    }

    console.error('Booking approval needs retry/reconciliation:', booking.booking_id, error.message);
    throw Object.assign(
      new Error('Could not complete approval. Booking is awaiting reconciliation.'),
      { status: 503 }
    );
  }
}

export async function rejectBooking(bookingId, driverId, reason) {
  const booking = await repository.setBookingStatus(
    bookingId, 'PENDING', 'REJECTED',
    { reason, owner: 'driver', ownerId: driverId }
  );

  if (!booking) {
    // Ownership is checked inside the UPDATE to prevent changing another driver's booking.
    throw Object.assign(new Error('Booking not found or no longer pending'), { status: 404 });
  }

  await repository.createStatusOutboxEvent(booking, 'BookingRejected');
  return booking;
}

export async function cancelBooking(bookingId, passengerId) {
  const booking = await repository.findBookingById(bookingId);

  if (!booking || booking.passenger_id !== passengerId) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  if (booking.status === 'CONFIRMED') {
    // First claim the cancellation so two concurrent cancellation requests
    // cannot both release the same seats.
    const claimed = await repository.claimConfirmedBookingForCancellation(
      bookingId, passengerId
    );
    if (!claimed) {
      throw Object.assign(new Error('Booking is already being changed'), { status: 409 });
    }

    try {
      // Ride Service must make this release idempotent by bookingId.
      await releaseSeats({
        rideId: claimed.ride_id,
        bookingId: claimed.booking_id,
        seats: claimed.requested_seats
      });
    } catch (error) {
      // If release failed, restore CONFIRMED so the passenger can retry.
      await repository.setBookingStatus(
        bookingId, 'CANCELLING', 'CONFIRMED',
        { owner: 'passenger', ownerId: passengerId }
      );
      throw error;
    }

    const cancelled = await repository.setBookingStatus(
      bookingId, 'CANCELLING', 'CANCELLED',
      { owner: 'passenger', ownerId: passengerId }
    );

    if (!cancelled) {
      throw Object.assign(new Error('Cancellation needs reconciliation'), { status: 409 });
    }

    await repository.createStatusOutboxEvent(cancelled, 'BookingCancelled');
    return cancelled;
  }

  if (booking.status === 'PENDING') {
    const cancelled = await repository.setBookingStatus(
      bookingId, 'PENDING', 'CANCELLED',
      { owner: 'passenger', ownerId: passengerId }
    );
    if (!cancelled) {
      throw Object.assign(new Error('Booking is no longer pending'), { status: 409 });
    }
    await repository.createStatusOutboxEvent(cancelled, 'BookingCancelled');
    return cancelled;
  }

  throw Object.assign(
    new Error(`A booking with status ${booking.status} cannot be cancelled`),
    { status: 409 }
  );
}
