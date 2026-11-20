// =============================================================================
// Booking lifecycle events -> RabbitMQ
//
// After a status change is SAVED, we announce it so other services can react:
//   - Notification Service: push "Your ride request was accepted!" to passenger
//   - Ride Service:         reduce / restore available seats
//
// Routing keys (topic exchange, same exchange your teammate uses):
//   booking.created    (teammate)    booking.confirmed   booking.rejected
//   booking.cancelled                booking.completed
//
// >>> Tell the Notification member: bind their queue with "booking.*" (or
//     each key above), otherwise they only receive booking.created.
//
// The event shape copies your teammate's booking.created event
// (eventId, eventType, timestamp, data) so consumers handle all events alike.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { publishEvent } from '../config/rabbitmq.js';
import { BookingStatus } from '../domain/bookingStatus.js';

const ROUTING_KEY_BY_STATUS = {
  [BookingStatus.CONFIRMED]: 'booking.confirmed',
  [BookingStatus.REJECTED]: 'booking.rejected',
  [BookingStatus.CANCELLED]: 'booking.cancelled',
  [BookingStatus.COMPLETED]: 'booking.completed',
};

/**
 * Publish a status-change event. NEVER throws.
 *
 * Why never throw? The status change is already committed to PostgreSQL.
 * If RabbitMQ is down, failing the HTTP request would make the driver think
 * the accept did not work, while it actually did. So we only log the error
 * (same decision your teammate made for booking.created).
 *
 * (A production system would use the "transactional outbox" pattern so no
 *  event is ever lost - worth one sentence in your FYP report's
 *  "future work" section.)
 */
export async function publishBookingStatusChanged({
  booking, // { booking_id, ride_id, passenger_id, driver_id, requested_seats }
  previousStatus,
  newStatus,
  changedBy, // { id, role }
  reason = null,
}) {
  const routingKey = ROUTING_KEY_BY_STATUS[newStatus];
  if (!routingKey) return;

  const event = {
    eventId: randomUUID(),
    eventType: routingKey,
    timestamp: new Date().toISOString(),
    data: {
      bookingId: booking.booking_id,
      rideId: booking.ride_id,
      passengerId: booking.passenger_id,
      driverId: booking.driver_id,
      requestedSeats: booking.requested_seats,
      previousStatus,
      status: newStatus,
      changedBy: changedBy.id,
      changedByRole: changedBy.role,
      reason,
    },
  };

  try {
    await publishEvent(routingKey, event);
    console.log(`Published ${routingKey} for booking ${booking.booking_id}`);
  } catch (error) {
    console.error(`Failed to publish ${routingKey}:`, error.message);
  }
}
