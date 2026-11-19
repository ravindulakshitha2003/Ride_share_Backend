ALTER TABLE outbox_events
DROP CONSTRAINT IF EXISTS outbox_events_status_check;

ALTER TABLE outbox_events
ADD CONSTRAINT outbox_events_status_check
CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED'));

ALTER TABLE outbox_events
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;