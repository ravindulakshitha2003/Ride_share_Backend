import * as service from './booking.service.js';

export async function createBooking(req, res, next) {
  try {
    const { rideId, seats } = req.body;
    if (!rideId) return res.status(400).json({ message: 'rideId is required' });

    const booking = await service.requestBooking({
      rideId,
      passengerId: req.user.id,
      seats: Number(seats)
    });

    return res.status(201).json({
      message: 'Booking request created. Waiting for driver approval.',
      data: booking
    });
  } catch (error) {
    next(error);
  }
}

export async function getBooking(req, res, next) {
  try {
    const booking = await service.getBooking(req.params.bookingId, req.user);
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
}

export async function getMyBookings(req, res, next) {
  try {
    const bookings = await service.getMyBookings(req.user.id);
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
}

export async function getDriverPendingBookings(req, res, next) {
  try {
    const bookings = await service.getPendingDriverBookings(req.user.id);
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
}

export async function acceptBooking(req, res, next) {
  try {
    const booking = await service.acceptBooking(req.params.bookingId, req.user.id);
    res.json({
      message: 'Booking confirmed and seats reserved.',
      data: booking
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectBooking(req, res, next) {
  try {
    const booking = await service.rejectBooking(
      req.params.bookingId,
      req.user.id,
      req.body.reason || 'Driver rejected the request'
    );
    res.json({ message: 'Booking rejected.', data: booking });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    const booking = await service.cancelBooking(req.params.bookingId, req.user.id);
    res.json({ message: 'Booking cancelled.', data: booking });
  } catch (error) {
    next(error);
  }
}
