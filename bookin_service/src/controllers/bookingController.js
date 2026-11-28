
import { randomUUID } from 'node:crypto';

import { publishEvent } from '../config/rabbitmq.js';
import { createBooking } from '../services/bookingService.js';
import { createBookingSchema } from '../validators/bookingValidator.js';


export async function createBookingController(req, res, next) {
  try {

    


     if(req.body.driverId ==req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'cannot booking  your own ride '
      })}
    
     
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

    parsed.data.driverId= req.body.driverId;
  
    // 1. Create booking in PostgreSQL
    const booking = await createBooking(
      req.user.id,
      parsed.data
    );

    // 2. Common booking information
    const bookingData = {
      bookingId: booking.booking_id,
      passengerId: booking.passenger_id,
      driverId: booking.driver_id,
      rideId: booking.ride_id,
      requestedSeats: booking.requested_seats,
      note: booking.note,
      status: booking.status,
      createdAt: booking.created_at,
    };

    // 3. Prepare passenger notification
    const passengerEvent = {
      eventId: randomUUID(),


    

    // 2. Prepare the notification event
    const bookingCreatedEvent = {
      eventId: crypto.randomUUID(),
      eventType: 'booking.created',
      timestamp: new Date().toISOString(),
      recipientUserId: String(booking.passenger_id),
      title: 'Booking Request Submitted',
      body: 'Your booking request has been submitted successfully. Waiting for the driver to respond.',
      data: bookingData,
    };

    // 4. Prepare driver notification
    const driverEvent = {
      eventId: randomUUID(),
      eventType: 'booking.created',
      timestamp: new Date().toISOString(),
      recipientUserId: String(booking.driver_id),
      title: 'New Booking Request',
      body: 'A passenger has requested to join your ride. Review the booking request.',
      data: bookingData,
      data: {
        bookingId: booking.booking_id,
        passengerId: booking.passenger_id,
        recipientUserId:  parsed.data.driverId,
        rideId: booking.ride_id,
        requestedSeats: booking.requested_seats,
        note: booking.note,
        status: booking.status,
        createdAt: booking.created_at,
        title : "REQUEST"
      },
    };

    // 5. Publish passenger notification
    try {
      await publishEvent('booking.created', passengerEvent);
      console.log('Passenger booking notification published successfully');
    } catch (error) {
      console.error('Failed to publish passenger notification:', error.message);
    }
     
      await publishEvent(
        'booking.created',
        bookingCreatedEvent
      );
      
       await publishEvent(
        'ride.request',
        bookingCreatedEvent
      );

    // 6. Publish driver notification
    try {
      await publishEvent('booking.created', driverEvent);
      console.log('Driver booking notification published successfully');
    } catch (error) {
      console.error('Failed to publish driver notification:', error.message);
    }
    

    // 7. Return response
    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
     data: {
        bookingId: booking.booking_id,
        passengerId: booking.passenger_id,
        driverId: booking.driver_id,
        recipientUserId: booking.driverId,
        rideId: booking.ride_id,
        requestedSeats: booking.requested_seats,
        note: booking.note,
        status: booking.status,
        createdAt: booking.created_at,
        title : "REQUEST"
      },
    });

  } catch (error) {
    next(error);
  }
}
