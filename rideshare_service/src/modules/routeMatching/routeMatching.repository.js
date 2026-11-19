
import pool from '../../db/pool.js';

export async function saveSelectedDriverRoute(routeData, createEvent) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Save the ride in PostgreSQL
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
            routeData.driverId,
            routeData.vehicleId,
            routeData.originName,
            routeData.originLatitude,
            routeData.originLongitude,
            routeData.destinationName,
            routeData.destinationLatitude,
            routeData.destinationLongitude,
            JSON.stringify(routeData.geometry),
            routeData.distanceMeters,
            routeData.durationSeconds,
            JSON.stringify(routeData.intermediateStops),
            routeData.departureAt,
            routeData.availableSeats,
            routeData.pricePerSeat,
            routeData.currency
        ];

        const result = await client.query(query, values);
        const savedRide = result.rows[0];

        // 2. Build the notification event using saved ride details
        const event = createEvent(savedRide);

        // 3. Save the event in the Outbox table
        const outboxQuery = `
            INSERT INTO outbox_events (
                event_id,
                aggregate_type,
                aggregate_id,
                event_type,
                routing_key,
                payload
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `;

        await client.query(outboxQuery, [
            event.eventId,
            'ride',
            savedRide.route_id,
            event.eventType,
            'ride.published',
            JSON.stringify(event)
        ]);

        // 4. Commit both inserts together
        await client.query('COMMIT');

        return savedRide;

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Transaction rollback failed:', rollbackError.message);
        }

        throw error;

    } finally {
        client.release();
    }
}


import { FIND_MATCHING_ROUTES } from './routeMatching.sql.js';

export async function findMatchingRoutes(p) {
    const result = await pool.query(FIND_MATCHING_ROUTES, [
        p.pickupLng, p.pickupLat, p.dropoffLng, p.dropoffLat,
        p.seats, p.departFrom, p.departTo, p.maxDistanceMeters
    ]);
    return result.rows;
}
