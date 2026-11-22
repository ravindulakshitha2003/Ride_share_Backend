import pool from '../db/pool.js';
import { getChannel } from '../config/rabbitmq.js';

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'rideshare.events';
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_MS) || 5000;
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE) || 10;
const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS) || 5;

/**
 * Publish an event to RabbitMQ using the initialized channel.
 */
function publishToRabbitMQ(routingKey, payload) {
    const channel = getChannel();

    return new Promise((resolve, reject) => {
        channel.publish(
            EXCHANGE,
            routingKey,
            Buffer.from(JSON.stringify(payload)),
            {
                persistent: true,
                contentType: 'application/json',
            },
            (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Claim and publish a batch of PENDING outbox events.
 */
async function processBatch() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Claim a batch of PENDING (or expired PROCESSING) events.
        const { rows: events } = await client.query(
            `UPDATE outbox_events
             SET    status       = 'PROCESSING',
                    locked_until = NOW() + INTERVAL '60 seconds'
             WHERE  event_id IN (
                        SELECT event_id
                        FROM   outbox_events
                        WHERE  (status = 'PENDING' OR (status = 'PROCESSING' AND locked_until < NOW()))
                          AND  attempts < $1
                        ORDER  BY created_at ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT  $2
                    )
             RETURNING event_id, routing_key, payload`,
            [MAX_ATTEMPTS, BATCH_SIZE]
        );

        await client.query('COMMIT');

        // Publish each claimed event to RabbitMQ.
        for (const event of events) {
            try {
                await publishToRabbitMQ(event.routing_key, event.payload);

                await pool.query(
                    `UPDATE outbox_events
                     SET    status       = 'PUBLISHED',
                            published_at = NOW(),
                            locked_until = NULL
                     WHERE  event_id = $1`,
                    [event.event_id]
                );

                console.log(`Outbox event published: ${event.event_id}`);
            } catch (err) {
                console.error(
                    `Failed to publish outbox event ${event.event_id}:`,
                    err.message
                );

                await pool.query(
                    `UPDATE outbox_events
                     SET    status       = 'PENDING',
                            attempts     = attempts + 1,
                            last_error   = $2,
                            locked_until = NULL
                     WHERE  event_id = $1`,
                    [event.event_id, err.message]
                );
            }
        }

        return events.length;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignore rollback errors
        }

        console.error('Outbox worker batch error:', err.message);
        return 0;
    } finally {
        client.release();
    }
}

let timer;

export function startOutboxWorker() {
    console.log(
        `Outbox worker started (polling every ${POLL_INTERVAL_MS}ms, ` +
        `batch size ${BATCH_SIZE}, max attempts ${MAX_ATTEMPTS})`
    );

    async function poll() {
        try {
            await processBatch();
        } catch (err) {
            console.error('Outbox worker poll error:', err.message);
        }
    }

    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopOutboxWorker() {
    if (timer) {
        clearInterval(timer);
        timer = null;
        console.log('Outbox worker stopped');
    }
}