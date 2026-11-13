CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS driver_routes (
    route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id VARCHAR(150) NOT NULL,
    vehicle_id VARCHAR(150) NOT NULL,
    route_signature VARCHAR(64) NOT NULL CHECK (route_signature ~ '^[a-f0-9]{64}$'),
    origin_name VARCHAR(200) NOT NULL,
    origin_latitude DOUBLE PRECISION NOT NULL CHECK (origin_latitude BETWEEN -90 AND 90),
    origin_longitude DOUBLE PRECISION NOT NULL CHECK (origin_longitude BETWEEN -180 AND 180),
    destination_name VARCHAR(200) NOT NULL,
    destination_latitude DOUBLE PRECISION NOT NULL CHECK (destination_latitude BETWEEN -90 AND 90),
    destination_longitude DOUBLE PRECISION NOT NULL CHECK (destination_longitude BETWEEN -180 AND 180),
    route_line geometry(LineString, 4326) NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters > 0),
    duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds > 0),
    intermediate_stops JSONB NOT NULL DEFAULT '[]'::jsonb,
    departure_at TIMESTAMPTZ NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats BETWEEN 1 AND 20),
    price_per_seat NUMERIC(12, 2) NOT NULL CHECK (price_per_seat > 0),
    currency CHAR(3) NOT NULL DEFAULT 'LKR',
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('PUBLISHED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_id ON driver_routes (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_departure_at ON driver_routes (departure_at);
CREATE INDEX IF NOT EXISTS idx_driver_routes_status ON driver_routes (status);
CREATE INDEX IF NOT EXISTS idx_driver_routes_signature ON driver_routes (route_signature);
CREATE INDEX IF NOT EXISTS idx_driver_routes_route_line ON driver_routes USING GIST (route_line);
