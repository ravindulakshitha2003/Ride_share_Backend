
// $1 pickup lng, $2 pickup lat, $3 dropoff lng, $4 dropoff lat,
// $5 seats, $6 departure from, $7 departure to, $8 max walking distance (m)

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
      AND r.route_line && ST_Expand(p.pickup_wgs, 0.2)
      AND r.route_line && ST_Expand(p.dropoff_wgs, 0.2)
      AND ST_DWithin(ST_Transform(r.route_line, 32644), p.pickup, $8)
      AND ST_DWithin(ST_Transform(r.route_line, 32644), p.dropoff, $8)
),
measured AS (
    SELECT
        *,
        ST_LineLocatePoint(route_utm, pickup) AS pickup_position,
        ST_LineLocatePoint(route_utm, dropoff) AS dropoff_position,
        ST_ClosestPoint(route_utm, pickup) AS nearest_pickup,
        ST_ClosestPoint(route_utm, dropoff) AS nearest_dropoff,
        ST_Distance(route_utm, pickup) AS pickup_distance_meters,
        ST_Distance(route_utm, dropoff) AS dropoff_distance_meters
    FROM candidate_routes
)
SELECT
    route_id,
    driver_id,
    driver_name,
    no_of_requests,
    no_of_bookings,
    vehicle_id,

    origin_name,
    origin_latitude,
    origin_longitude,

    destination_name,
    destination_latitude,
    destination_longitude,

    departure_at,
    available_seats,
    price_per_seat,
    currency,

    ride_preferences,
    max_passenger_waiting_minutes,

    distance_meters AS full_route_distance_meters,
    duration_seconds AS full_route_duration_seconds,

    ROUND(pickup_distance_meters::numeric, 1)
        AS pickup_distance_meters,

    ROUND(dropoff_distance_meters::numeric, 1)
        AS dropoff_distance_meters,

    ROUND(
        ST_Length(
            ST_LineSubstring(
                route_utm,
                pickup_position,
                dropoff_position
            )
        )::numeric,
        1
    ) AS ride_distance_meters,

    ST_AsGeoJSON(
        ST_Transform(nearest_pickup, 4326)
    )::json AS suggested_pickup,

    ST_AsGeoJSON(
        ST_Transform(nearest_dropoff, 4326)
    )::json AS suggested_dropoff,

    ST_AsGeoJSON(
        ST_Transform(
            ST_LineSubstring(
                route_utm,
                pickup_position,
                dropoff_position
            ),
            4326
        )
    )::json AS matched_route_segment,

    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'stopId', s.stop_id,
                    'stopOrder', s.stop_order,
                    'location', s.location,
                    'reason', s.reason,
                    'arrivalTime', s.arrival_time,
                    'durationMinutes', s.duration_minutes,
                    'description', s.description,
                    'flexibleTime', s.flexible_time
                )
                ORDER BY s.stop_order ASC
            )
            FROM driver_route_stops s
            WHERE s.route_id = measured.route_id
        ),
        '[]'::json
    ) AS intermediate_stops

FROM measured
WHERE pickup_position < dropoff_position

ORDER BY
    pickup_distance_meters + dropoff_distance_meters ASC,
    departure_at ASC

LIMIT 20;
`;


// Get a single driver route by route ID

export const GET_ROUTE_BY_ID = `
SELECT
    r.route_id,
    r.driver_id,
    r.driver_name,
    r.no_of_requests,
    r.no_of_bookings,
    r.vehicle_id,

    r.origin_name,
    r.origin_latitude,
    r.origin_longitude,

    r.destination_name,
    r.destination_latitude,
    r.destination_longitude,

    ST_AsGeoJSON(r.route_line)::json AS route_geometry,

    r.distance_meters,
    r.duration_seconds,

    r.departure_at,
    r.available_seats,

    r.price_per_seat,
    r.currency,

    r.ride_preferences,
    r.max_passenger_waiting_minutes,

    r.status,
    r.created_at,

    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'stopId', s.stop_id,
                    'stopOrder', s.stop_order,
                    'location', s.location,
                    'reason', s.reason,
                    'arrivalTime', s.arrival_time,
                    'durationMinutes', s.duration_minutes,
                    'description', s.description,
                    'flexibleTime', s.flexible_time
                )
                ORDER BY s.stop_order ASC
            )
            FROM driver_route_stops s
            WHERE s.route_id = r.route_id
        ),
        '[]'::json
    ) AS intermediate_stops

FROM driver_routes r
WHERE r.route_id = $1;
`;
