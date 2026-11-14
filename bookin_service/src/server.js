import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { startOutboxPublisher } from './messaging/outboxPublisher.js';

async function startServer() {
  // Check PostgreSQL before accepting requests.
  await pool.query('SELECT 1');

  // Start RabbitMQ outbox publisher. If RabbitMQ is unavailable, the service
  // currently fails startup; production deployments should add reconnect logic.
  await startOutboxPublisher();

  app.listen(env.port, () => {
    console.log(`Booking Service listening on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Booking Service:', error);
  process.exit(1);
});
