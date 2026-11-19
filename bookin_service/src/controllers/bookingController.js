import { createBookingSchema } from '../validators/bookingValidator.js';
import { createBooking } from '../services/bookingService.js';

export async function createBookingController(req, res, next) {
  try {
    const parsed = createBookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking request',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const booking = await createBooking(req.user.id, parsed.data);

    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      data: {
        bookingId: booking.booking_id,
        passengerId: booking.passenger_id,
        rideId: booking.ride_id,
        requestedSeats: booking.requested_seats,
        note: booking.note,
        status: booking.status,
        createdAt: booking.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}
