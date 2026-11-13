/*
This code creates database indexes to make ride searches faster, including searches 
by origin, destination, and departure date. It also improves partial-name 
searches and allows drivers to quickly retrieve their own rides.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- main search: from + to + date, only bookable rides
CREATE INDEX idx_rides_search
  ON rides (origin_key, dest_key, departure_at)
  WHERE status = 'OPEN' AND available_seats > 0;

-- partial-name search
CREATE INDEX idx_rides_origin_trgm ON rides USING GIN (origin_name gin_trgm_ops);
CREATE INDEX idx_rides_dest_trgm   ON rides USING GIN (dest_name   gin_trgm_ops);

-- driver's own rides
CREATE INDEX idx_rides_driver ON rides (driver_id, departure_at DESC);