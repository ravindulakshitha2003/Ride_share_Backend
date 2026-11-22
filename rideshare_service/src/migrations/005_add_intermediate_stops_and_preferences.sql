-- 1. Add ride preferences and waiting time columns to driver_routes
ALTER TABLE driver_routes
ADD COLUMN IF NOT EXISTS ride_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS max_passenger_waiting_minutes INTEGER NOT NULL DEFAULT 5;

-- 2. Create separate table for intermediate stops (1-to-many relation)
CREATE TABLE IF NOT EXISTS driver_route_stops (
    stop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES driver_routes(route_id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL DEFAULT 1,
    location VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    arrival_time VARCHAR(50),
    duration_minutes INTEGER DEFAULT 0,
    description TEXT,
    flexible_time BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create index for fast lookups by route_id
CREATE INDEX IF NOT EXISTS idx_driver_route_stops_route_id 
ON driver_route_stops (route_id);