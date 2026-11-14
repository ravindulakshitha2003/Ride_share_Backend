import amqp from 'amqplib';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

let connection;
let channel;
let publishing = false;

async function connectRabbitMQ() {
  connection = await amqp.connect(env.rabbitmqUrl);
  channel = await connection.createConfirmChannel();

  // A topic exchange lets Notification Service bind to the event types it needs.
  await channel.assertExchange(env.bookingEventsExchange, 'topic', { durable: true });

  connection.on('error', (error) => {
    console.error('RabbitMQ connection error:', error.message);
  });

  connection.on('close', () => {
    console.error('RabbitMQ connection closed. Restart the service to reconnect in this starter.');
  });
}

async function publishOne(row) {
  const payload = {
    ...row.payload,
    eventId: row.event_id,
    eventType: row.event_type
  };

  const routingKey = row.event_type.replace(/[A-Z]/g, (letter) => `.${letter.toLowerCase()}`)
    .replace(/^\./, '');

  // Confirm channel callback means the broker acknowledged the publish.
  await new Promise((resolve, reject) => {
    channel.publish(
      env.bookingEventsExchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json', messageId: row.event_id },
      (error) => error ? reject(error) : resolve()
    );
  });

  await pool.query(
    `UPDATE outbox_events
     SET status = 'PUBLISHED', published_at = NOW(), attempts = attempts + 1
     WHERE event_id = $1`,
    [row.event_id]
  );
}

export async function startOutboxPublisher() {
  await connectRabbitMQ();

  // Single-process starter worker. For multiple instances, claim rows with
  // FOR UPDATE SKIP LOCKED and a lease/claim column to avoid competing workers.
  setInterval(async () => {
    if (publishing) return;
    publishing = true;

    try {
      const result = await pool.query(
        `SELECT * FROM outbox_events
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT 20`
      );

      for (const row of result.rows) {
        try {
          await publishOne(row);
        } catch (error) {
          await pool.query(
            `UPDATE outbox_events
             SET attempts = attempts + 1, last_error = $2
             WHERE event_id = $1`,
            [row.event_id, error.message]
          );
          console.error('Outbox event publish failed:', row.event_id, error.message);
          break; // Stop this batch; try again on the next poll.
        }
      }
    } catch (error) {
      console.error('Outbox polling failed:', error.message);
    } finally {
      publishing = false;
    }
  }, env.outboxPollIntervalMs);
}
