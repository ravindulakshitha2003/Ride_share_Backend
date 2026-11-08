/*
This code defines database functions for managing rides. 
It allows the backend to insert new rides, search available rides by origin, 
destination, and date, and retrieve all rides posted by a specific driver from PostgreSQL.
*/

const pool = require('../../db/pool');

exports.insert = async (r) => {
  const geojson = r.routeGeometry && r.routeGeometry.length >= 2
    ? JSON.stringify({
        type: 'LineString',
        coordinates: r.routeGeometry.map(([lat, lng]) => [lng, lat]),
      })
    : null;

  const { rows } = await pool.query(
    `INSERT INTO rides
      (driver_id, origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng,
       departure_at, total_seats, available_seats, price_per_seat,
       distance_km, duration_min, route_geometry, route_line)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,
       COALESCE(
         ST_SetSRID(ST_GeomFromGeoJSON($14::text), 4326),
         ST_SetSRID(ST_MakeLine(
           ST_MakePoint($4::numeric::float8, $3::numeric::float8),
           ST_MakePoint($7::numeric::float8, $6::numeric::float8)), 4326)
       ))
     RETURNING id, driver_id, origin_name, dest_name, departure_at,
               total_seats, available_seats, price_per_seat, status`,
    [r.driverId, r.origin.name, r.origin.lat, r.origin.lng,
     r.destination.name, r.destination.lat, r.destination.lng,
     r.departureAt, r.seats, r.price,
     r.distanceKm ?? null, r.durationMin ?? null,
     r.routeGeometry ? JSON.stringify(r.routeGeometry) : null,
     geojson]
  );
  return rows[0];
};

exports.search = async ({ from, to, dayStart, dayEnd }) => {
  const { rows } = await pool.query(
    `SELECT * FROM rides
     WHERE status = 'OPEN' AND available_seats > 0
       AND origin_key = lower($1) AND dest_key = lower($2)
       AND departure_at >= $3 AND departure_at < $4
     ORDER BY departure_at`,
    [from, to, dayStart, dayEnd]
  );
  return rows;
};

exports.findByDriver = async (driverId) => {
  const { rows } = await pool.query(
    'SELECT * FROM rides WHERE driver_id = $1 ORDER BY departure_at DESC',
    [driverId]
  );
  return rows;
};

exports.match = async ({ pickup, dropoff, from, to, radius, minGap, limit }) => {
  const { rows } = await pool.query(
    `WITH q AS (
       SELECT ST_SetSRID(ST_MakePoint($1,$2),4326) AS p,
              ST_SetSRID(ST_MakePoint($3,$4),4326) AS d
     )
     SELECT r.id, r.driver_id, r.origin_name, r.dest_name, r.departure_at,
            r.available_seats, r.price_per_seat,
            ROUND(ST_Distance(r.route_line::geography, q.p::geography)::numeric) AS pickup_m,
            ROUND(ST_Distance(r.route_line::geography, q.d::geography)::numeric) AS dropoff_m,
            ST_LineLocatePoint(r.route_line, q.p) AS pickup_pos,
            ST_LineLocatePoint(r.route_line, q.d) AS dropoff_pos,
            ST_Y(ST_ClosestPoint(r.route_line, q.p)) AS pickup_point_lat,
            ST_X(ST_ClosestPoint(r.route_line, q.p)) AS pickup_point_lng,
            ST_Y(ST_ClosestPoint(r.route_line, q.d)) AS dropoff_point_lat,
            ST_X(ST_ClosestPoint(r.route_line, q.d)) AS dropoff_point_lng
     FROM rides r, q
     WHERE r.status = 'OPEN' AND r.available_seats > 0
       AND r.departure_at >= $5 AND r.departure_at < $6
       AND ST_DWithin(r.route_line::geography, q.p::geography, $7)
       AND ST_DWithin(r.route_line::geography, q.d::geography, $7)
       AND ST_LineLocatePoint(r.route_line, q.p)
           < ST_LineLocatePoint(r.route_line, q.d) - $8
     ORDER BY ST_Distance(r.route_line::geography, q.p::geography)
            + ST_Distance(r.route_line::geography, q.d::geography)
     LIMIT $9`,
    [pickup.lng, pickup.lat, dropoff.lng, dropoff.lat,
     from, to, radius, minGap, limit]
  );
  return rows;
};