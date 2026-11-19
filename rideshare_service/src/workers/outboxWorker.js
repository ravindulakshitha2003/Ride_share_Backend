
import pool from '../db/pool.js';
import { publishEvent } from '../config/rabbitmq.js';

let isRunning = false;

// Claim events using a short database transaction.
async function claimOutboxEvents() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(`
            WITH pending_events AS (
                SELECT event_id
                FROM outbox_events
                WHERE status = 'PENDING'
                   OR (
                       status = 'PROCESSING'
                       AND locked_until < NOW()
                   )
                ORDER BY created_at ASC
                LIMIT 10
                FOR UPDATE SKIP LOCKED
            )
            UPDATE outbox_events AS events
            SET status = 'PROCESSING',
                locked_until = NOW() + INTERVAL '5 minutes',
                attempts = events.attempts + 1
            FROM pending_events
            WHERE events.event_id = pending_events.event_id
            RETURNING
                events.event_id,
                events.routing_key,
                events.payload
        `);

        await client.query('COMMIT');

        return result.rows;

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError.message);
        }

        throw error;

    } finally {
        client.release();
    }
}

// Publish claimed events without holding database locks.
async function processOutboxEvents() {
    if (isRunning) return;

    isRunning = true;

    try {
        const events = await claimOutboxEvents();

        for (const event of events) {
            try {
                // Wait for RabbitMQ publisher confirmation.
                await publishEvent(event.routing_key, event.payload);

                await pool.query(`
                    UPDATE outbox_events
                    SET status = 'PUBLISHED',
                        published_at = NOW(),
                        locked_until = NULL,
                        last_error = NULL
                    WHERE event_id = $1
                      AND status = 'PROCESSING'
                `, [event.event_id]);

                console.log('Outbox event published:', event.event_id);

            } catch (error) {
                console.error(
                    'Outbox publishing failed:',
                    event.event_id,
                    error.message
                );

                try {
                    await pool.query(`
                        UPDATE outbox_events
                        SET status = 'PENDING',
                            locked_until = NULL,
                            last_error = $2
                        WHERE event_id = $1
                          AND status = 'PROCESSING'
                    `, [event.event_id, error.message]);

                } catch (updateError) {
                    console.error(
                        'Failed to reset outbox event:',
                        event.event_id,
                        updateError.message
                    );
                    // If this update fails, the five-minute lease
                    // allows another worker to recover the event.
                }
            }
        }

    } catch (error) {
        console.error('Outbox worker error:', error.message);

    } finally {
        isRunning = false;
    }
}

export function startOutboxWorker() {
    console.log('Outbox worker started');

    processOutboxEvents();

    setInterval(processOutboxEvents, 5000);
}
