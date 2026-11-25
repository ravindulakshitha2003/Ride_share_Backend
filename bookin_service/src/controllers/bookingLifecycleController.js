// =============================================================================
// Booking lifecycle controller
//
// A controller is the "receptionist": it
//   1. reads what came in (req.params, req.query, req.body, req.user)
//   2. validates it
//   3. calls ONE service function
//   4. sends the JSON response
// It contains no business rules and no SQL.
//
// Every response uses the same envelope as your teammate's code:
//   success -> { success: true,  message, data }
//   error   -> { success: false, message, code?, errors? }  (errorHandler.js)
// =============================================================================

import {
  acceptBooking,
  cancelBooking,
  completeBooking,
  getDriverBookingDetails,
  getPassengerBookingDetails,
  listDriverBookings,
  rejectBooking,
} from '../services/bookingLifecycleService.js';
import {
  bookingIdParamSchema,
  driverListQuerySchema,
  reasonBodySchema,
  validate,
} from '../validators/bookingLifecycleValidator.js';

// Express 4 does not catch errors thrown in async functions by itself.
// This wrapper forwards them to next(error) -> errorHandler, so we don't
// have to write try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// GET /api/v1/bookings/driver/requests          (screen D1)
// ---------------------------------------------------------------------------
export const listDriverRequestsController = asyncHandler(async (req, res) => {
  const query = validate(driverListQuerySchema, req.query);
  const bookings = await listDriverBookings(req.user.id, query);

  res.json({
    success: true,
    data: bookings,
    // Lets the app do "load more" / infinite scroll later.
    pagination: { limit: query.limit, offset: query.offset, count: bookings.length },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/bookings/driver/requests/:bookingId   (screen D2)
// ---------------------------------------------------------------------------
export const getDriverRequestDetailsController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const booking = await getDriverBookingDetails(req.user.id, bookingId);

  res.json({ success: true, data: booking });
});

// ---------------------------------------------------------------------------
// GET /api/v1/bookings/:bookingId     (passenger checks their booking status)
// ---------------------------------------------------------------------------
export const getPassengerBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const booking = await getPassengerBookingDetails(req.user.id, bookingId);

  res.json({ success: true, data: booking });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/bookings/:bookingId/accept
// ---------------------------------------------------------------------------
export const acceptBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const booking = await acceptBooking(req.user.id, bookingId);

  res.json({ success: true, message: 'Booking accepted', data: booking });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/bookings/:bookingId/reject      body: { reason? }
// ---------------------------------------------------------------------------
export const rejectBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const { reason } = validate(reasonBodySchema, req.body);
  const booking = await rejectBooking(req.user.id, bookingId, reason ?? null);

  res.json({ success: true, message: 'Booking rejected', data: booking });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/bookings/:bookingId/cancel      body: { reason? }
// Caller can be passenger OR driver (req.user.role tells which).
// ---------------------------------------------------------------------------
export const cancelBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const { reason } = validate(reasonBodySchema, req.body);
  const booking = await cancelBooking(req.user, bookingId, reason ?? null);

  res.json({ success: true, message: 'Booking cancelled', data: booking });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/bookings/:bookingId/complete
// ---------------------------------------------------------------------------
export const completeBookingController = asyncHandler(async (req, res) => {
  const { bookingId } = validate(bookingIdParamSchema, req.params);
  const booking = await completeBooking(req.user.id, bookingId);

  res.json({ success: true, message: 'Booking completed', data: booking });
});
