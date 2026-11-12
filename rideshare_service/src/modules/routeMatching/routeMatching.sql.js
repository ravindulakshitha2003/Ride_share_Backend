// $1 pickup lng, $2 pickup lat, $3 dropoff lng, $4 dropoff lat,
// $5 seats, $6 departure from, $7 departure to, $8 max walking distance (m)
// 32644 = UTM zone 44N (covers Sri Lanka), used so distances are in metres.
export const FIND_MATCHING_ROUTES = `
WITH passenger_points AS (
    SELECT
        ST_SetSRID(ST_MakePoint($1, $2), 4326) AS pickup_wgs,
        ST_SetSRID(ST_MakePoint($3, $4), 4326) AS dropoff_wgs,
        ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 32644) AS pickup,
        ST_Transform(ST_SetSRID(ST_MakePoint($3, $4), 4326), 32644) AS dropoff
),
candidate_routes AS (
    SELECT
        r.*,
        ST_Transform(r.route_line, 32644) AS route_utm,
        p.pickup,
        p.dropoff
    FROM driver_routes r
    CROSS JOIN passenger_points p
    WHERE r.status = 'PUBLISHED'
      AND r.available_seats >= $5
      AND r.departure_at BETWEEN $6 AND $7
      AND r.departure_at > NOW()
      -- cheap bounding-box prefilter (uses GIST index), ~0.2 degrees
      AND r.route_line && ST_Expand(p.pickup_wgs, 0.2)
      AND r.route_line && ST_Expand(p.dropoff_wgs, 0.2)
      -- precise distance check in metres
      AND ST_DWithin(ST_Transform(r.route_line, 32644), p.pickup,  $8)
      AND ST_DWithin(ST_Transform(r.route_line, 32644), p.dropoff, $8)
),
measured AS (
    SELECT
        *,
        ST_LineLocatePoint(route_utm, pickup)  AS pickup_position,
        ST_LineLocatePoint(route_utm, dropoff) AS dropoff_position,
        ST_ClosestPoint(route_utm, pickup)     AS nearest_pickup,
        ST_ClosestPoint(route_utm, dropoff)    AS nearest_dropoff,
        ST_Distance(route_utm, pickup)         AS pickup_distance_meters,
        ST_Distance(route_utm, dropoff)        AS dropoff_distance_meters
    FROM candidate_routes
)
SELECT
    route_id,
    driver_id,
    vehicle_id,
    origin_name,
    destination_name,
    departure_at,
    available_seats,
    price_per_seat,
    currency,
    distance_meters   AS full_route_distance_meters,
    duration_seconds  AS full_route_duration_seconds,
    ROUND(pickup_distance_meters::numeric, 1)  AS pickup_distance_meters,
    ROUND(dropoff_distance_meters::numeric, 1) AS dropoff_distance_meters,
    ROUND((ST_Length(ST_LineSubstring(route_utm, pickup_position, dropoff_position)))::numeric, 1)
        AS ride_distance_meters,
    ST_AsGeoJSON(ST_Transform(nearest_pickup, 4326))::json  AS suggested_pickup,
    ST_AsGeoJSON(ST_Transform(nearest_dropoff, 4326))::json AS suggested_dropoff,
    ST_AsGeoJSON(
        ST_Transform(ST_LineSubstring(route_utm, pickup_position, dropoff_position), 4326)
    )::json AS matched_route_segment
FROM measured
WHERE pickup_position < dropoff_position
ORDER BY pickup_distance_meters + dropoff_distance_meters ASC, departure_at ASC
LIMIT 20;
`;
