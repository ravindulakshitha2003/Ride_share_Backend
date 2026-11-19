import pool from '../../db/pool.js';

export async function saveSelectedDriverRoute(routeData) {
    const query = `
        INSERT INTO driver_routes (
            driver_id, vehicle_id,
            origin_name, origin_latitude, origin_longitude,
            destination_name, destination_latitude, destination_longitude,
            route_line, distance_meters, duration_seconds,
            intermediate_stops, departure_at, available_seats,
            price_per_seat, currency, status
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            ST_SetSRID(ST_GeomFromGeoJSON($9), 4326),
            $10, $11, $12::jsonb, $13, $14, $15, $16, 'PUBLISHED'
        )
        RETURNING route_id, driver_id, vehicle_id,
            origin_name, origin_latitude, origin_longitude,
            destination_name, destination_latitude, destination_longitude,
            ST_AsGeoJSON(route_line)::json AS route_geometry,
            distance_meters, duration_seconds, intermediate_stops,
            departure_at, available_seats, price_per_seat, currency,
            status, created_at;
    `;
    const values = [
        routeData.driverId, routeData.vehicleId,
        routeData.originName, routeData.originLatitude, routeData.originLongitude,
        routeData.destinationName, routeData.destinationLatitude, routeData.destinationLongitude,
        JSON.stringify(routeData.geometry), routeData.distanceMeters, routeData.durationSeconds,
        JSON.stringify(routeData.intermediateStops), routeData.departureAt,
        routeData.availableSeats, routeData.pricePerSeat, routeData.currency
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
}

import { FIND_MATCHING_ROUTES } from './routeMatching.sql.js';

export async function findMatchingRoutes(p) {
    const result = await pool.query(FIND_MATCHING_ROUTES, [
        p.pickupLng, p.pickupLat, p.dropoffLng, p.dropoffLat,
        p.seats, p.departFrom, p.departTo, p.maxDistanceMeters
    ]);
    return result.rows;
}
