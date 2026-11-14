import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import * as controller from './booking.controller.js';

const router = Router();

// Every endpoint requires a valid Identity Service JWT.
router.use(authenticate);

// Passenger creates a booking request.
router.post('/', requireRole('PASSENGER'), controller.createBooking);

// Passenger sees their own bookings.
router.get('/my', requireRole('PASSENGER'), controller.getMyBookings);

// Driver sees requests for rides assigned to that driver.
router.get('/driver/pending', requireRole('DRIVER'), controller.getDriverPendingBookings);

// Driver accepts or rejects a pending booking.
router.patch('/:bookingId/accept', requireRole('DRIVER'), controller.acceptBooking);
router.patch('/:bookingId/reject', requireRole('DRIVER'), controller.rejectBooking);

// Passenger cancels their own booking.
router.patch('/:bookingId/cancel', requireRole('PASSENGER'), controller.cancelBooking);

// A passenger or assigned driver can view a booking.
router.get('/:bookingId', controller.getBooking);

export default router;
