import 'dotenv/config';

// Fail early instead of starting the service with missing configuration.
const required = ['DATABASE_URL', 'RIDE_SERVICE_URL', 'JWT_SECRET', 'RABBITMQ_URL'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT || 5004),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  rideServiceUrl: process.env.RIDE_SERVICE_URL,
  jwtSecret: process.env.JWT_SECRET,
  rabbitmqUrl: process.env.RABBITMQ_URL,
  bookingEventsExchange: process.env.BOOKING_EVENTS_EXCHANGE || 'booking.events',
  outboxPollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS || 3000)
};
