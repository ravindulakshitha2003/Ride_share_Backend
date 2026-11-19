DROP INDEX IF EXISTS idx_driver_routes_signature;

ALTER TABLE driver_routes
    DROP COLUMN IF EXISTS route_signature;
