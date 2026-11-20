-- Member 3: status history table + extra reason columns.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS booking_status_history (
    id BIGSERIAL PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id),
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by TEXT,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_booking
    ON booking_status_history(booking_id, changed_at);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;
