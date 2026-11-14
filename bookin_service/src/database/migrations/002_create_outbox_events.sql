-- Outbox records are committed in the same transaction as booking changes.
-- A background worker publishes them to RabbitMQ.
CREATE TABLE IF NOT EXISTS outbox_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,

    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PUBLISHED')),

    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(created_at)
    WHERE status = 'PENDING';
