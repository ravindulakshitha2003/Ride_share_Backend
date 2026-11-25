-- =============================================================================
-- 004_booking_lifecycle.sql
-- Booking lifecycle (pending list, accept, reject, cancel, complete).
--
-- Run AFTER 001, 002 and 003. Safe to run more than once (IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) driver_id
-- The bookings table only stored ride_id. To show a driver "the requests for
-- MY rides" (screen D1) and to check "is this driver allowed to accept this
-- booking?" we need to know who drives the ride. We copy the driver id into
-- the booking when it is created (the Ride Service tells us who the driver is).
-- Copying it here means we don't have to call the Ride Service every time the
-- driver opens their request list.
-- -----------------------------------------------------------------------------
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS driver_id TEXT;

-- -----------------------------------------------------------------------------
-- 2) Extra lifecycle columns
--   reject_reason : optional text the driver types when rejecting
--   cancel_reason : already added by 003 (reused)
--   cancelled_by  : who cancelled - PASSENGER or DRIVER
--   responded_at  : when the driver accepted / rejected (useful for reports,
--                   e.g. "average driver response time")
--   completed_at  : when the trip was marked completed
-- -----------------------------------------------------------------------------
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS reject_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by  TEXT,
    ADD COLUMN IF NOT EXISTS responded_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;

-- Only allow the two valid values in cancelled_by.
-- (ADD CONSTRAINT has no IF NOT EXISTS, so we check the catalog first.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_cancelled_by'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_cancelled_by
            CHECK (cancelled_by IS NULL OR cancelled_by IN ('PASSENGER', 'DRIVER'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Indexes
-- D1 runs: WHERE driver_id = ? AND status = 'PENDING' ORDER BY created_at
-- This composite index answers exactly that query.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_driver_status_created
    ON bookings (driver_id, status, created_at);

-- Used when counting already-confirmed seats on a ride before accepting.
CREATE INDEX IF NOT EXISTS idx_bookings_ride_status
    ON bookings (ride_id, status);

-- -----------------------------------------------------------------------------
-- 4) Business rule enforced by the database:
-- A passenger can have only ONE active (PENDING or CONFIRMED) booking for the
-- same ride. Stops double-tapping "Request" from creating duplicates.
-- A "partial unique index" only applies to rows matching the WHERE clause, so
-- old REJECTED / CANCELLED bookings do not block a new request.
--
-- If this fails to create, you already have duplicate active rows in your
-- dev data - delete them (or TRUNCATE bookings CASCADE) and run again.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_passenger_ride
    ON bookings (passenger_id, ride_id)
    WHERE status IN ('PENDING', 'CONFIRMED');
