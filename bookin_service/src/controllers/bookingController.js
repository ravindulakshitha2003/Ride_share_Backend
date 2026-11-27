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



    

    // 2. Prepare the notification event
    const bookingCreatedEvent = {
      eventId: crypto.randomUUID(),
      eventType: 'booking.created',
      timestamp: new Date().toISOString(),

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

    // 3. Publish event to RabbitMQ
    try {
     
      await publishEvent(
        'booking.created',
        bookingCreatedEvent
      );
      
       await publishEvent(
        'ride.request',
        bookingCreatedEvent
      );

      console.log(
        'Booking created event published successfully'
      );
    } catch (rabbitMQError) {
      // Booking is already saved in the database.
      // Do not fail the booking request because of RabbitMQ.
      console.error(
        'Failed to publish booking event:',
        rabbitMQError
      );
    }
    

    // 4. Return response to frontend
    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
     data: {
        bookingId: booking.booking_id,
        passengerId: booking.passenger_id,
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