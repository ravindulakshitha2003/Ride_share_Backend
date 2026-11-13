/*
This code enables the PostGIS extension to store and process geographic data. 
It adds a spatial route column, generates straight-line routes for existing rides using 
origin and destination coordinates, and creates a spatial index to make geographic searches faster.
*/

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE rides ADD COLUMN route_line geometry(LineString, 4326);

-- existing rows: fall back to a straight line origin -> destination
UPDATE rides
SET route_line = ST_SetSRID(
      ST_MakeLine(ST_MakePoint(origin_lng, origin_lat),
                  ST_MakePoint(dest_lng, dest_lat)), 4326)
WHERE route_line IS NULL;

-- spatial index (matches the ::geography cast used in the queries)
CREATE INDEX idx_rides_route_geo ON rides USING GIST ((route_line::geography));