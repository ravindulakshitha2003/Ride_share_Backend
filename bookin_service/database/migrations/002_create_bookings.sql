CREATE DATABASE Bookingdb;

CREATE TABLE IF NOT EXISTS bookings (
    booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    passenger_id TEXT NOT NULL,
    ride_id TEXT NOT NULL,
    requested_seats INTEGER NOT NULL CHECK (requested_seats > 0),
    note TEXT,

    passenger_origin_name TEXT NOT NULL,
    passenger_origin_location GEOGRAPHY(POINT, 4326) NOT NULL,

    passenger_destination_name TEXT NOT NULL,
    passenger_destination_location GEOGRAPHY(POINT, 4326) NOT NULL,

    matched_route_id TEXT NOT NULL,

    pickup_mode TEXT NOT NULL CHECK (pickup_mode IN ('WALK_TO_ROUTE', 'DRIVER_DETOUR')),
    dropoff_mode TEXT NOT NULL CHECK (dropoff_mode IN ('WALK_TO_ROUTE', 'DRIVER_DETOUR')),

    pickup_point_name TEXT NOT NULL,
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,

    dropoff_point_name TEXT NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,

    pickup_walk_distance_m INTEGER NOT NULL DEFAULT 0 CHECK (pickup_walk_distance_m >= 0),
    dropoff_walk_distance_m INTEGER NOT NULL DEFAULT 0 CHECK (dropoff_walk_distance_m >= 0),
    extra_distance_m INTEGER NOT NULL DEFAULT 0 CHECK (extra_distance_m >= 0),
    extra_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (extra_duration_seconds >= 0),

    status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id
    ON bookings(passenger_id);

CREATE INDEX IF NOT EXISTS idx_bookings_ride_id
    ON bookings(ride_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_origin_location
    ON bookings USING GIST(passenger_origin_location);

CREATE INDEX IF NOT EXISTS idx_bookings_destination_location
    ON bookings USING GIST(passenger_destination_location);

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_location
    ON bookings USING GIST(pickup_location);

CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_location
    ON bookings USING GIST(dropoff_location);
