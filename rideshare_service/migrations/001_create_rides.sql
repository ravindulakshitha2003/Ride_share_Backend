/*This code creates the rides table in PostgreSQL to store ride details*/

CREATE TABLE rides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        TEXT NOT NULL,
  origin_name      TEXT NOT NULL,
  origin_lat       NUMERIC(9,6) NOT NULL,
  origin_lng       NUMERIC(9,6) NOT NULL,
  dest_name        TEXT NOT NULL,
  dest_lat         NUMERIC(9,6) NOT NULL,
  dest_lng         NUMERIC(9,6) NOT NULL,
  departure_at     TIMESTAMPTZ NOT NULL,
  total_seats      SMALLINT NOT NULL CHECK (total_seats BETWEEN 1 AND 8),
  available_seats  SMALLINT NOT NULL CHECK (available_seats >= 0),
  price_per_seat   NUMERIC(10,2) NOT NULL CHECK (price_per_seat >= 0),
  currency         CHAR(3) NOT NULL DEFAULT 'LKR',
  distance_km      NUMERIC(7,2),
  duration_min     INTEGER,
  route_geometry   JSONB,
  status           TEXT NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN','FULL','CANCELLED','COMPLETED')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_key       TEXT GENERATED ALWAYS AS (lower(origin_name)) STORED,
  dest_key         TEXT GENERATED ALWAYS AS (lower(dest_name)) STORED,
  CHECK (available_seats <= total_seats)
);