import { Router } from 'express';
import { createBookingController } from '../controllers/bookingController.js';
import { passengerIdentity } from '../middleware/passengerIdentity.js';

// ---- Booking lifecycle (driver side) ----
import {
  acceptBookingController,
  cancelBookingController,
  completeBookingController,
  getDriverRequestDetailsController,
  getPassengerBookingController,
  listDriverRequestsController,
  rejectBookingController,
} from '../controllers/bookingLifecycleController.js';
import { driverIdentity, driverOrPassengerIdentity } from '../middleware/driverIdentity.js';

const router = Router();

// ---------------------------------------------------------------------------
// Passenger creates a booking request (teammate's part)
// ---------------------------------------------------------------------------
router.post('/', passengerIdentity, createBookingController);

// ---------------------------------------------------------------------------
// Booking lifecycle
// All paths below are prefixed with /api/v1/bookings (see app.js).
//
// ORDER MATTERS: "/driver/requests" must be registered BEFORE "/:bookingId",
// otherwise Express would treat the word "driver" as a bookingId.
// ---------------------------------------------------------------------------

// D1 - Incoming requests (default status=PENDING)
router.get('/driver/requests', driverIdentity, listDriverRequestsController);

// D2 - Request details (+ history + allowedActions)
router.get('/driver/requests/:bookingId', driverIdentity, getDriverRequestDetailsController);

// Driver actions
router.patch('/:bookingId/accept', driverIdentity, acceptBookingController);
router.patch('/:bookingId/reject', driverIdentity, rejectBookingController);
router.patch('/:bookingId/complete', driverIdentity, completeBookingController);

// Passenger or driver can cancel (rules differ - see domain/bookingStatus.js)
router.patch('/:bookingId/cancel', driverOrPassengerIdentity, cancelBookingController);

// Passenger checks the status of their own booking
router.get('/:bookingId', passengerIdentity, getPassengerBookingController);

export default router;
