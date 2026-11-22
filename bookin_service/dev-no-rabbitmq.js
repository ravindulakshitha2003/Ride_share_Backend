// =============================================================================
// DEV ONLY: start the booking service WITHOUT RabbitMQ.
// Useful for testing with Postman when RabbitMQ is not installed.
// Events are not sent; you'll just see "Failed to publish ..." in the console.
// For the real server use:  npm run dev   (needs RabbitMQ)
//
// Run:  node scripts/dev-no-rabbitmq.js
// =============================================================================

import app from '../src/app.js';
import { pool } from '../src/config/db.js';

const PORT = process.env.PORT || 5001;

try {
  await pool.query('SELECT 1'); // check the database works
  console.log('PostgreSQL connection successful');
  console.warn('RabbitMQ is NOT connected (dev mode): events will not be sent.');

  app.listen(PORT, () => {
    console.log(`Booking Service (no RabbitMQ) running on port ${PORT}`);
  });
} catch (error) {
  console.error('Failed to start:', error.message);
  process.exit(1);
}